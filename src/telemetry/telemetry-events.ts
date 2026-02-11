import { ConfigType, ConfigValueType, EvaluationReason } from "../types";

export type EvaluatedConfigEvent<T extends ConfigValueType> = {
  contextId?: string;
  key: string;
  type?: ConfigType;
  defaultValue: T;
  requestedType: string;
  evaluatedValue: T;
  usedDefault: boolean;
  evaluationReason: EvaluationReason;
};
