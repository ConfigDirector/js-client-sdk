import { DefaultConfigDirectorClient } from "./DefaultConfigDirectorClient";
import { createDefaultLogger } from "./logger";
import {
  ConfigDirectorClientOptions,
  ConfigDirectorClient,
  ConfigDirectorLoggingLevel,
  ConfigDirectorLogMessageDecorator,
} from "./types";

export type {
  ConfigDirectorClient,
  ConfigDirectorClientOptions,
  ConfigDirectorContext,
  ConfigValueType,
  ConfigDirectorLogger,
  ConfigDirectorLoggingLevel,
  ConfigDirectorLogMessageDecorator,
} from "./types";

export type { ConfigDirectorConnectionError, ConfigDirectorValidationError } from "./errors";

export const createClient = (
  clientSdkKey: string,
  clientOptions?: ConfigDirectorClientOptions,
): ConfigDirectorClient => {
  return new DefaultConfigDirectorClient(clientSdkKey, clientOptions);
};

export const createConsoleLogger = (
  level: ConfigDirectorLoggingLevel,
  messageDecorator?: ConfigDirectorLogMessageDecorator,
) => {
  return createDefaultLogger(level, messageDecorator);
};
