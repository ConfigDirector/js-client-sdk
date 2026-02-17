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

/**
 * Creates a `ConfigDirectorClient` object with the given `clientSdkKey` and optional
 * `clientOptions`. The returned client needs to be initialized before it is ready to serve
 * config values.
 *
 * @param clientSdkKey The client SDK key obtained from the ConfigDirector dashboard
 * @param clientOptions {@link ConfigDirectorClientOptions} options for the client (optional)
 * @returns A {@link ConfigDirectorClient} object
 *
 * @example
 * import { createClient } from "@configdirector/client-sdk";
 * const client = createClient("YOUR-SDK-KEY");
 * await client.initialize();
 */
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
