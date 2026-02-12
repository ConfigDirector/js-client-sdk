import { Emitter } from "./Emitter";
import { EventSourceTransport } from "./EventSourceTransport";
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
} from "./types";
import { createDefaultLogger } from "./logger";
import { TelemetryEventCollector } from "./telemetry";
import { ConfigDirectorValidationError } from "./errors";

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
  private transport: EventSourceTransport;
  private eventEmitter = new Emitter<ClientEvents>();
  private timeout: number = 3_000;
  private ready = false;
  private readyPromise: Promise<void> | undefined;
  private readyResolve: (() => void) | undefined;
  private currentContext?: ConfigDirectorContext;

  constructor(clientSdkKey: string, clientOptions?: ConfigDirectorClientOptions) {
    this.logger = clientOptions?.logger ?? createDefaultLogger();
    this.timeout = clientOptions?.connection?.timeout ?? 3_000;
    const baseUrl = this.parseUrl(clientOptions?.connection?.url) ?? defaultBaseUrl;
    this.usageEventCollector = new TelemetryEventCollector({
      sdkKey: clientSdkKey,
      logger: this.logger,
      baseUrl,
    });
    this.transport = new EventSourceTransport({
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
      this.ready = true;
      this.readyResolve?.();
      const configKeys = Object.keys(configSet.configs);
      if (!this.configSet || configSet.kind == "full") {
        this.configSet = configSet;
        this.eventEmitter.emit("configsUpdated", { keys: configKeys });
        this.updateWatchers(configSet.configs);
        this.logger.debug(`Replaced the entire configSet, kind is: ${configSet.kind}`);
      } else {
        this.configSet.configs = {
          ...this.configSet.configs,
          ...configSet.configs,
        };
        this.eventEmitter.emit("configsUpdated", { keys: configKeys });
        this.updateWatchers(configSet.configs);
        this.logger.debug(`Merged the incoming configSet map, kind is: ${configSet.kind}`);
      }
      this.logger.debug("ConfigState updated: ", this.configSet);
    });
  }

  public async initialize(context?: ConfigDirectorContext) {
    try {
      this.ready = false;
      this.readyPromise = new Promise<void>((resolve) => {
        this.readyResolve = resolve;
      });
      await this.transport.connect(context ?? {});
      this.currentContext = context;
      await Promise.race([
        this.readyPromise,
        new Promise<void>((resolve) => {
          setTimeout(() => resolve(), this.timeout);
        }),
      ]);
      if (!this.ready) {
        this.logger.warn(
          `Timed out waiting for initialization after ${this.timeout}ms. The client will continue to retry since there were no fatal errors detected.`,
        );
      }
    } catch (error) {
      this.logger.error("An error occurred during initialization: ", error);
    }
  }

  public async updateContext(context: ConfigDirectorContext) {
    await this.initialize(context);
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
        `No config state found for '${configKey}', returning default value '${defaultValue}'.`,
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

  public on<T extends keyof ClientEvents>(eventName: T, handler: (event: ClientEvents[T]) => void): void {
    this.eventEmitter.on(eventName, handler);
  }

  public off<T extends keyof ClientEvents>(eventName: T, handler?: (payload: ClientEvents[T]) => void) {
    this.eventEmitter.off(eventName, handler);
  }

  public clear() {
    this.eventEmitter.clear();
    this.handlersMap.clear();
  }

  public unwatchAll() {
    this.handlersMap.clear();
  }

  public close() {
    this.transport.close();
    this.ready = false;
  }

  public dispose() {
    this.clear();
    this.close();
  }
}
