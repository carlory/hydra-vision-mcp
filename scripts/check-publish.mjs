import { readFileSync } from "node:fs";
import { assertSnapshotPublish } from "./release-plan.mjs";

const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
assertSnapshotPublish(version, process.env.npm_config_tag ?? "latest");
