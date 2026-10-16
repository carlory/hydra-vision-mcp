import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const directory = await mkdtemp(path.join(tmpdir(), "hydra-package-"));
const npm = (args, cwd = root) =>
  execFileSync(process.execPath, [process.env.npm_execpath, ...args], {
    cwd,
    encoding: "utf8",
    timeout: 180_000,
    maxBuffer: 8 * 1024 * 1024,
  });
const server = createServer(async (request, response) => {
  try {
    assert.equal(request.url, "/v1/chat/completions");
    assert.equal(request.headers.authorization, "Bearer package-test-key");
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString());
    assert.equal(body.model, "package-test-model");
    assert.ok(body.messages[1].content.some((block) => block.type === "image_url"));
    response.setHeader("Content-Type", "application/json");
    response.end(
      JSON.stringify({
        choices: [{ message: { content: "Packaged image tool works" }, finish_reason: "stop" }],
      }),
    );
  } catch (error) {
    response.writeHead(500).end(String(error));
  }
});
let client;
try {
  const [archive] = JSON.parse(
    npm(["pack", "--silent", "--json", "--pack-destination", directory]),
  );
  assert.equal(archive.name, pkg.name);
  const files = archive.files.map((file) => file.path);
  for (const file of files)
    assert.match(
      file,
      /^(dist\/(?:[a-z-]+\/)*[^/]+\.(?:js|d\.ts)|docs\/[^/]+\.(?:md|json)|examples\/mcp\.json|package\.json|README\.md|SECURITY\.md|THIRD_PARTY_NOTICES\.md|LICENSES\/Apache-2\.0\.txt|LICENSE)$/,
    );
  for (const required of [
    "dist/index.js",
    "package.json",
    "LICENSE",
    "README.md",
    "examples/mcp.json",
    "dist/prompts/index.js",
    "dist/tools/video-analysis.js",
    "THIRD_PARTY_NOTICES.md",
    "LICENSES/Apache-2.0.txt",
  ])
    assert.ok(files.includes(required), `Missing ${required}`);
  assert.ok(
    archive.files.find((file) => file.path === "dist/index.js").mode & 0o111,
    "CLI must be executable",
  );
  await writeFile(path.join(directory, "package.json"), JSON.stringify({ private: true }));
  npm(
    [
      "install",
      path.join(directory, archive.filename),
      "--ignore-scripts",
      "--omit=dev",
      "--no-audit",
      "--no-fund",
      "--prefer-offline",
    ],
    directory,
  );
  const installed = path.join(
    directory,
    "node_modules",
    ...pkg.name.split("/"),
    "dist",
    "index.js",
  );
  assert.equal(
    execFileSync(process.execPath, [installed, "--version"], { encoding: "utf8" }).trim(),
    `${pkg.name} ${pkg.version}`,
  );
  assert.match(
    execFileSync(path.join(directory, "node_modules", ".bin", "hydra-vision-mcp"), ["--help"], {
      encoding: "utf8",
    }),
    /HYDRA_API_KEY/,
  );
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const image = path.join(directory, "pixel.png");
  await writeFile(
    image,
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6SAAAAABJRU5ErkJggg==",
      "base64",
    ),
  );
  client = new Client({ name: "package-smoke-test", version: "1.0.0" });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [installed],
    cwd: directory,
    stderr: "pipe",
    env: {
      HYDRA_API_KEY: "package-test-key",
      HYDRA_BASE_URL: `http://127.0.0.1:${address.port}/v1`,
      HYDRA_MODEL: "package-test-model",
    },
  });
  let stderr = "";
  transport.stderr?.on("data", (chunk) => {
    stderr += chunk.toString();
  });
  await client.connect(transport);
  assert.equal(client.getServerVersion().version, pkg.version);
  assert.equal((await client.listTools()).tools.length, 7);
  const result = await client.callTool({
    name: "analyze_image",
    arguments: { image_source: image, prompt: "Inspect" },
  });
  assert.notEqual(result.isError, true);
  assert.match(JSON.stringify(result.content), /Packaged image tool works/);
  assert.match(stderr, /registered successfully/);
  console.log(
    `Package verified: ${pkg.name}@${pkg.version}, ${files.length} files, isolated install and MCP stdio call passed`,
  );
} finally {
  await client?.close();
  server.closeAllConnections();
  if (server.listening) await new Promise((resolve) => server.close(resolve));
  await rm(directory, { recursive: true, force: true });
}
