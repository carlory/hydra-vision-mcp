import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { loadConfig } from "../src/config.js";
import { createServer } from "../src/mcp/server.js";
import { imageFile } from "./helpers.js";

test(
  "live Dragon/Kimi image tool via MCP SDK",
  { skip: process.env.HYDRA_LIVE_TEST !== "1", timeout: 240_000 },
  async () => {
    const config = loadConfig();
    assert.ok(config.apiKey, "HYDRA_API_KEY is required for live tests");
    const directory = await mkdtemp(path.join(tmpdir(), "hydra-live-"));
    const server = createServer(config);
    const client = new Client({ name: "hydra-live-test", version: "1.0.0" });
    const [a, b] = InMemoryTransport.createLinkedPair();
    try {
      await server.connect(b);
      await client.connect(a);
      const image = await imageFile(directory, [255, 0, 0]);
      const still = await client.callTool(
        {
          name: "analyze_image",
          arguments: {
            image_source: image,
            prompt: "What is the dominant color? Answer in English.",
          },
        },
        undefined,
        { timeout: 150_000 },
      );
      assert.notEqual(still.isError, true);
      assert.match(JSON.stringify(still.content), /red/i);
      console.log(JSON.stringify({ model: config.model, image: "passed" }));
    } finally {
      await client.close();
      await server.close();
      await rm(directory, { recursive: true, force: true });
    }
  },
);
