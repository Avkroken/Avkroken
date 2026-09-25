import test from "node:test";
import assert from "node:assert/strict";
import type { CapabilityObservation } from "../src/capabilities";
import { buildPortalOperationsSnapshot } from "../src/portal-observations";

function capability(overrides: Partial<CapabilityObservation> = {}): CapabilityObservation {
  return {
    key: "github.avkroken.actions",
    name: "Actions",
    provider: "github",
    scope: "repository",
    implemented: true,
    providerSupport: "supported",
    endpoint: "GET /private/provider/path",
    permission: "SECRET_PERMISSION_DETAIL",
    permissionLevel: "read",
    supports: ["runs"],
    cacheTtlMs: 60_000,
    status: "available",
    permissionState: "granted",
    dataState: "available",
    freshness: "fresh",
    lastAttemptAt: "2026-09-25T15:00:00Z",
    lastSuccessAt: "2026-09-25T15:00:00Z",
    lastHttpStatus: 200,
    lastError: "SECRET_LAST_ERROR",
    acceptedPermissions: "SECRET_ACCEPTED_PERMISSION",
    scopeCoverage: {
      expected: 4,
      observed: 4,
      available: 4,
      permissionDenied: 0,
      error: 0,
    },
    ...overrides,
  };
}

test("Portal operations snapshot exposes only curated capability/provider/activity fields", () => {
  const snapshot = buildPortalOperationsSnapshot({
    generatedAt: "2026-09-25T15:05:00Z",
    capabilities: [
      capability(),
      capability({
        key: "cloudflare.avkroken.workers",
        name: "Workers",
        provider: "cloudflare",
        status: "stale",
        freshness: "stale",
      }),
    ],
    providerHealth: {
      schemaVersion: 2,
      providers: {
        github: {
          status: "available",
          auth: {
            lastObservedAt: "2026-09-25T15:04:00Z",
            installation: {
              id: "SECRET_INSTALLATION_ID",
              permissions: { administration: "read" },
              tokenPermissions: "SECRET_TOKEN_PERMISSIONS",
            },
          },
          budget: { remaining: 4999 },
        },
        cloudflare: {
          status: "permission_denied",
          auth: {
            lastObservedAt: "2026-09-25T15:03:00Z",
            lastStatus: 403,
          },
          budget: { lastError: "SECRET_CF_ERROR" },
        },
      },
    },
    activity: {
      schemaVersion: 2,
      available: true,
      status: "available",
      period: {
        days: 1,
        from: "2026-09-24T15:05:00Z",
        to: "2026-09-25T15:05:00Z",
      },
      grouped: [
        {
          provider: "github",
          capability: "github.avkroken.actions",
          event: "workflow_run",
          observedCount: 7,
        },
        {
          provider: "cloudflare",
          capability: "cloudflare.avkroken.workers",
          event: "audit",
          observedCount: 2,
        },
      ],
      coverage: [
        {
          provider: "github",
          capability: "github.avkroken.actions",
          source: "webhook",
          coverage: "since_first_observation",
          firstObservedAt: "2026-09-24T15:06:00Z",
          lastObservedAt: "2026-09-25T15:04:00Z",
          periodComplete: false,
          sampling: "none",
          observedCount: 7,
        },
      ],
      recent: [
        {
          repository: "SECRET_PRIVATE_REPOSITORY",
          resourceId: "SECRET_RESOURCE_ID",
          action: "SECRET_ACTION",
        },
      ],
    },
  });

  assert.equal(snapshot.schemaVersion, 1);
  assert.equal(snapshot.providers[0].provider, "github");
  assert.equal(snapshot.providers[0].status, "available");
  assert.equal(snapshot.providers[1].status, "permission_denied");
  assert.equal(snapshot.activity.observedTotal, 9);
  assert.equal(snapshot.activity.byCapability[0].observedCount, 7);
  assert.equal(snapshot.activity.coverage[0].periodComplete, false);

  const serialized = JSON.stringify(snapshot);
  for (const forbidden of [
    "SECRET_PERMISSION_DETAIL",
    "SECRET_ACCEPTED_PERMISSION",
    "SECRET_LAST_ERROR",
    "SECRET_INSTALLATION_ID",
    "SECRET_TOKEN_PERMISSIONS",
    "SECRET_CF_ERROR",
    "SECRET_PRIVATE_REPOSITORY",
    "SECRET_RESOURCE_ID",
    "SECRET_ACTION",
    "lastHttpStatus",
    "acceptedPermissions",
    "recent",
    "endpoint",
  ]) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
});

test("Portal activity summary does not claim complete coverage when activity is unavailable", () => {
  const snapshot = buildPortalOperationsSnapshot({
    generatedAt: "2026-09-25T15:05:00Z",
    capabilities: [],
    providerHealth: { providers: {} },
    activity: {
      available: false,
      status: "not_configured",
      reason: "SECRET_DATABASE_REASON",
    },
  });

  assert.equal(snapshot.activity.available, false);
  assert.equal(snapshot.activity.status, "not_configured");
  assert.equal(snapshot.activity.period, null);
  assert.equal(snapshot.activity.observedTotal, 0);
  assert.deepEqual(snapshot.activity.coverage, []);
  assert.equal(JSON.stringify(snapshot).includes("SECRET_DATABASE_REASON"), false);
});
