import test from "node:test";
import assert from "node:assert/strict";
import { buildPortalRepositoryCiSnapshot } from "../src/portal-ci-model";

function actions(overrides: Record<string, unknown> = {}) {
  return {
    available: true,
    summary: {
      totalRuns: 321,
      sampledRuns: 100,
      completedSample: 97,
      successfulSample: 91,
      failedSample: 4,
      cancelledSample: 2,
      inProgressSample: 3,
      passRate: 91 / 95,
      failedLast24h: 1,
      failedLast7d: 4,
      eventCounts: { push: 80, pull_request: 20 },
      latestFailureAt: "2026-09-25T16:00:00Z",
      medianDurationMs: 90_000,
      p95DurationMs: 300_000,
      mttrMedianMs: 600_000,
      mttrSampleCount: 3,
    },
    runs: [
      {
        id: 123,
        name: "CI",
        display_title: "feat: example",
        event: "push",
        status: "completed",
        conclusion: "success",
        actor: { login: "SECRET_ACTOR" },
        created_at: "2026-09-25T16:10:00Z",
        updated_at: "2026-09-25T16:12:00Z",
        html_url: "https://github.com/Avkroken/Bastion/actions/runs/123",
        head_sha: "SECRET_SHA",
        head_branch: "SECRET_BRANCH",
      },
      {
        id: 124,
        name: "CI",
        display_title: "invalid canonical URL",
        event: "push",
        status: "completed",
        conclusion: "failure",
        created_at: "2026-09-25T15:10:00Z",
        updated_at: "2026-09-25T15:12:00Z",
        html_url: "https://github.com/Avkroken/Other/actions/runs/124",
      },
    ],
    status: 200,
    reason: "SECRET_PROVIDER_REASON",
    acceptedPermissions: "SECRET_ACCEPTED_PERMISSIONS",
    ...overrides,
  };
}

test("Portal CI snapshot exposes only public-safe summary and canonical run fields", () => {
  const snapshot = buildPortalRepositoryCiSnapshot({
    generatedAt: "2026-09-25T16:15:00Z",
    repository: "Avkroken/Bastion",
    actions: actions() as any,
  });

  assert.equal(snapshot.schemaVersion, 1);
  assert.equal(snapshot.repository, "Avkroken/Bastion");
  assert.equal(snapshot.available, true);
  assert.equal(snapshot.status, "available");
  assert.equal(snapshot.coverage.providerSampleLimit, 100);
  assert.equal(snapshot.coverage.recentRunsLimit, 12);
  assert.equal(snapshot.summary?.totalRuns, 321);
  assert.equal(snapshot.summary?.failedLast7d, 4);
  assert.equal(snapshot.recentRuns.length, 1);
  assert.deepEqual(snapshot.recentRuns[0], {
    id: 123,
    name: "CI",
    title: "feat: example",
    event: "push",
    status: "completed",
    conclusion: "success",
    createdAt: "2026-09-25T16:10:00Z",
    updatedAt: "2026-09-25T16:12:00Z",
    url: "https://github.com/Avkroken/Bastion/actions/runs/123",
  });

  const serialized = JSON.stringify(snapshot);
  for (const forbidden of [
    "SECRET_ACTOR",
    "SECRET_SHA",
    "SECRET_BRANCH",
    "SECRET_PROVIDER_REASON",
    "SECRET_ACCEPTED_PERMISSIONS",
    "acceptedPermissions",
    "actor",
    "head_sha",
    "head_branch",
    "eventCounts",
  ]) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
});

test("Portal CI snapshot does not expose provider failure details", () => {
  const snapshot = buildPortalRepositoryCiSnapshot({
    generatedAt: "2026-09-25T16:15:00Z",
    repository: "Avkroken/Bastion",
    actions: actions({
      available: false,
      summary: null,
      runs: [],
      status: 403,
      reason: "SECRET_DENIED_REASON",
      acceptedPermissions: "SECRET_PERMISSION",
    }) as any,
  });

  assert.equal(snapshot.available, false);
  assert.equal(snapshot.status, "unavailable");
  assert.equal(snapshot.summary, null);
  assert.deepEqual(snapshot.recentRuns, []);
  assert.equal(JSON.stringify(snapshot).includes("SECRET_DENIED_REASON"), false);
  assert.equal(JSON.stringify(snapshot).includes("SECRET_PERMISSION"), false);
});

test("Portal CI snapshot rejects repositories outside the public Avkroken namespace", () => {
  assert.throws(() => buildPortalRepositoryCiSnapshot({
    generatedAt: "2026-09-25T16:15:00Z",
    repository: "Other/Private",
    actions: actions() as any,
  }));
});
