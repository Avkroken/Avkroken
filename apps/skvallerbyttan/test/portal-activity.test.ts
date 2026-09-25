import test from "node:test";
import assert from "node:assert/strict";
import { buildPortalActivitySnapshot } from "../src/portal-activity-model";

function observed(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 2,
    available: true,
    status: "available",
    period: {
      days: 7,
      from: "2026-09-18T12:00:00Z",
      to: "2026-09-25T12:00:00Z",
    },
    grouped: [
      {
        provider: "github",
        capability: "github.avkroken.actions",
        event: "workflow_run",
        observedCount: 8,
      },
      {
        provider: "cloudflare",
        capability: "cloudflare.avkroken.workers",
        event: "update",
        observedCount: 99,
      },
      {
        provider: "github",
        capability: "github.avkroken.security",
        event: "secret_scanning_alert",
        observedCount: 2,
      },
    ],
    coverage: [
      {
        provider: "github",
        capability: "github.avkroken.actions",
        source: "webhook",
        coverage: "since_first_observation",
        firstObservedAt: "2026-09-18T12:30:00Z",
        lastObservedAt: "2026-09-25T11:30:00Z",
        periodComplete: false,
        sampling: "none",
        observedCount: 8,
      },
    ],
    recent: [
      {
        provider: "github",
        capability: "github.avkroken.actions",
        source: "webhook",
        coverage: "since_first_observation",
        event: "workflow_run",
        action: "completed",
        resourceType: "workflow_run",
        resourceId: "SECRET_RESOURCE_ID",
        repository: "Bastion",
        occurredAt: null,
        receivedAt: "2026-09-25T11:30:00Z",
        actor: "SECRET_ACTOR",
      },
      {
        provider: "github",
        capability: "github.avkroken.actions",
        source: "webhook",
        coverage: "since_first_observation",
        event: "workflow_run",
        action: "completed",
        repository: "PrivateRepo",
        receivedAt: "2026-09-25T11:20:00Z",
      },
      {
        provider: "github",
        capability: "github.avkroken.security",
        source: "webhook",
        coverage: "since_first_observation",
        event: "secret_scanning_alert",
        action: "created",
        repository: "Bastion",
        receivedAt: "2026-09-25T11:15:00Z",
      },
      {
        provider: "cloudflare",
        capability: "cloudflare.avkroken.workers",
        source: "audit_log",
        coverage: "partial",
        event: "update",
        action: "success",
        repository: null,
        receivedAt: "2026-09-25T11:10:00Z",
      },
    ],
    reason: "SECRET_PROVIDER_REASON",
    ...overrides,
  };
}

test("Portal activity snapshot publishes only allowed GitHub repository events", () => {
  const snapshot = buildPortalActivitySnapshot({
    generatedAt: "2026-09-25T12:01:00Z",
    organization: "Avkroken",
    repositoryNames: ["Bastion"],
    observed: observed(),
  });

  assert.equal(snapshot.schemaVersion, 1);
  assert.equal(snapshot.available, true);
  assert.equal(snapshot.status, "available");
  assert.equal(snapshot.repositoryCount, 1);
  assert.deepEqual(snapshot.period, {
    days: 7,
    from: "2026-09-18T12:00:00Z",
    to: "2026-09-25T12:00:00Z",
  });
  assert.deepEqual(snapshot.grouped, [{
    capability: "github.avkroken.actions",
    event: "workflow_run",
    observedCount: 8,
  }]);
  assert.equal(snapshot.recent.length, 1);
  assert.deepEqual(snapshot.recent[0], {
    repository: "Avkroken/Bastion",
    capability: "github.avkroken.actions",
    source: "webhook",
    coverage: "since_first_observation",
    event: "workflow_run",
    action: "completed",
    occurredAt: null,
    receivedAt: "2026-09-25T11:30:00Z",
  });

  const serialized = JSON.stringify(snapshot);
  for (const forbidden of [
    "SECRET_RESOURCE_ID",
    "SECRET_ACTOR",
    "SECRET_PROVIDER_REASON",
    "PrivateRepo",
    "cloudflare.avkroken.workers",
    "github.avkroken.security",
    "secret_scanning_alert",
    "resourceId",
    "resourceType",
    "actor",
    "reason",
  ]) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
});

test("Portal activity snapshot preserves coverage semantics without claiming completeness", () => {
  const snapshot = buildPortalActivitySnapshot({
    generatedAt: "2026-09-25T12:01:00Z",
    organization: "Avkroken",
    repositoryNames: ["Bastion"],
    observed: observed(),
  });

  assert.equal(snapshot.coverage.length, 1);
  assert.equal(snapshot.coverage[0].coverage, "since_first_observation");
  assert.equal(snapshot.coverage[0].periodComplete, false);
  assert.equal(snapshot.coverage[0].sampling, "none");
});

test("Portal activity snapshot hides provider error details", () => {
  const unavailable = buildPortalActivitySnapshot({
    generatedAt: "2026-09-25T12:01:00Z",
    organization: "Avkroken",
    repositoryNames: ["Bastion"],
    observed: {
      available: false,
      status: "error",
      reason: "SECRET_ACTIVITY_QUERY_FAILURE",
    },
  });

  assert.equal(unavailable.available, false);
  assert.equal(unavailable.status, "unavailable");
  assert.equal(JSON.stringify(unavailable).includes("SECRET_ACTIVITY_QUERY_FAILURE"), false);

  const notConfigured = buildPortalActivitySnapshot({
    generatedAt: "2026-09-25T12:01:00Z",
    organization: "Avkroken",
    repositoryNames: ["Bastion"],
    observed: {
      available: false,
      status: "not_configured",
      reason: "SECRET_D1_REASON",
    },
  });

  assert.equal(notConfigured.status, "not_configured");
  assert.equal(JSON.stringify(notConfigured).includes("SECRET_D1_REASON"), false);

  const notObserved = buildPortalActivitySnapshot({
    generatedAt: "2026-09-25T12:01:00Z",
    organization: "Avkroken",
    repositoryNames: [],
    observed: {
      available: false,
      status: "not_observed",
    },
  });

  assert.equal(notObserved.status, "not_observed");
  assert.equal(notObserved.repositoryCount, 0);
});
