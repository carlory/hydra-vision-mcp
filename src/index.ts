#!/usr/bin/env node
import { Console } from "node:console";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { createServer } from "./mcp/server.js";
import { packageInfo } from "./package-info.js";

async function main() {
  const command = process.argv[2] ?? "serve";
  if (command === "--version") {
    process.stdout.write(`${packageInfo.name} ${packageInfo.version}\n`);
    return;
  }
  if (["--help", "-h"].includes(command)) {
    process.stdout.write(
      "hydra-vision-mcp [serve]\n\nEnvironment: HYDRA_API_KEY, HYDRA_BASE_URL, HYDRA_MODEL\nTransport: stdio. Seven image tools; video is not registered.\n",
    );
    return;
  }
  if (command !== "serve") throw new Error(`Unknown command: ${command}`);
  globalThis.console = new Console({ stdout: process.stderr, stderr: process.stderr });
  const server = createServer(loadConfig());
  process.once("SIGTERM", () => {
    void server.close();
  });
  process.once("SIGINT", () => {
    void server.close();
  });
  await server.connect(new StdioServerTransport());
}

main().catch((error: unknown) => {
  process.stderr.write(
    `hydra-vision-mcp: ${error instanceof Error ? error.message : "startup failed"}\n`,
  );
  process.exitCode = 1;
});
