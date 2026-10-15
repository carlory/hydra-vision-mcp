export function releasePlan({ event, ref, runId, runAttempt }) {
  if (event !== "push" || ref !== "refs/heads/main") {
    throw new Error("Only pushes to main can publish");
  }
  if (![runId, runAttempt].every((value) => /^[1-9]\d*$/.test(value ?? ""))) {
    throw new Error("Snapshot publishing requires a GitHub run ID and attempt");
  }
  return { version: `0.0.0-main.${runId}.${runAttempt}`, tag: "latest" };
}

export function assertSnapshotPublish(version, tag) {
  if (!/^0\.0\.0-main\.[1-9]\d*\.[1-9]\d*$/.test(version) || tag !== "latest") {
    throw new Error("Only generated main snapshots may publish, using the latest tag");
  }
}
