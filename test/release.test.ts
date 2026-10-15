import assert from "node:assert/strict";
import test from "node:test";
import { assertSnapshotPublish, releasePlan } from "../scripts/release-plan.mjs";

test("main snapshots use unique internal versions and only the latest tag", () => {
  assert.deepEqual(
    releasePlan({ event: "push", ref: "refs/heads/main", runId: "123456", runAttempt: "1" }),
    { version: "0.0.0-main.123456.1", tag: "latest" },
  );
  assert.deepEqual(
    releasePlan({ event: "push", ref: "refs/heads/main", runId: "123456", runAttempt: "2" }),
    { version: "0.0.0-main.123456.2", tag: "latest" },
  );
  assert.throws(
    () =>
      releasePlan({
        event: "push",
        ref: "refs/heads/main",
        runId: undefined,
        runAttempt: undefined,
      }),
    /run ID/,
  );
});

test("formal releases, tags, other branches and pull requests cannot publish", () => {
  for (const input of [
    { event: "release", ref: "refs/tags/v0.1.0" },
    { event: "push", ref: "refs/tags/v0.1.0" },
    { event: "push", ref: "refs/heads/feature" },
    { event: "pull_request", ref: "refs/heads/main" },
  ]) {
    assert.throws(
      () => releasePlan({ ...input, runId: "123456", runAttempt: "1" }),
      /Only pushes to main/,
    );
  }
});

test("publish hook rejects placeholders, formal versions and other dist-tags", () => {
  assert.doesNotThrow(() => assertSnapshotPublish("0.0.0-main.123456.1", "latest"));
  for (const version of ["0.0.0", "0.1.0", "0.1.0-main.123456.1"]) {
    assert.throws(() => assertSnapshotPublish(version, "latest"), /Only generated main snapshots/);
  }
  assert.throws(() => assertSnapshotPublish("0.0.0-main.123456.1", "stable"), /latest tag/);
});
