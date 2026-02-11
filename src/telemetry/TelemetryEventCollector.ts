import { ConfigDirectorLogger, ConfigValueType } from "../types";
import { EventAggregator } from "./EventAggregator";
import { EventQueue } from "./EventQueue";
import { EventReporter } from "./EventReporter";
import { EvaluatedConfigEvent } from "./telemetry-events";

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
    this.flushIntervalDelay = 5_000;
    this.flushTimeout = setTimeout(async () => await this.flush(), this.flushIntervalDelay);
  }

  evaluatedConfig<T extends ConfigValueType>(event: EvaluatedConfigEvent<T>): void {
    if (!this.collectEvents) {
      return;
    }

    const serializableEvent: EvaluatedConfigEvent<string> = {
      key: event.key,
      type: event.type,
      defaultValue: event.defaultValue.toString(),
      requestedType: event.requestedType,
      evaluatedValue: event.evaluatedValue.toString(),
      usedDefault: event.usedDefault,
      evaluationReason: event.evaluationReason,
    };
    this.evaluationEventQueue.push(serializableEvent);
  }

  async flush() {
    const evaluationSnapshot = this.evaluationEventQueue.takeSnapshot();
    const response = await this.reporter.report(
      {},
      {
        evaluatedConfig: this.aggregator.aggregate(evaluationSnapshot),
      },
    );
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

  close() {
    clearTimeout(this.flushTimeout);
    this.evaluationEventQueue.clear();
  }
}
