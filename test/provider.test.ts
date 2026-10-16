import assert from "node:assert/strict";
import test from "node:test";
import { loadConfig } from "../src/config.js";
import { VisionProvider } from "../src/providers/openai.js";
import { answer, mockProvider, signal } from "./helpers.js";

const messages = [
  { role: "system", content: "task prompt" },
  {
    role: "user",
    content: [
      { type: "image_url", image_url: { url: "https://example.com/image.png" } },
      { type: "text", text: "Inspect" },
    ],
  },
];

test("HYDRA configuration is independent of host-model credentials", () => {
  const config = loadConfig({
    HYDRA_BASE_URL: "http://localhost:8000/v1/",
    HYDRA_API_KEY: "hydra",
    ANTHROPIC_API_KEY: "other",
  });
  assert.equal(config.apiKey, "hydra");
  assert.equal(config.baseUrl, "http://localhost:8000/v1");
  assert.equal(loadConfig({ ANTHROPIC_AUTH_TOKEN: "other" }).apiKey, "");
  assert.throws(() => loadConfig({ HYDRA_TIMEOUT_MS: "0" }));
  assert.throws(() => loadConfig({ HYDRA_BASE_URL: "http://user:password@localhost/v1" }));
});

test("missing provider configuration fails before sending requests", async () => {
  await assert.rejects(
    new VisionProvider(loadConfig({ HYDRA_API_KEY: "key" })).complete(messages, signal()),
    /HYDRA_BASE_URL/,
  );
  await assert.rejects(
    new VisionProvider(loadConfig({ HYDRA_BASE_URL: "https://example.com/v1" })).complete(
      messages,
      signal(),
    ),
    /HYDRA_API_KEY/,
  );
});

test("provider preserves messages, request options and response text", async () => {
  let calls = 0;
  const mock = await mockProvider((body, response, request) => {
    calls++;
    assert.equal(request.url, "/v1/chat/completions");
    assert.equal(request.headers.authorization, "Bearer secret");
    assert.deepEqual(body, {
      model: "public/kimi-k3",
      messages,
      thinking: { type: "enabled" },
      stream: false,
      temperature: 0.8,
      top_p: 0.6,
      max_tokens: 131072,
    });
    answer(response, "  original response\n");
  });
  try {
    const provider = new VisionProvider(
      loadConfig({ HYDRA_API_KEY: "secret", HYDRA_BASE_URL: mock.baseUrl }),
    );
    assert.equal(await provider.complete(messages, signal()), "  original response\n");
    await provider.complete(messages, signal());
    assert.equal(calls, 2, "Every invocation sends its own provider request");
  } finally {
    await mock.close();
  }
});

test("provider returns upstream errors and leaves retries to tools", async () => {
  let calls = 0;
  const mock = await mockProvider((_body, response) => {
    calls++;
    response.writeHead(400).end("unsupported input");
  });
  try {
    const provider = new VisionProvider(
      loadConfig({ HYDRA_API_KEY: "key", HYDRA_BASE_URL: mock.baseUrl }),
    );
    await assert.rejects(provider.complete(messages, signal()), /HTTP 400: unsupported input/);
    assert.equal(calls, 1);
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(provider.complete(messages, controller.signal));
    assert.equal(calls, 1);
  } finally {
    await mock.close();
  }
});
