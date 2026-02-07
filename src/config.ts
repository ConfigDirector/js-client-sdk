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
