import { createEventSource, type EventSourceClient } from "eventsource-client";
import type { SdkGivenContext, SdkMetaContext } from "./options";
import type { ConfigSetEventHandler } from "./event-handler";

export type TransportOptions = {
  clientSdkKey: string;
  url?: string;
  eventHandler: ConfigSetEventHandler;
  metaContext: SdkMetaContext;
};

export class ConnectionError extends Error {
  public override readonly name: string = "ConnectionError";
  public readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;

    Object.setPrototypeOf(this, ConnectionError.prototype);
  }
}

export class EventSourceTransport {
  private eventSource: EventSourceClient | undefined;
  private responseStatus: number | undefined;
  private errorBody: string | undefined;

  constructor(private readonly options: TransportOptions) {
    this.options = options;
  }

  public async connect(context: SdkGivenContext): Promise<EventSourceTransport> {
    if (this.eventSource) {
      this.eventSource.close();
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
          console.log("Data: %s", data);
          this.options.eventHandler.handleConfigSetEvent(JSON.parse(data));
        },
        onConnect: () => {
          if (this.responseStatus && this.isStatusFatal) {
            this.close();
            reject(this.prepareFatalError());
          } else {
            console.log("Connected, status: %s", this.responseStatus);
            resolve(this);
          }
        },
        onScheduleReconnect: (info: { delay: number }) => {
          if (this.responseStatus && this.isStatusFatal) {
            this.close();
            reject(this.prepareFatalError());
          } else {
            console.log(`Scheduling reconnect in ${info.delay}. Response status: ${this.responseStatus}`);
          }
        },
      });
    });
  }

  private prepareFatalError(): ConnectionError {
    const headline = this.errorBody ?? `Connection failed with status: ${this.responseStatus}`;
    const message = `${headline}. This is an unrecoverable error, will not attempt to reconnect.`;
    const status = this.responseStatus!;
    return new ConnectionError(message, status);
  }

  private get isStatusFatal(): boolean {
    return !!this.responseStatus && this.responseStatus >= 400 && this.responseStatus < 500;
  }

  public close() {
    this.eventSource?.close();
    this.responseStatus = undefined;
    this.errorBody = undefined;
  }

  private get url(): string {
    return this.options.url ?? "https://client-sdk-api.configdirector.com/sse";
  }
}
