import { DefaultEventHandler } from "./event-handler";
import { EventSourceTransport } from "./transport";
import type { ConfigValueType } from "./type";

/**
 * The user's context to be sent to ConfigDirector. This context will be used for targeting
 * rules evaluation.
 */
type Context = {
  /**
   * The user's identifier. This should be a value that uniquely identifies an application
   * user.
   * In the case of anonymous users, you could generate a UUID or alternatively not provide
   * the {@link id} and the SDK will generate a random UUID. However, keep in mind that this
   * value is used for segmenting users in percentage rollouts, and changes to the {@link id}
   * could result in the user being assigned to a different percentile.
   */
  id?: string;

  /**
   * The user's display name. This will be shown in the ConfigDirector dashboard and may be
   * used for targeting rules.
   */
  name?: string;

  /**
   * Any arbitrary traits for the current user. They will be shown in the ConfigDirector
   * dashboard and may be used for targeting rules.
   */
  traits?: { [key: string]: unknown; };
};

type Metadata = {
  appVersion?: string;
  appName?: string;
};

/**
 * The ConfigDirector SDK client object.
 *
 * Applications should create a single instance of {@link ConfigDirectorClient}, and call
 * {@link initialize} during application initialization.
 *
 * After initialization, to update the user's context, so that targeting rules are evaluated
 * with the updated context, call {@link identify}.
 */
export class ConfigDirectorClient {
  private eventHandler: DefaultEventHandler;
  private transport: EventSourceTransport;

  constructor(clientSdkKey: string, metadata?: Metadata & { url?: string }) {
    this.eventHandler = new DefaultEventHandler();
    this.transport = new EventSourceTransport({
      clientSdkKey,
      url: metadata?.url,
      eventHandler: this.eventHandler,
      metaContext: {
        sdkVersion: "0.0.1",
        userAgent: navigator?.userAgent,
      },
    });
  }

  /**
   * Initializes the connection to ConfigDirector to retrieve config evaluations. Until
   * initialization is successful, all flags will return their default value provided to
   * {@link subscribe} or {@link getValue}.
   *
   * If the connection fails or is interrupted with a transient error (network error,
   * internal server error, etc) the client will continue to attempt to connect. However,
   * if the connection fails with a persistent error, like an invalid SDK key, the client will
   * not attempt to re-connect and an error will be logged to the console or the provided
   * logger.
   *
   * @param context The current user's context to be used to evaluate targeting rules
   */
  public async initialize(context: Context) {
    try {
      await this.transport.connect(context);
    } catch (error) {
      console.error(error);
      this.eventHandler.publishDefaultValues();
    }
  }

  public async identify(context: Context) {
    await this.initialize(context);
  }

  public subscribe<T extends ConfigValueType>(
    configKey: string,
    defaultValue: T,
    callback: (msg: T) => void,
  ) {
    return this.eventHandler.subscribe(configKey, defaultValue, callback);
  }

  public getValue<T extends ConfigValueType>(configKey: string, defaultValue: T): T {
    return this.eventHandler.getValue(configKey, defaultValue) ?? defaultValue;
  }

  public clear() {
    this.eventHandler.clear();
  }

  public close() {
    this.transport.close();
  }
}
