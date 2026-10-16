import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import * as prompts from "../src/prompts/index.js";

const digests = JSON.parse(
  await readFile(new URL("./fixtures/prompt-digests.json", import.meta.url), "utf8"),
) as Record<string, string>;

test("task prompts match their reviewed content digests", () => {
  assert.deepEqual(Object.keys(prompts).sort(), Object.keys(digests).sort());
  for (const [name, value] of Object.entries(prompts)) {
    const digest = createHash("sha256").update(JSON.stringify(value)).digest("hex");
    assert.equal(digest, digests[name], name);
  }
});
