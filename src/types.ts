import { EventProvider } from "./events";

export type EnumLike = { [key: string]: string | number };

export type ConfigValueType = string | number | boolean | object | URL | EnumLike;

export type ConfigType = "custom" | "boolean" | "string" | "number" | "enum" | "url" | "json";

export type ConfigState = {
  id: string;
  key: string;
  type: ConfigType;
  value: string | undefined | null;
};

export type ConfigStateMap = {
  [key: string]: ConfigState;
};

export type ConfigSet = {
  environmentId: string;
  projectId: string;
  configs: ConfigStateMap;
  kind: "full" | "delta";
};

/**
 * The user's context to be sent to ConfigDirector. This context will be used for targeting
 * rules evaluation.
 */
export type ConfigDirectorContext = {
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
  traits?: { [key: string]: unknown };
};

export type SdkMetaContext = {
  sdkVersion: string;
  userAgent?: string;
};

export type ConfigDirectorClientOptions = {
  metadata?: {
    appVersion?: string;
    appName?: string;
  };
  connection?: {
    timeout: number;
    url: string;
  };
};

export type ClientEvents<T = void> = {
  configsUpdated: T;
};

export type WatchHandler<T extends ConfigValueType> = (message: T) => void;

/**
 * The ConfigDirector SDK client object.
 *
 * Applications should create a single instance of {@link DefaultConfigDirectorClient}, and call
 * {@link initialize} during application initialization.
 *
 * After initialization, to update the user's context, so that targeting rules are evaluated
 * with the updated context, call {@link updateContext}.
 */
export interface ConfigDirectorClient extends EventProvider<ClientEvents> {
  /**
   * Initializes the connection to ConfigDirector to retrieve config evaluations. Until
   * initialization is successful, all flags will return their default value provided to
   * {@link watch} or {@link getValue}.
   *
   * If the connection fails or is interrupted with a transient error (network error,
   * internal server error, etc) the client will continue to attempt to connect. However,
   * if the connection fails with a persistent error, like an invalid SDK key, the client will
   * not attempt to re-connect and an error will be logged to the console or the provided
   * logger.
   *
   * @param context The current user's context to be used for evaluating targeting rules (optional).
   */
  initialize(context?: ConfigDirectorContext): Promise<void>;

  /**
   * Updates the user's context and re-evaluates all config and flag values based on the new context.
   *
   * @param context The current user's context to be used for evaluating targeting rules (required).
   */
  updateContext(context: ConfigDirectorContext): Promise<void>;

  getValue<T extends ConfigValueType>(configKey: string, defaultValue: T): T;

  watch<T extends ConfigValueType>(configKey: string, defaultValue: T, callback: WatchHandler<T>): () => void;

  unwatch<T extends ConfigValueType>(configKey: string, callback?: WatchHandler<T>): void;

  unwatchAll(): void;

  dispose(): void;
}
