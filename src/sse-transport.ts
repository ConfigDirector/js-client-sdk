import { createEventSource, type EventSourceClient } from "eventsource-client";
import type { ConfigDirectorClientOptions, ConfigDirectorContext, ConfigDirectorLogger, ConfigSet, SdkMetaContext } from "./types";
import { Emitter, EventProvider } from "./event-emitter";

export type TransportOptions = {
  clientSdkKey: string;
  baseUrl: URL;
  metaContext: ConfigDirectorClientOptions["metadata"] & SdkMetaContext;
  logger: ConfigDirectorLogger;
};

export class ConfigDirectorConnectionError extends Error {
  public override readonly name: string = "ConnectionError";
  public readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;

    Object.setPrototypeOf(this, ConfigDirectorConnectionError.prototype);
  }
}

export type TransportEvents = {
  configSetReceived: ConfigSet;
};

export class EventSourceTransport implements EventProvider<TransportEvents> {
  private logger: ConfigDirectorLogger;
  private eventSource: EventSourceClient | undefined;
  private responseStatus: number | undefined;
  private errorBody: string | undefined;
  private eventEmitter = new Emitter<TransportEvents>();
  private url: URL;

  constructor(private readonly options: TransportOptions) {
    this.options = options;
    this.logger = options.logger;
    this.url = new URL("sse", options.baseUrl);
  }

  public async connect(context: ConfigDirectorContext): Promise<EventSourceTransport> {
    if (this.eventSource) {
      this.close();
    }

    const customFetch = async (url: string | URL | Request, init?: RequestInit | undefined) => {
      const response = await fetch(url, init);
      this.responseStatus = response.status;
      if (!response.ok) {
        this.errorBody = await response.text();
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
          if (this.responseStatus && this.isStatusFatal) {
            this.close();
            reject(this.prepareFatalError());
          } else {
            this.logger.debug("Connected, status: %s", this.responseStatus);
            resolve(this);
          }
        },
        onScheduleReconnect: (info: { delay: number }) => {
          if (this.responseStatus && this.isStatusFatal) {
            this.close();
            reject(this.prepareFatalError());
          } else {
            this.logger.warn(`Scheduling reconnect in ${info.delay}. Response status: ${this.responseStatus}`);
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

  private prepareFatalError(): ConfigDirectorConnectionError {
    const headline = this.errorBody ?? `Connection failed with status: ${this.responseStatus}`;
    const message = `${headline}. This is an unrecoverable error, will not attempt to reconnect.`;
    const status = this.responseStatus ?? 0;
    return new ConfigDirectorConnectionError(message, status);
  }

  private get isStatusFatal(): boolean {
    return !!this.responseStatus && this.responseStatus >= 400 && this.responseStatus < 500;
  }

  public on(eventName: keyof TransportEvents, handler: (payload: TransportEvents[keyof TransportEvents]) => void) {
    this.eventEmitter.on(eventName, handler);
  }

  public off(eventName: keyof TransportEvents, handler?: ((payload: TransportEvents[keyof TransportEvents]) => void) | undefined) {
    this.eventEmitter.off(eventName, handler);
  }

  public clear(): void {
    this.eventEmitter.clear();
  }

  public close() {
    this.eventSource?.close();
    this.responseStatus = undefined;
    this.errorBody = undefined;
  }
}
