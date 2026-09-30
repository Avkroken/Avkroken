import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeReleaseDeploymentRequests,
  sanitizeReleaseDeployments,
} from "../src/portal-release-deployment-model";

test("normalizes bounded repository and commit SHA requests", () => {
  const shaA = "a".repeat(40);
  const shaB = "b".repeat(40);
  const requests = normalizeReleaseDeploymentRequests([
    { repository: "Bastion", commitShas: [shaA, shaA, "bad", shaB] },
    { repository: "../Private", commitShas: [shaA] },
    { repository: "Bastion", commitShas: [shaB] },
  ]);

  assert.deepEqual(requests, [{
    repository: "Bastion",
    commitShas: [shaA, shaB],
  }]);
});

test("caps release deployment correlation requests", () => {
  const values = Array.from({ length: 12 }, (_, index) => ({
    repository: "Repo-" + index,
    commitShas: Array.from({ length: 25 }, (__, shaIndex) =>
      (shaIndex % 10).toString(16).repeat(40)
    ),
  }));

  const requests = normalizeReleaseDeploymentRequests(values);
  assert.equal(requests.length, 8);
  assert.ok(requests.every((item) => item.commitShas.length <= 10));
});

test("sanitizes exact-SHA deployment matches without forwarding provider payload", () => {
  const wanted = "a".repeat(40);
  const matches = sanitizeReleaseDeployments(
    "Bastion",
    [wanted],
    [
      {
        id: 123,
        sha: wanted.toUpperCase(),
        ref: "main",
        environment: "produktion",
        created_at: "2026-09-30T10:00:00Z",
        updated_at: "2026-09-30T10:01:00Z",
        payload: { secret: "MUST_NOT_LEAK" },
        creator: { login: "MUST_NOT_LEAK" },
        environment_url: "https://private.invalid/",
      },
      {
        id: 124,
        sha: "b".repeat(40),
        environment: "produktion",
        created_at: "2026-09-30T11:00:00Z",
      },
    ],
  );

  assert.deepEqual(matches, [{
    sha: wanted,
    environment: "produktion",
    createdAt: "2026-09-30T10:00:00Z",
    updatedAt: "2026-09-30T10:01:00Z",
  }]);

  const serialized = JSON.stringify(matches);
  for (const forbidden of [
    "MUST_NOT_LEAK",
    "payload",
    "creator",
    "environment_url",
    '"id"',
    '"ref"',
  ]) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
});

test("rejects malformed deployment timestamps while preserving an exact SHA observation", () => {
  const wanted = "c".repeat(40);
  assert.deepEqual(
    sanitizeReleaseDeployments("Bastion", [wanted], [{
      sha: wanted,
      environment: "x".repeat(121),
      created_at: "invalid",
      updated_at: null,
    }]),
    [{
      sha: wanted,
      environment: null,
      createdAt: null,
      updatedAt: null,
    }],
  );
});
