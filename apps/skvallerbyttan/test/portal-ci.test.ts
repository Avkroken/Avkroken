import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPortalRepositoryCiSnapshot,
  publicCiRepository,
  type PortalCiRepositoryObservation,
} from "../src/portal-ci-model";

function observation(overrides: Partial<PortalCiRepositoryObservation> = {}): PortalCiRepositoryObservation {
  return {
    fullName: "Avkroken/Bastion",
    visibility: "public",
    archived: false,
    actions: {
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
      actor: "SECRET_ACTOR",
      headSha: "SECRET_SHA",
    },
    capabilities: {
      actions: true,
      permissionDetail: "SECRET_PERMISSION",
    },
    security: {
      secret: "SECRET_SECURITY",
    },
    ...overrides,
  };
}

test("Portal CI selector requires a public non-archived cached repository row", () => {
  const rows = [
    observation({ fullName: "Avkroken/Private", visibility: "private" }),
    observation({ fullName: "Avkroken/Archived", archived: true }),
    observation(),
  ];

  assert.equal(publicCiRepository(rows, "Avkroken/Private"), null);
  assert.equal(publicCiRepository(rows, "Avkroken/Archived"), null);
  assert.equal(publicCiRepository(rows, "Other/Bastion"), null);
  assert.equal(publicCiRepository(rows, "Avkroken/Bastion")?.fullName, "Avkroken/Bastion");
});

test("Portal CI snapshot exposes only public-safe sampled summary fields", () => {
  const snapshot = buildPortalRepositoryCiSnapshot({
    generatedAt: "2026-09-25T16:15:00Z",
    repository: "Avkroken/Bastion",
    observation: observation(),
    sourceRefreshedAt: "2026-09-25T16:10:00Z",
    freshness: "fresh",
  });

  assert.equal(snapshot.schemaVersion, 1);
  assert.equal(snapshot.repository, "Avkroken/Bastion");
  assert.equal(snapshot.available, true);
  assert.equal(snapshot.status, "available");
  assert.equal(snapshot.freshness, "fresh");
  assert.equal(snapshot.sourceRefreshedAt, "2026-09-25T16:10:00Z");
  assert.deepEqual(snapshot.coverage, {
    sampledRuns: 100,
    totalRuns: 321,
    sampleLimit: 100,
  });
  assert.equal(snapshot.summary?.failedLast24h, 1);
  assert.equal(snapshot.summary?.failedLast7d, 4);
  assert.equal(snapshot.summary?.passRate, 91 / 95);
  assert.equal(snapshot.summary?.medianDurationMs, 90_000);
  assert.equal(snapshot.summary?.mttrMedianMs, 600_000);

  const serialized = JSON.stringify(snapshot);
  for (const forbidden of [
    "SECRET_ACTOR",
    "SECRET_SHA",
    "SECRET_PERMISSION",
    "SECRET_SECURITY",
    "eventCounts",
    "capabilities",
    "visibility",
    "archived",
    "security",
  ]) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
});

test("Portal CI snapshot reports stale state without hiding the cached sample", () => {
  const snapshot = buildPortalRepositoryCiSnapshot({
    generatedAt: "2026-09-25T16:15:00Z",
    repository: "Avkroken/Bastion",
    observation: observation(),
    sourceRefreshedAt: "2026-09-25T08:00:00Z",
    freshness: "stale",
  });

  assert.equal(snapshot.available, true);
  assert.equal(snapshot.status, "available");
  assert.equal(snapshot.freshness, "stale");
  assert.equal(snapshot.coverage?.sampledRuns, 100);
  assert.equal(JSON.stringify(snapshot.summary).includes("sampledRuns"), false);
});

test("Portal CI snapshot distinguishes unavailable Actions from missing observation", () => {
  const unavailable = buildPortalRepositoryCiSnapshot({
    generatedAt: "2026-09-25T16:15:00Z",
    repository: "Avkroken/Bastion",
    observation: observation({
      actions: null,
      capabilities: { actions: false, reason: "SECRET_PROVIDER_REASON" },
    }),
    sourceRefreshedAt: "2026-09-25T16:10:00Z",
    freshness: "fresh",
  });

  assert.equal(unavailable.available, false);
  assert.equal(unavailable.status, "unavailable");
  assert.equal(unavailable.summary, null);
  assert.equal(JSON.stringify(unavailable).includes("SECRET_PROVIDER_REASON"), false);

  const missing = buildPortalRepositoryCiSnapshot({
    generatedAt: "2026-09-25T16:15:00Z",
    repository: "Avkroken/Bastion",
    observation: null,
    sourceRefreshedAt: null,
    freshness: "unknown",
  });

  assert.equal(missing.available, false);
  assert.equal(missing.status, "not_observed");
  assert.equal(missing.freshness, "unknown");
  assert.equal(missing.coverage, null);
});

test("Portal CI snapshot rejects repositories outside the Avkroken namespace", () => {
  assert.throws(() => buildPortalRepositoryCiSnapshot({
    generatedAt: "2026-09-25T16:15:00Z",
    repository: "Other/Private",
    observation: observation(),
    sourceRefreshedAt: "2026-09-25T16:10:00Z",
    freshness: "fresh",
  }));
});
