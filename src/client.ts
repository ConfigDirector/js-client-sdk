import { Emitter } from "./events";
import { EventSourceTransport } from "./transport";
import { parseConfigValue } from "./value-parser";
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
} from "./types";

type WatchHandlerWithOptions<T extends ConfigValueType> = {
  handler: WatchHandler<T>;
  defaultValue: T;
  requestedType: string;
};

export class DefaultConfigDirectorClient implements ConfigDirectorClient {
  private configSet: ConfigSet | undefined;
  private handlersMap: Map<string, WatchHandlerWithOptions<any>[]> = new Map();
  private transport: EventSourceTransport;
  private eventEmitter = new Emitter<ClientEvents>();
  private timeout: number = 3_000;
  private ready = false;
  private readyPromise: Promise<void> | undefined;
  private readyResolve: (() => void) | undefined;

  constructor(clientSdkKey: string, clientOptions?: ConfigDirectorClientOptions) {
    this.timeout = clientOptions?.connection?.timeout ?? 3_000;
    this.transport = new EventSourceTransport({
      clientSdkKey,
      url: clientOptions?.connection?.url,
      metaContext: {
        ...clientOptions?.metadata,
        sdkVersion: "__VERSION__",
        userAgent: navigator?.userAgent,
      },
    });

    this.transport.on("configSetReceived", (configSet: ConfigSet) => {
      this.ready = true;
      this.readyResolve?.();
      if (!this.configSet || configSet.kind == "full") {
        this.configSet = configSet;
        this.eventEmitter.emit("configsUpdated");
        this.updateWatchers(configSet.configs);
        console.log(`Replaced the entire configSet, kind is: ${configSet.kind}`);
      } else {
        this.configSet.configs = {
          ...this.configSet.configs,
          ...configSet.configs,
        };
        this.eventEmitter.emit("configsUpdated");
        this.updateWatchers(configSet.configs);
        console.log(`Merged the incoming configSet map, kind is: ${configSet.kind}`);
      }
      console.log("ConfigState updated: ", this.configSet);
    });
  }

  public async initialize(context?: ConfigDirectorContext) {
    try {
      this.ready = false;
      this.readyPromise = new Promise<void>((resolve) => {
        this.readyResolve = resolve;
      });
      await this.transport.connect(context ?? {});
      await Promise.race([
        this.readyPromise,
        new Promise<void>((resolve) => {
          setTimeout(() => resolve(), this.timeout);
        }),
      ]);
      if (!this.ready) {
        console.warn(
          `Timed out waiting for initialization after ${this.timeout}ms. The client will continue to retry since there were no fatal errors detected.`,
        );
      }
    } catch (error) {
      console.error(error);
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
      const value = this.getValueFromConfigState(configState, h.defaultValue);
      h.handler(value);
    });
  }

  public watch<T extends ConfigValueType>(configKey: string, defaultValue: T, callback: WatchHandler<T>) {
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
    const configState = this.configSet?.configs[configKey];
    if (!configState || !configState.value) {
      console.log("No config state or value, returning default");
      return defaultValue;
    }

    return this.getValueFromConfigState(configState, defaultValue);
  }

  private getValueFromConfigState<T extends ConfigValueType>(
    configState: ConfigState | undefined,
    defaultValue: T,
  ): T {
    if (!configState) {
      return defaultValue;
    }

    return parseConfigValue<T>(configState, defaultValue);
  }

  public on(eventName: keyof ClientEvents, handler: (payload: ClientEvents[keyof ClientEvents]) => void) {
    this.eventEmitter.on(eventName, handler);
  }

  public off(eventName: keyof ClientEvents, handler?: (payload: ClientEvents[keyof ClientEvents]) => void) {
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
