import { ConfigDirectorLogger } from "../types";
import { AggregatedEventList, DiscreteEventList, EventReport, ReporterResponse } from "./types";

export type EventReporterOptions = {
  sdkKey: string;
  logger: ConfigDirectorLogger;
  baseUrl: URL;
};

export class EventReporter {
  private readonly sdkKey: string;
  private readonly logger: ConfigDirectorLogger;
  private readonly url: URL;
  private executeRequests = true;

  constructor(options: EventReporterOptions) {
    this.sdkKey = options.sdkKey;
    this.logger = options.logger;
    this.url = new URL("/telemetry", options.baseUrl);
  }

  public async report(
    discreteEvents: DiscreteEventList,
    aggregatedEvents: AggregatedEventList,
  ): Promise<ReporterResponse> {
    if (!this.executeRequests) {
      return { success: false, fatalError: true };
    }

    const eventReport: EventReport = {
      clientSdkKey: this.sdkKey,
      discreteEvents,
      aggregatedEvents,
    };
    if (this.isReportEmpty(eventReport)) {
      return { success: true, fatalError: false };
    }

    const response = await this.sendReport(eventReport);
    if (response.fatalError) {
      this.executeRequests = false;
    }
    return response;
  }

  private isReportEmpty(eventReport: EventReport) {
    return (
      this.isEventListEmpty(eventReport.discreteEvents) && this.isEventListEmpty(eventReport.aggregatedEvents)
    );
  }

  private isEventListEmpty<T extends Record<string | symbol, any[]>>(eventList: T) {
    const keys = Object.keys(eventList);
    if (keys.length == 0) {
      return true;
    }

    for (const key of keys) {
      if (eventList[key].length > 0) {
        return false;
      }
    }

    return true;
  }

  private async sendReport(eventReport: EventReport): Promise<ReporterResponse> {
    try {
      const fetchResponse = await fetch(this.url, {
        method: "post",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(eventReport),
      });
      const isFatalStatus = fetchResponse.status >= 400 && fetchResponse.status <= 499;
      if (isFatalStatus) {
        this.logger.warn(
          `[EventReporter] Received a fatal response from the telemetry endpoint (${fetchResponse.status}). No more telemetry data will be sent.`,
        );
      }
      return { success: fetchResponse.ok, fatalError: isFatalStatus };
    } catch (fetchError) {
      const response = this.interpretFetchError(fetchError);
      if (response.fatalError) {
        this.logger.warn(
          `[EventReporter] Fatal error attempting to send telemetry data: ${fetchError}. No more telemetry data will be sent.`,
        );
      }
      return response;
    }
  }

  private interpretFetchError(fetchError: any): ReporterResponse {
    let isFatal = false;
    if (fetchError instanceof DOMException) {
      const domError = fetchError as DOMException;
      if (domError.name === "NotAllowedError") {
        isFatal = true;
      }
    } else if (fetchError instanceof TypeError) {
      isFatal = true;
    }

    return { success: false, fatalError: isFatal };
  }
}
