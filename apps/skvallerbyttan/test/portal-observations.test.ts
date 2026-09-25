import test from "node:test";
import assert from "node:assert/strict";
import type { CapabilityObservation } from "../src/capabilities";
import { buildPortalOperationsSnapshot } from "../src/portal-observations-model";

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

test("Portal operations snapshot exposes only public-safe status fields", () => {
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
  });

  assert.equal(snapshot.schemaVersion, 1);
  assert.equal(snapshot.providers[0].provider, "github");
  assert.equal(snapshot.providers[0].status, "available");
  assert.equal(snapshot.providers[1].status, "permission_denied");
  assert.equal(snapshot.capabilities[0].key, "cloudflare.avkroken.workers");
  assert.equal(snapshot.capabilities[1].key, "github.avkroken.actions");

  const serialized = JSON.stringify(snapshot);
  for (const forbidden of [
    "SECRET_PERMISSION_DETAIL",
    "SECRET_ACCEPTED_PERMISSION",
    "SECRET_LAST_ERROR",
    "SECRET_INSTALLATION_ID",
    "SECRET_TOKEN_PERMISSIONS",
    "SECRET_CF_ERROR",
    "lastHttpStatus",
    "acceptedPermissions",
    "scopeCoverage",
    "activity",
    "recent",
    "endpoint",
    "permissionState",
  ]) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
});
