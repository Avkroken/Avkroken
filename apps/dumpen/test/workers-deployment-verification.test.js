import assert from "node:assert/strict";
import test from "node:test";

import {
  activeDeploymentVersions,
  deployedVersionId,
  deploymentIsActive,
} from "../scripts/workers-build-production.mjs";

test("structured Wrangler deploy output yields the deployed version id", () => {
  const output = [
    JSON.stringify({ type: "wrangler-session", version: 1 }),
    JSON.stringify({ type: "deploy", worker_name: "dumpen", version_id: "version-new" }),
  ].join("\n");

  assert.equal(deployedVersionId(output), "version-new");
  assert.throws(() => deployedVersionId('{"type":"wrangler-session"}'), /version_id/);
});

test("provider deployment status must route production traffic to the deployed version", () => {
  const active = {
    source: "wrangler",
    versions: [{ version_id: "version-new", percentage: 100 }],
  };
  assert.deepEqual(activeDeploymentVersions(active), [
    { versionId: "version-new", percentage: 100 },
  ]);
  assert.equal(deploymentIsActive(active, "version-new"), true);
  assert.equal(deploymentIsActive(active, "version-old"), false);

  assert.equal(deploymentIsActive({
    result: {
      versions: [{ version_id: "version-new", percentage: 50 }],
    },
  }, "version-new"), false);
});

test("provider deployment verification fails closed without active version state", () => {
  assert.throws(
    () => activeDeploymentVersions({ source: "unknown" }),
    /did not contain active versions/,
  );
});
