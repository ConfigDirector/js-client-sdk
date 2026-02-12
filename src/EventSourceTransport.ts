import { createEventSource, type EventSourceClient } from "eventsource-client";
import type {
  ConfigDirectorClientOptions,
  ConfigDirectorContext,
  ConfigDirectorLogger,
  ConfigSet,
  SdkMetaContext,
} from "./types";
import { Emitter, EventProvider } from "./Emitter";
import { ConfigDirectorConnectionError } from "./errors";

export type TransportOptions = {
  clientSdkKey: string;
  baseUrl: URL;
  metaContext: ConfigDirectorClientOptions["metadata"] & SdkMetaContext;
  logger: ConfigDirectorLogger;
};

export type TransportEvents = {
  configSetReceived: ConfigSet;
};

export class EventSourceTransport implements EventProvider<TransportEvents> {
  private logger: ConfigDirectorLogger;
  private eventSource: EventSourceClient | undefined;
  private eventEmitter = new Emitter<TransportEvents>();
  private url: URL;

  constructor(private readonly options: TransportOptions) {
    this.options = options;
    this.logger = options.logger;
    this.url = new URL("sse/v1", options.baseUrl);
  }

  public async connect(context: ConfigDirectorContext): Promise<EventSourceTransport> {
    if (this.eventSource) {
      this.close();
    }

    let responseStatus: number | undefined = undefined;
    let errorBody: string | undefined = undefined;

    const customFetch = async (url: string | URL | Request, init?: RequestInit | undefined) => {
      const response = await fetch(url, init);
      responseStatus = response.status;
      if (!response.ok) {
        errorBody = await response.text();
      }
      return response;
    };

    return new Promise<EventSourceTransport>((resolve, reject) => {
      this.eventSource = createEventSource({
        url: this.url,
        fetch: customFetch,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          givenContext: context,
          metaContext: this.options.metaContext,
          clientSdkKey: this.options.clientSdkKey,
        }),

        onMessage: ({ data }) => {
          this.dispatchMessage(data);
        },
        onConnect: () => {
          if (responseStatus && this.isStatusFatal(responseStatus)) {
            this.close();
            reject(this.prepareFatalError(responseStatus, errorBody));
          } else {
            this.logger.debug("Connected, status: %s", responseStatus);
            resolve(this);
          }
        },
        onScheduleReconnect: (info: { delay: number }) => {
          if (responseStatus && this.isStatusFatal(responseStatus)) {
            this.close();
            reject(this.prepareFatalError(responseStatus, errorBody));
          } else {
            this.logger.warn(
              `Scheduling reconnect in ${info.delay}. Response status: ${responseStatus}`,
            );
          }
        },
      });
    });
  }

  private dispatchMessage(data: string) {
    try {
      const json = JSON.parse(data);
      this.eventEmitter.emit("configSetReceived", json);
    } catch (error) {
      console.error(error);
    }
  }

  private prepareFatalError(responseStatus: number, errorBody: string | undefined): ConfigDirectorConnectionError {
    const status = responseStatus ?? 0;
    const headline = `Connection failed with status: ${responseStatus ?? "unknown"}`;
    const serverBody = (errorBody?.trim()?.length ?? 0) > 0 ? ` (${errorBody})` : "";
    const message = `${headline}${serverBody}. This is an unrecoverable error, will not attempt to reconnect.`;
    return new ConfigDirectorConnectionError(message, status);
  }

  private isStatusFatal(status: number | undefined): boolean {
    return !!status && status >= 400 && status < 500;
  }

  public on<TName extends keyof TransportEvents>(
    name: TName,
    handler: (payload: TransportEvents[TName]) => void,
  ): void {
    this.eventEmitter.on(name, handler);
  }

  public off<TName extends keyof TransportEvents>(
    name: TName,
    handler?: ((payload: TransportEvents[TName]) => void) | undefined,
  ): void {
    this.eventEmitter.off(name, handler);
  }

  public clear(): void {
    this.eventEmitter.clear();
  }

  public close() {
    this.eventSource?.close();
  }
}
