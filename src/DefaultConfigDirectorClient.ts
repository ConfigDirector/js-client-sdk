import { Emitter } from "./Emitter";
import { StreamingTransport } from "./StreamingTransport";
import { getRequestedType, parseConfigValue } from "./value-parser";
import {
  ConfigSet,
  ConfigState,
  ConfigStateMap,
  ConfigDirectorContext,
  ConfigDirectorClientOptions,
  ConfigDirectorClient,
  ClientEvents,
  WatchHandler,
  ConfigValueType,
  ConfigDirectorLogger,
  Transport,
  ClientConnectAction,
} from "./types";
import { createDefaultLogger } from "./logger";
import { TelemetryEventCollector } from "./telemetry";
import { ConfigDirectorValidationError } from "./errors";
import { PullTransport } from "./PullTransport";

const defaultBaseUrl = new URL("https://client-sdk-api.configdirector.com");

type WatchHandlerWithOptions<T extends ConfigValueType> = {
  handler: WatchHandler<T>;
  defaultValue: T;
  requestedType: string;
};

export class DefaultConfigDirectorClient implements ConfigDirectorClient {
  private logger: ConfigDirectorLogger;
  private usageEventCollector: TelemetryEventCollector;
  private configSet: ConfigSet | undefined;
  private handlersMap: Map<string, WatchHandlerWithOptions<any>[]> = new Map();
  private transport: Transport;
  private eventEmitter = new Emitter<ClientEvents>();
  private timeout: number;
  private ready = false;
  private readyPromise: Promise<void> | undefined;
  private readyResolve: (() => void) | undefined;
  private currentContext?: ConfigDirectorContext;
  private streaming: boolean;

  constructor(clientSdkKey: string, clientOptions?: ConfigDirectorClientOptions) {
    this.logger = clientOptions?.logger ?? createDefaultLogger();
    this.timeout = clientOptions?.connection?.timeout ?? 3_000;
    const baseUrl = this.parseUrl(clientOptions?.connection?.url) ?? defaultBaseUrl;
    this.streaming = clientOptions?.connection?.streaming === false ? false : true;
    const transportConstructor = this.streaming ? StreamingTransport : PullTransport;
    this.usageEventCollector = new TelemetryEventCollector({
      sdkKey: clientSdkKey,
      logger: this.logger,
      baseUrl,
    });
    this.transport = new transportConstructor({
      clientSdkKey,
      baseUrl,
      metaContext: {
        ...clientOptions?.metadata,
        sdkVersion: "__VERSION__",
        userAgent: navigator?.userAgent,
      },
      logger: this.logger,
    });

    this.transport.on("configSetReceived", (configSet: ConfigSet) => {
      this.readyResolve?.();
      const configKeys = Object.keys(configSet.configs);
      if (!this.configSet || configSet.kind == "full") {
        this.configSet = configSet;
        this.eventEmitter.emit("configsUpdated", { keys: configKeys });
        this.updateWatchers(configSet.configs);
      } else {
        this.configSet.configs = {
          ...this.configSet.configs,
          ...configSet.configs,
        };
        this.eventEmitter.emit("configsUpdated", { keys: configKeys });
        this.updateWatchers(configSet.configs);
      }
      this.logger.debug("[ConfigDirectorClient] ConfigSet updated from server:", { keys: configKeys });
    });
  }

  public async initialize(context?: ConfigDirectorContext) {
    await this.connectToTransport(context, "initialization");
  }

  public async updateContext(context: ConfigDirectorContext) {
    await this.connectToTransport(context, "context update");
  }

  private async connectToTransport(context: ConfigDirectorContext | undefined, caller: ClientConnectAction) {
    try {
      this.ready = false;
      this.readyPromise = new Promise<void>((resolve) => {
        this.readyResolve = resolve;
      }).then(() => {
        this.ready = true;
        this.eventEmitter.emit("clientReady", { action: caller });
        this.logger.debug("[ConfigDirectorClient] Received initial payload from the server, client is ready");
      });
      const startTime = new Date().getTime();
      await this.transport.connect(context ?? {}, this.timeout);
      this.currentContext = context;
      const elapsedTime = (new Date().getTime() - startTime);
      const remainingTimeout = this.timeout - elapsedTime;
      if (remainingTimeout > 0) {
        await Promise.race([
          this.readyPromise,
          new Promise<void>((resolve) => {
            setTimeout(() => resolve(), remainingTimeout);
          }),
        ]);
      }
      if (!this.ready) {
        const warningDetails = this.streaming
          ? "The client will continue to retry since there were no fatal errors detected. Configs will return the default value until the connection succeeds."
          : "Since the client was configured without streaming, configs may not update and always return the default value.";
        this.logger.warn(
          `[ConfigDirectorClient] Timed out waiting for ${caller} after ${this.timeout}ms. ${warningDetails}`,
        );
      }
    } catch (error) {
      this.logger.error(`[ConfigDirectorClient] An error occurred during ${caller}: `, error);
    }
  }

