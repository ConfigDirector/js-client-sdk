import type {
  ConfigDirectorContext,
  ConfigDirectorLogger,
  Transport,
  TransportEvents,
  TransportOptions,
} from "./types";
import { Emitter } from "./Emitter";
import { ConfigDirectorConnectionError, isFetchErrorFatal } from "./errors";
import { fetchWithTimeout } from "./fetchWithTimeout";

export class PullTransport implements Transport {
  private logger: ConfigDirectorLogger;
  private eventEmitter = new Emitter<TransportEvents>();
  private url: URL;
  private fatalError = false;

  constructor(private readonly options: TransportOptions) {
    this.options = options;
    this.logger = options.logger;
    this.url = new URL("pull/v1", options.baseUrl);
  }

  public async connect(context: ConfigDirectorContext, timeout: number): Promise<this> {
    if (this.fatalError) {
      this.logger.warn(
        "[PullTransport] There was a prior unrecoverable error. Ignoring attempt to reconnect.",
      );
      return this;
    }

    try {
      const response = await fetchWithTimeout(timeout, this.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          givenContext: context,
          metaContext: this.options.metaContext,
          clientSdkKey: this.options.clientSdkKey,
        }),
      }, this.logger);

      if (!response.ok) {
        if (this.isStatusFatal(response.status)) {
          this.fatalError = true;
          throw this.prepareFatalResponseStatusError(response.status, await response.text());
        } else {
          throw new ConfigDirectorConnectionError(
            `Connection failed with status: ${response.status}`,
            response.status,
          );
        }
      }

      const json = JSON.parse(await response.text());
      this.eventEmitter.emit("configSetReceived", json);
      return this;
    } catch (fetchError) {
      if (isFetchErrorFatal(fetchError)) {
        this.fatalError = true;
        throw new ConfigDirectorConnectionError(
          `Connection failed with fatal error: ${fetchError}. This is an unrecoverable error, retry attempts will be ignored.`,
        );
      } else if (fetchError instanceof SyntaxError) {
        throw new ConfigDirectorConnectionError(
          `Failed to parse the response from the server: ${fetchError}`,
        );
      } else {
        throw new ConfigDirectorConnectionError(`Connection failed with error: ${fetchError}.`);
      }
    }
  }

  private prepareFatalResponseStatusError(
    responseStatus: number,
    errorBody: string | undefined,
  ): ConfigDirectorConnectionError {
    const status = responseStatus ?? 0;
    const headline = `Connection failed with status: ${responseStatus ?? "unknown"}`;
    const serverBody = (errorBody?.trim()?.length ?? 0) > 0 ? ` (${errorBody})` : "";
    const message = `${headline}${serverBody}. This is an unrecoverable error, retry attempts will be ignored.`;
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

  public close() {}

  public dispose(): void {
    this.close();
    this.clear();
  }
}
