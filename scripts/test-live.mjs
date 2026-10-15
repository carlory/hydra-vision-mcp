import { spawnSync } from "node:child_process";

const result = spawnSync(process.execPath, ["--import", "tsx", "--test", "test/live.test.ts"], {
  stdio: "inherit",
  env: { ...process.env, HYDRA_LIVE_TEST: "1" },
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