  private updateWatchers(configsMap: ConfigStateMap) {
    Object.values(configsMap).forEach((v) => this.updateWatchersForConfig(v));
  }

  private updateWatchersForConfig(configState: ConfigState) {
    this.handlersMap.get(configState.key)?.forEach((h) => {
      const value = this.getValueFromConfigState(configState.key, configState, h.defaultValue);
      h.handler(value);
    });
  }

  public watch<T extends ConfigValueType>(configKey: string, defaultValue: T, callback: WatchHandler<T>) {
    this.validateDefaultValue(defaultValue);

    const handlers = this.handlersMap.get(configKey);
    const handlerWithOptions = { handler: callback, defaultValue, requestedType: typeof defaultValue };
    if (handlers) {
      handlers.push(handlerWithOptions);
    } else {
      this.handlersMap.set(configKey, [handlerWithOptions]);
    }

    return () => this.unwatch(configKey, callback);
  }

  public unwatch<T extends ConfigValueType>(configKey: string, callback?: WatchHandler<T>) {
    const handlers = this.handlersMap.get(configKey);
    if (!handlers) {
      return;
    }

    if (callback) {
      const index = handlers.findIndex((h) => h.handler == callback);
      if (index >= 0) {
        handlers?.splice(index, 1);
      }
    } else {
      handlers.splice(0);
    }
  }

  public getValue<T extends ConfigValueType>(configKey: string, defaultValue: T): T {
    this.validateDefaultValue(defaultValue);

    const configState = this.configSet?.configs[configKey];
    return this.getValueFromConfigState(configKey, configState, defaultValue);
  }

  private getValueFromConfigState<T extends ConfigValueType>(
    configKey: string,
    configState: ConfigState | undefined,
    defaultValue: T,
  ): T {
    if (!configState) {
      this.logger.debug(
        `[ConfigDirectorClient] No config state found for '${configKey}', returning default value '${defaultValue}'`,
      );
      this.usageEventCollector.evaluatedConfig({
        contextId: this.currentContext?.id,
        key: configKey,
        defaultValue: defaultValue,
        requestedType: getRequestedType(defaultValue),
        evaluatedValue: defaultValue,
        usedDefault: true,
        evaluationReason: "config-state-missing",
      });
      return defaultValue;
    }

    const parseResult = parseConfigValue<T>(configState, defaultValue);
    this.usageEventCollector.evaluatedConfig({
      contextId: this.currentContext?.id,
      key: configKey,
      defaultValue: defaultValue,
      requestedType: parseResult.requestedType,
      evaluatedValue: parseResult.parsedValue,
      usedDefault: parseResult.usedDefault,
      evaluationReason: parseResult.reason,
    });
    this.logger.debug(`[ConfigDirectorClient] Evaluated '${configKey}' to '${parseResult.parsedValue}'`);
    return parseResult.parsedValue;
  }

  private parseUrl(url: string | undefined): URL | undefined {
    if (!url) {
      return;
    }

    try {
      return new URL(url);
    } catch (error) {
      throw new ConfigDirectorValidationError(`Invalid base URL '${url}'. Parsing failed: ${error}`);
    }
  }

  private validateDefaultValue<T extends ConfigValueType>(defaultValue: T) {
    if (defaultValue === undefined || defaultValue === null) {
      throw new ConfigDirectorValidationError(
        "Invalid default value. The default value for a config must be defined and non-null.",
      );
    }

    if (typeof defaultValue === "function") {
      throw new ConfigDirectorValidationError(
        "Invalid default value. The default value for a config cannot be a function.",
      );
    }
  }

  public get isReady(): boolean {
    return this.ready;
  }

  public on<T extends keyof ClientEvents>(eventName: T, handler: (event: ClientEvents[T]) => void): void {
    this.eventEmitter.on(eventName, handler);
  }

  public off<T extends keyof ClientEvents>(eventName: T, handler?: (payload: ClientEvents[T]) => void) {
    this.eventEmitter.off(eventName, handler);
  }

  public clear() {
    this.logger.debug("[ConfigDirectorClient] clear() has been called, removing all observers");
    this.eventEmitter.clear();
    this.handlersMap.clear();
  }

  public unwatchAll() {
    this.handlersMap.clear();
  }

  public close() {
    this.logger.debug("[ConfigDirectorClient] close() has been called, closing connection to server");
    this.transport.close();
    this.ready = false;
  }

  public dispose() {
    this.clear();
    this.close();
  }
}
