import type { ConfigState, ConfigValueType, EvaluationReason } from "./types";

type RequestedType =
  | "string"
  | "number"
  | "bigint"
  | "boolean"
  | "symbol"
  | "undefined"
  | "object"
  | "function";

type ParseResult<T extends ConfigValueType> = {
  parsedValue: T;
  requestedType: RequestedType | string;
  usedDefault: boolean;
  reason: EvaluationReason;
};

export const getRequestedType = <T extends ConfigValueType>(defaultValue: T): string => {
  const baseType = typeof defaultValue;
  if (baseType === "object") {
    try {
      return (defaultValue as object).constructor?.name ?? baseType;
    } catch {
      return baseType;
    }
  } else if (baseType === "function") {
    try {
      const functionName = (defaultValue as any).name;
      return functionName ? `function: ${functionName}` : baseType;
    } catch {
      return baseType;
    }
  }
  return baseType;
};

export function parseConfigValue<T extends ConfigValueType>(
  configState: ConfigState,
  defaultValue: T,
): ParseResult<T> {
  const value = configState.value;
  const requestedType = getRequestedType(defaultValue);

  if (!value) {
    return {
      parsedValue: defaultValue as T,
      requestedType,
      usedDefault: true,
      reason: "value-missing",
    };
  }

  if (requestedType === "string") {
    return {
      parsedValue: value as T,
      requestedType,
      usedDefault: false,
      reason: "found-match",
    };
  }

  if (requestedType === "boolean" && configState.type === "boolean") {
    const boolValue = parseConfigBoolean(value);
    const hasBoolean = typeof boolValue === "boolean";
    return {
      parsedValue: (hasBoolean ? boolValue : defaultValue) as T,
      requestedType,
      usedDefault: !hasBoolean,
      reason: hasBoolean ? "found-match" : "invalid-boolean",
    };
  }

  if (requestedType === "number" && configState.type === "number") {
    const numValue = parseConfigNumber(value);
    const hasNumber = typeof numValue === "number";
    return {
      parsedValue: (hasNumber ? numValue : defaultValue) as T,
      requestedType,
      usedDefault: !hasNumber,
      reason: hasNumber ? "found-match" : "invalid-number",
    };
  }

  return {
    parsedValue: value as T,
    requestedType,
    usedDefault: false,
    reason: "found-match",
  };
}

function parseConfigBoolean(value: string): boolean | undefined {
  if (!value) {
    return;
  }
  const lowerValue = value.toLowerCase();
  if (lowerValue != "true" && lowerValue != "false") {
    return;
  }

  return lowerValue === "true";
}

function parseConfigNumber(value: string): number | undefined {
  if (!value) {
    return;
  }

  const num = Number.parseFloat(value);

  if (isNaN(num) || !isFinite(num)) {
    return;
  }

  return num;
}
