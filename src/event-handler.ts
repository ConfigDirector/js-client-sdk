import type { ConfigSet, ConfigState, ConfigStateMap } from "./config";
import { parseConfigValue, type ConfigValueType } from "./type";

type GenericHandler<T extends ConfigValueType> = (message: T) => void;
type HandlerOptions<T extends ConfigValueType> = {
  handler: GenericHandler<T>;
  defaultValue: T;
  requestedType: string;
};

export interface ConfigSetEventHandler {
  handleConfigSetEvent(configSet: ConfigSet): void;
}

export class DefaultEventHandler implements ConfigSetEventHandler {
  private configSet: ConfigSet | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private handlers: { [key: string]: HandlerOptions<any>[] } = {};

  public handleConfigSetEvent(configSet: ConfigSet) {
    if (!this.configSet || configSet.kind == "full") {
      this.configSet = configSet;
      this.publishUpdates(configSet.configs);
      console.log(`Replaced the entire configSet, kind is: ${configSet.kind}`);
    } else {
      this.configSet.configs = {
        ...this.configSet.configs,
        ...configSet.configs,
      };
      this.publishUpdates(configSet.configs);
      console.log(`Merged the incoming configSet map, kind is: ${configSet.kind}`);
    }
    console.log("ConfigState updated: ", this.configSet);
  }

  private publishUpdates(configsMap: ConfigStateMap) {
    Object.values(configsMap).forEach((v) => this.publish(v));
  }

  private publish(configState: ConfigState) {
    this.handlers[configState.key]?.forEach((h) => {
      const value = this.getGenericValue(configState, h.defaultValue);
      h.handler(value);
    });
  }

  public publishDefaultValues() {
    Object.entries(this.handlers).forEach(([, handlers]) => {
      handlers.forEach((h) => h.handler(h.defaultValue));
    });
  }

  public subscribe<T extends ConfigValueType>(
    configKey: string,
    defaultValue: T,
    callback: (msg: T) => void,
  ) {
    if (!this.handlers[configKey]) {
      this.handlers[configKey] = [];
    }

    this.handlers[configKey]?.push({
      requestedType: typeof defaultValue,
      defaultValue,
      handler: callback,
    });

    const configState = this.configSet?.configs[configKey];
    if (configState) {
      callback(this.getGenericValue(configState, defaultValue));
    }
  }

  private getGenericValue<T extends ConfigValueType>(
    configState: ConfigState | undefined,
    defaultValue: T,
  ): T {
    if (!configState) {
      return defaultValue;
    }

    return parseConfigValue<T>(configState, defaultValue);
  }

  public getValue<T extends ConfigValueType>(configKey: string, defaultValue: T): T {
    const configState = this.configSet?.configs[configKey];
    if (!configState || !configState.value) {
      console.log("No config state or value, returning default");
      return defaultValue;
    }

    return this.getGenericValue(configState, defaultValue);
  }

  public clear() {
    this.handlers = {};
  }
}
