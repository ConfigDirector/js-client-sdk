import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createClient, createConsoleLogger } from "../src";
import { setupServer } from "msw/node";
import { http } from "msw";

const SSE_URL = "https://client-sdk-api.configdirector.com/sse" as const;
const buildResponse = (stream: ReadableStream) => {
  return new Response(stream, {
    headers: {
      connection: "keep-alive",
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
    },
  });
};

const message = (data: any) => {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
};

const server = setupServer();
const logger = createConsoleLogger("debug");

describe("ConfigDirectorClient", () => {
  beforeAll(() => {
    server.listen({ onUnhandledRequest: "error" });
  });
  beforeEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it("establishes a valid connection on initialize", async () => {
    let requestJson: any = undefined;
    server.use(
      http.post(SSE_URL, async ({ request }) => {
        requestJson = await request.json();
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(message({ environmentId: 100, projectId: 200, kind: "full", configs: {} }));
          },
        });

        return buildResponse(stream);
      }),
    );
    const client = createClient("sdk-key", { logger });
    await client.initialize();

    expect(requestJson).toMatchObject(expect.objectContaining({ clientSdkKey: "sdk-key" }));
    expect(requestJson?.givenContext).toEqual({});
    expect(requestJson?.metaContext).toMatchObject(
      expect.objectContaining({
        sdkVersion: "__VERSION__",
        userAgent: expect.stringContaining("Mozilla"),
      }),
    );
  });

  it("returns the default value when the config was not sent from the server", async () => {
    server.use(
      http.post(SSE_URL, async () => {
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(message({ environmentId: 100, projectId: 200, kind: "full", configs: {} }));
          },
        });

        return buildResponse(stream);
      }),
    );
    const client = createClient("sdk-key", { logger });
    await client.initialize();

    expect(client.getValue("example-config", "Hello")).toBe("Hello");
    expect(client.getValue("example-config", 20)).toBe(20);
    expect(client.getValue("example-config", new URL("http://example.com"))).toEqual(
      new URL("http://example.com"),
    );
  });

  it("returns the evaluated config value when the server sends the config set", async () => {
    server.use(
      http.post(SSE_URL, async () => {
        const stream = new ReadableStream({
          start(controller) {
            setTimeout(() => {
              controller.enqueue(
                message({
                  environmentId: 100,
                  projectId: 200,
                  kind: "full",
                  configs: {
                    "example-config": { id: 1000, key: "example-config", type: "string", value: "Bye" },
                  },
                }),
              );
            }, 500);
          },
        });

        return buildResponse(stream);
      }),
    );

    const client = createClient("sdk-key", { logger });
    const subscription = new Promise<string>((resolve) => {
      client.watch("example-config", "DummyDefault", (value) => {
        resolve(value);
      });
    });
    await client.initialize();

    expect(client.getValue("example-config", "Hello")).toBe("Bye");
    expect(await subscription).toBe("Bye");
    expect(client.getValue("example-config", 20)).toBe("Bye");
  });

  it("publishes 'configsUpdated' each time the server sends updates", async () => {
    server.use(
      http.post(SSE_URL, async () => {
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(
              message({
                environmentId: 100,
                projectId: 200,
                kind: "full",
                configs: {
                  "example-config": { id: 1000, key: "example-config", type: "string", value: "Hello" },
                },
              }),
            );

            setTimeout(() => {
              controller.enqueue(
                message({
                  environmentId: 100,
                  projectId: 200,
                  kind: "delta",
                  configs: {
                    "example-config": { id: 1000, key: "example-config", type: "string", value: "Bye" },
                  },
                }),
              );
            }, 10);
          },
        });

        return buildResponse(stream);
      }),
    );

    const client = createClient("sdk-key", { logger });
    const subscription = new Promise<number>((resolve) => {
      let counter = 0;
      client.on("configsUpdated", () => {
        counter += 1;
      });
      setTimeout(() => resolve(counter), 100);
    });
    await client.initialize();

    expect(await subscription).toBe(2);
  });

  it("re-establishes a connection on updateContext", async () => {
    const requestsJson: any[] = [];
    server.use(
      http.post(SSE_URL, async ({ request }) => {
        requestsJson.push(await request.json());
        const stream = new ReadableStream({
          start(controller) {
            let configs = {};
            if (requestsJson.length > 1) {
              configs = {
                "example-config": { id: 1000, key: "example-config", type: "string", value: "Bye" },
              };
            }
            controller.enqueue(
              message({
                environmentId: 100,
                projectId: 200,
                kind: "full",
                configs,
              }),
            );
          },
        });

        return buildResponse(stream);
      }),
    );

    const client = createClient("sdk-key", { logger });

    await client.initialize();
    expect(client.getValue("example-config", "Hello")).toBe("Hello");

    await client.updateContext({ id: "123456", name: "Bob", traits: { email: "bob@example.com" } });
    expect(client.getValue("example-config", "Hello")).toBe("Bye");
    expect(requestsJson).toHaveLength(2);
    expect(requestsJson.map((j) => j.clientSdkKey)).toEqual(["sdk-key", "sdk-key"]);
    expect(requestsJson[0]?.givenContext).toEqual({});
    expect(requestsJson[1]?.givenContext).toEqual({
      id: "123456",
      name: "Bob",
      traits: { email: "bob@example.com" },
    });
  });
});
