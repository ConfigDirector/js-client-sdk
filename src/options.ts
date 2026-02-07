interface ArbitraryObject {
  [key: string]: unknown;
}

export type SdkGivenContext = {
  id?: string;
  name?: string;
  traits?: ArbitraryObject;
};

export type SdkMetaContext = {
  sdkVersion: string;
  userAgent?: string;
};

export type SdkOptions = {
  clientSdkKey: string;
  url?: string;
};
