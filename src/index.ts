import { DefaultConfigDirectorClient } from "./client";
import { ConfigDirectorClientOptions, ConfigDirectorClient } from "./types";

export type { ConfigDirectorClient, ConfigDirectorClientOptions, ConfigDirectorContext, ConfigValueType } from "./types";

export const createClient = (
  clientSdkKey: string,
  clientOptions?: ConfigDirectorClientOptions,
): ConfigDirectorClient => {
  return new DefaultConfigDirectorClient(clientSdkKey, clientOptions);
};
