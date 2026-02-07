import type { ConfigState, ConfigValueType } from "./types";

export function parseConfigValue<T extends ConfigValueType>(configState: ConfigState, defaultValue: T): T {
  const value = configState.value;
  const requestedType = typeof defaultValue;
  if (requestedType === "string") {
    return (value ?? defaultValue) as T;
  }

  if (requestedType === "boolean" && configState.type === "boolean") {
    return (parseConfigBoolean(value) ?? defaultValue) as T;
  }

  if (requestedType === "number" && configState.type === "number") {
    return (parseConfigNumber(value) ?? defaultValue) as T;
  }

  return (value ?? defaultValue) as T;
}

function parseConfigBoolean(value: string | null | undefined): boolean | undefined {
  if (!value) {
    return;
  }
  const lowerValue = value.toLowerCase();
  if (lowerValue != "true" && lowerValue != "false") {
    return;
  }

  return lowerValue === "true";
}

function parseConfigNumber(value: string | null | undefined): number | undefined {
  if (!value) {
    return;
  }

  const num = Number.parseFloat(value);

  if (isNaN(num) || !isFinite(num)) {
    return;
  }

  return num;
}
