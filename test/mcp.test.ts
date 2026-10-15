import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { loadConfig } from "../src/config.js";
import { createServer } from "../src/mcp/server.js";
import { imageFile, mockProvider, answer } from "./helpers.js";
import {
  DATA_VIZ_ANALYSIS_PROMPT,
  DIAGRAM_UNDERSTANDING_PROMPT,
  ERROR_DIAGNOSIS_PROMPT,
  GENERAL_IMAGE_ANALYSIS_PROMPT,
  TEXT_EXTRACTION_PROMPT,
  UI_DIFF_CHECK_PROMPT,
  UI_TO_ARTIFACT_PROMPTS,
} from "../src/prompts/index.js";

export const expectedTools = [
  "analyze_image",
  "analyze_data_visualization",
  "diagnose_error_screenshot",
  "extract_text_from_screenshot",
  "ui_diff_check",
  "ui_to_artifact",
  "understand_technical_diagram",
].sort();

test("seven image tools send task prompts, arguments and text-only responses", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "hydra-mcp-test-"));
  const file = await imageFile(directory);
  const requests: Record<string, unknown>[] = [];
  const mock = await mockProvider((body, response) => {
    requests.push(body);
    answer(response, "tool response");
  });
  const server = createServer(
    loadConfig({ HYDRA_API_KEY: "secret", HYDRA_BASE_URL: mock.baseUrl }),
  );
  const client = new Client({ name: "test-client", version: "1.0.0" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(b);
    await client.connect(a);
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map((tool) => tool.name).sort(), expectedTools);
    const cases: {
      name: string;
      system: string;
      question: string;
      extra?: Record<string, unknown>;
      images?: number;
    }[] = [
      { name: "analyze_image", system: GENERAL_IMAGE_ANALYSIS_PROMPT, question: "Inspect" },
      {
        name: "extract_text_from_screenshot",
        system: TEXT_EXTRACTION_PROMPT,
        question: "Inspect\n\n<language_hint>The code is in Python.</language_hint>",
        extra: { programming_language: "Python" },
      },
      {
        name: "diagnose_error_screenshot",
        system: ERROR_DIAGNOSIS_PROMPT,
        question: "Inspect\n\n<error_context>This error occurred during startup.</error_context>",
        extra: { context: "during startup" },
      },
      {
        name: "understand_technical_diagram",
        system: DIAGRAM_UNDERSTANDING_PROMPT,
        question: "Inspect\n\n<diagram_type_hint>This is a UML diagram.</diagram_type_hint>",
        extra: { diagram_type: "UML" },
      },
      {
        name: "analyze_data_visualization",
        system: DATA_VIZ_ANALYSIS_PROMPT,
        question: "Inspect\n\n<analysis_focus>Focus particularly on: trends.</analysis_focus>",
        extra: { analysis_focus: "trends" },
      },
      {
        name: "ui_diff_check",
        system: UI_DIFF_CHECK_PROMPT,
        question:
          "<images>\nThe first image is the EXPECTED/REFERENCE design (the target).\nThe second image is the ACTUAL/CURRENT implementation (what needs to be checked).\n</images>\n\nInspect",
        images: 2,
      },
      ...(["code", "prompt", "spec", "description"] as const).map((type) => ({
        name: "ui_to_artifact",
        system: UI_TO_ARTIFACT_PROMPTS[type],
        question: "Inspect",
        extra: { output_type: type },
      })),
    ];
    for (const item of cases) {
      const args =
        item.images === 2
          ? { expected_image_source: file, actual_image_source: file, prompt: "Inspect" }
          : { image_source: file, prompt: "Inspect", ...item.extra };
      const result = await client.callTool({ name: item.name, arguments: args });
      assert.deepEqual(result, { content: [{ type: "text", text: "tool response" }] });
      const messages = requests.at(-1)!.messages as { role: string; content: unknown }[];
      assert.deepEqual(messages[0], { role: "system", content: item.system });
      const content = messages[1]!.content as {
        type: string;
        text?: string;
        image_url?: { url: string };
      }[];
      assert.equal(content.length, (item.images ?? 1) + 1);
      assert.ok(
        content
          .slice(0, -1)
          .every(
            (block) =>
              block.type === "image_url" &&
              block.image_url?.url.startsWith("data:image/png;base64,"),
          ),
      );
      assert.deepEqual(content.at(-1), { type: "text", text: item.question });
    }
    const invalid = await client.callTool({
      name: "ui_to_artifact",
      arguments: { image_source: file, prompt: "Inspect", output_type: "invalid" },
    });
    assert.equal(invalid.isError, true);
  } finally {
    await client.close();
    await server.close();
    await mock.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("remote image URLs are forwarded unchanged without local media downloads", async () => {
  let body: Record<string, unknown> = {};
  const mock = await mockProvider((request, response) => {
    body = request;
    answer(response, "remote image");
  });
  const server = createServer(
    loadConfig({ HYDRA_API_KEY: "secret", HYDRA_BASE_URL: mock.baseUrl }),
  );
  const client = new Client({ name: "remote-image", version: "1.0.0" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(b);
    await client.connect(a);
    const url = "https://media.example.invalid/screenshot.png";
    const result = await client.callTool({
      name: "analyze_image",
      arguments: { image_source: url, prompt: "Inspect" },
    });
    assert.notEqual(result.isError, true);
    const messages = body.messages as {
      content: { type: string; image_url?: { url: string } }[];
    }[];
    assert.deepEqual(messages[1]!.content[0], { type: "image_url", image_url: { url } });
  } finally {
    await client.close();
    await server.close();
    await mock.close();
  }
});

test("independent MCP servers keep provider credentials isolated during concurrent calls", async () => {
  const contexts = await Promise.all(
    ["first", "second"].map(async (key) => {
      const mock = await mockProvider((_body, response, request) => {
        assert.equal(request.headers.authorization, `Bearer ${key}`);
        answer(response, key);
      });
      const server = createServer(loadConfig({ HYDRA_API_KEY: key, HYDRA_BASE_URL: mock.baseUrl }));
      const client = new Client({ name: key, version: "1.0.0" });
      const [a, b] = InMemoryTransport.createLinkedPair();
      await server.connect(b);
      await client.connect(a);
      return { key, mock, server, client };
    }),
  );
  try {
    await Promise.all(
      contexts.map(async ({ key, client }) => {
        const result = await client.callTool({
          name: "analyze_image",
          arguments: { image_source: "https://example.invalid/image.png", prompt: "Inspect" },
        });
        assert.deepEqual(result.content, [{ type: "text", text: key }]);
      }),
    );
  } finally {
    await Promise.all(
      contexts.map(async ({ client, server, mock }) => {
        await client.close();
        await server.close();
        await mock.close();
      }),
    );
  }
});

test("stdio exposes seven tools and sends tool logs to stderr", async () => {
  const client = new Client({ name: "stdio-test", version: "1.0.0" });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["--import", "tsx", "src/index.ts"],
    cwd: process.cwd(),
    stderr: "pipe",
  });
  let stderr = "";
  transport.stderr?.on("data", (data: Buffer) => {
    stderr += data.toString();
  });
  try {
    await client.connect(transport);
    assert.deepEqual(
      (await client.listTools()).tools.map((tool) => tool.name).sort(),
      expectedTools,
    );
    assert.match(stderr, /registered successfully/);
  } finally {
    await client.close();
  }
});
