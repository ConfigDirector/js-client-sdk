import { ConfigDirectorLogger, ConfigType, ConfigValueType } from "../types";
import { EventAggregator } from "./EventAggregator";
import { EventQueue } from "./EventQueue";
import { EventReporter } from "./EventReporter";
import { EvaluatedConfigEvent } from "./telemetry-events";
import { djb2Hash } from "./utils";

const CONFIG_VALUE_MAX_LENGTH = 500;

export type TelemetryEventCollectorOptions = {
  sdkKey: string;
  logger: ConfigDirectorLogger;
  baseUrl: URL;
};

export class TelemetryEventCollector {
  private readonly logger: ConfigDirectorLogger;
  private readonly reporter: EventReporter;
  private evaluationEventQueue: EventQueue<EvaluatedConfigEvent<string>> = new EventQueue();
  private readonly aggregator: EventAggregator = new EventAggregator();
  private flushIntervalDelay: number;
  private flushTimeout: ReturnType<typeof setTimeout>;
  private collectEvents = true;

  constructor(options: TelemetryEventCollectorOptions) {
    this.logger = options.logger;
    this.reporter = new EventReporter(options);
    this.flushIntervalDelay = 30_000;
    const initialDelay = 5_000;
    this.flushTimeout = setTimeout(async () => await this.flush(), initialDelay);
  }

  public evaluatedConfig<T extends ConfigValueType>(event: EvaluatedConfigEvent<T>): void {
    if (!this.collectEvents) {
      return;
    }

    this.evaluationEventQueue.push(this.sanitizeEvaluatedConfigEvent(event));
  }

  private sanitizeEvaluatedConfigEvent<T extends ConfigValueType>(
    event: EvaluatedConfigEvent<T>,
  ): EvaluatedConfigEvent<string> {
    return {
      key: event.key,
      type: event.type,
      defaultValue: this.sanitizeValue(event.defaultValue, event.type),
      requestedType: event.requestedType,
      evaluatedValue: this.sanitizeValue(event.evaluatedValue, event.type),
      usedDefault: event.usedDefault,
      evaluationReason: event.evaluationReason,
    };
  }

  private sanitizeValue<T extends ConfigValueType>(value: T, type?: ConfigType): string {
    if (type === "json") {
      try {
        const json = JSON.stringify(value);
        return djb2Hash(json);
      } catch {
        return value.toString().slice(0, CONFIG_VALUE_MAX_LENGTH);
      }
    }

    return value.toString().slice(0, CONFIG_VALUE_MAX_LENGTH);
  }

  public async flush() {
    const evaluationSnapshot = this.evaluationEventQueue.takeSnapshot();
    const response = await this.reporter.report({
      discreteEvents: {},
      aggregatedEvents: {
        evaluatedConfig: this.aggregator.aggregate(evaluationSnapshot),
      },
      droppedEvents: {
        evaluatedConfig: evaluationSnapshot.droppedCount,
      },
    });
    if (response.fatalError) {
      this.collectEvents = false;
      this.close();
      this.logger.warn(
        "[EventCollector] Received a fatal error from telemetry collection. No longer collecting events.",
      );
    } else {
      this.flushTimeout = setTimeout(async () => await this.flush(), this.flushIntervalDelay);
    }
  }

  public close() {
    this.collectEvents = false;
    clearTimeout(this.flushTimeout);
    this.evaluationEventQueue.clear();
  }

  public dispose() {
    this.close();
  }
}
