import { readFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";

const { name, version } = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);
const url = `https://registry.npmjs.org/${encodeURIComponent(name)}/${encodeURIComponent(version)}`;
const deadline = Date.now() + 15 * 60_000;
let available = false;
while (Date.now() < deadline) {
  let response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(10_000), cache: "no-store" });
  } catch (error) {
    console.log(`Registry unavailable: ${error.message}`);
  }
  if (response) {
    if (response.ok) {
      const manifest = await response.json();
      if (manifest.name !== name || manifest.version !== version) {
        throw new Error("Registry returned an unexpected package manifest");
      }
      available = true;
      console.log(`Available on npm: ${name}@${version}`);
      break;
    }
    await response.body?.cancel();
    if (response.status !== 404 && response.status !== 429 && response.status < 500) {
      throw new Error(`Registry returned HTTP ${response.status}`);
    }
  }
  console.log(`Waiting for npm processing: ${name}@${version}`);
  await delay(15_000);
}
if (!available) {
  throw new Error(
    "npm accepted publication but the version is not available yet. Check package status before retrying; do not republish the same version.",
  );
}
