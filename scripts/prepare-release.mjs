import { appendFileSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { releasePlan } from "./release-plan.mjs";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const plan = releasePlan({
  event: process.env.GITHUB_EVENT_NAME,
  ref: process.env.GITHUB_REF,
  runId: process.env.GITHUB_RUN_ID,
  runAttempt: process.env.GITHUB_RUN_ATTEMPT,
});
if (plan.version !== pkg.version) {
  execFileSync("npm", ["version", plan.version, "--no-git-tag-version", "--ignore-scripts"], {
    stdio: "inherit",
  });
}
appendFileSync(process.env.GITHUB_OUTPUT, `dist-tag=${plan.tag}\nversion=${plan.version}\n`);
console.log(`Prepared ${pkg.name}@${plan.version} with dist-tag ${plan.tag}`);
