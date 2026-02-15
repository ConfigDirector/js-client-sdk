# ConfigDirector JavaScript Client SDK

## Getting started

### 1. Install

Install from NPM:

```bash
npm install --save @configdirector/client-sdk
```

### 2. Create and initialize a client using your client SDK key

```ts
import { createClient } from "@configdirector/client-sdk";

const client = createClient("YOUR-CLIENT-SDK-KEY");
await client.initialize();
```

Alternatively initialize with a user context:

```ts
...

await client.initialize({
  id: "123456",
  name: "Example User",
  traits: {
    region: "North America", // Any arbitrary traits which can be referenced in targeting rules
  },
});
```

### 3. Retrieve config values

Retrieve a config value synchronously via `getValue`. The first argument is the config key, and the second the default value to be returned if the config state is not available. If `getValue` is called before initialization is complete, the default value will be returned.

```ts
client.getValue("my-string-config-key", "Default");

client.getValue("my-boolean-config-key", false);

client.getValue<MyEnum>("my-enum-config-key", MyEnum.SomeDefaultValue);
```

You can also subscribe to config value updates:

```ts
const unwatchMyKey = client.watch(
  "my-string-config-key",
  "Default",
  (newValue) => {
    console.log("Value updated:", newValue)
  },
);

unwatchMyKey(); // Call the unwatch function returned to remove the observer

client.unwatch("my-string-config-key"); // Removes all observers for that key
```

### 4. Updating the user context

Call `updateContext` to set a new user context for targeting rules evaluation:

```ts
await client.updateContext({
  id: "654321",
  name: "Another User",
  traits: {
    region: "Australia",
  },
});
```

## Getting Help

Reach out to us via https://www.configdirector.com/support
