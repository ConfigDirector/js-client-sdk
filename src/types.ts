import { EventProvider } from "./Emitter";

export type ConfigEnumLikeType = { [key: string]: string | number };

export type ConfigValueType = string | number | boolean | object | ConfigEnumLikeType;

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

export type EvaluationReason =
  | "found-match"
  | "config-state-missing"
  | "client-not-ready"
  | "type-mismatch"
  | "value-missing"
  | "invalid-number"
  | "invalid-boolean";

export type ConfigDirectorLoggingLevel = "debug" | "info" | "warn" | "error" | "off";

export interface ConfigDirectorLogger {
  debug(message: string, ...args: any): void;

  info(message: string, ...args: any): void;

  warn(message: string, ...args: any): void;

  error(message: string, ...args: any): void;
}

export interface ConfigDirectorLogMessageDecorator {
  decorateMessage(message: string): string;
}

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

/**
 * Configuration options for the {@link ConfigDirectorClient}
 */
export type ConfigDirectorClientOptions = {
  /**
   * Application metadata that remains constant through the lifetime of the connection
   */
  metadata?: {
    appVersion?: string;
    appName?: string;
  };
  /**
   * Connection options
   */
  connection?: {
    /**
     * Whether to open a streaming connection or use a one-time pull of configuration state.
     * If set to true, the streaming connection will remain open and receive updates whenever
     * config state is updated on the ConfigDirector dashboard.
     * When set to false, there will be an initial request to retrieve config state during
     * initialization, and an additional request whenever {@link ConfigDirectorClient.updateContext}
     * is called. But not updates will be received after those requests.
     *
     * Defaults to true (streaming connection)
     */
    streaming?: boolean;
    /**
     * The timeout, in milliseconds, to be used in initialization and when updating the context.
     * If streaming is enabled, the operation (initialization or context update) may still succeed
     * after it times out if no unrecoverable errors are encountered (like an invalid SDK key).
     * If streaming is disabled, if the operation times out, it will not be retried.
     */
    timeout?: number;
    /**
     * The base URL to the ConfigDirector SDK server. To be used only when needing to route through a
     * proxy to connect to the ConfigDirector SDK server. Please refer to the docs on how to configure
     * a proxy for the client SDK.
     */
    url?: string;
  };
  /**
   * A logger that implements {@link ConfigDirectorLogger}. It defaults to the ConfigDirector console
   * logger set to 'warn' level.
   *
   * The log level of the default logger can be adjusted by creating a default logger with the desired
   * level and providing it in this property:
   * @example
   * import { createClient, createConsoleLogger } from "@configdirector/client-sdk";
   * const client = createClient(
   *   "YOUR-SDK-KEY",
   *   { logger: createConsoleLogger("debug") },
   * );
   */
  logger?: ConfigDirectorLogger;
};

export type ClientConnectAction = "initialization" | "context update";

export type ClientEvents = {
  configsUpdated: { keys: string[] };
  clientReady: { action: ClientConnectAction };
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

  /**
   * Returns whether or not the client is ready after calling {@link initialize} or {@link updateContext}
   *
   * The definition of ready is that the connection to the server was successful, and config state
   * was received.
   */
  get isReady(): boolean;

  /**
   * Evaluates a config and returns its value based on the current context and targeting rules
   *
   * @returns The evaluated config value, or the defaultValue if the config state was unavailable
   * @param configKey The config key to evaluate
   * @param defaultValue The default value to be returned if the config state is unavailable. For
   * example, if the client cannot connect to the server due to network conditions, or if getValue
   * is called before initialization is done.
   */
  getValue<T extends ConfigValueType>(configKey: string, defaultValue: T): T;

  /**
   * Watches for changes to a a config evaluation value. Whenever the config value changes, the
   * provided callback function will be called with the new value. Changes can happen due to updates
   * to the config in the ConfigDirector dashboard, or if the context is updated via {@link updateContext}.
   *
   * @returns An 'unwatch' function that can be called to remove the subscriber
   *
   * @param configKey The config key to watch
   * @param defaultValue The default value to be referenced if the config state is unavailable
   * @param callback The callback function to be called whenever the config value is updated
   */
  watch<T extends ConfigValueType>(configKey: string, defaultValue: T, callback: WatchHandler<T>): () => void;

  /**
   * Removes a particular subscriber to the given configKey, or all subscribers if no callback
   * is provided.
   *
   * @param configKey The config key to remove subscribers from
   * @param callback The subscriber to be removed. If not provided, all subscribers are removed for
   * the given configKey.
   */
  unwatch<T extends ConfigValueType>(configKey: string, callback?: WatchHandler<T>): void;

  /**
   * Removes all subscribers from all config keys
   */
  unwatchAll(): void;

  /**
   * Disposes of the client. All connections are closed, and all event and config key subscribers
   * are removed.
   *
   * Intended to be called when your application shuts down
   */
  dispose(): void;
}

export type TransportOptions = {
  clientSdkKey: string;
  baseUrl: URL;
  metaContext: ConfigDirectorClientOptions["metadata"] & SdkMetaContext;
  logger: ConfigDirectorLogger;
};

export type TransportEvents = {
  configSetReceived: ConfigSet;
};

export interface Transport extends EventProvider<TransportEvents> {
  connect(context: ConfigDirectorContext, timeout: number): Promise<this>;
  close(): void;
  dispose(): void;
}
