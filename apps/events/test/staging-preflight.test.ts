import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  MAX_STAGING_PREFLIGHT_AGE_MS,
  evaluateStagingProvisioningPreflightV1,
  type StagingInventorySnapshotV1,
} from "../src/staging-preflight.ts";
import type { RuntimeProvisioningPlanV1 } from "../src/runtime-gate.ts";

async function plan(): Promise<RuntimeProvisioningPlanV1> {
  return JSON.parse(
    await readFile(new URL("../runtime-provisioning.v1.json", import.meta.url), "utf8"),
  ) as RuntimeProvisioningPlanV1;
}

const NOW = Date.parse("2026-10-07T16:00:00.000Z");

function snapshot(): StagingInventorySnapshotV1 {
  return {
    schemaVersion: 1,
    observedAt: "2026-10-07T15:59:00.000Z",
    accountId: "account-1",
    coverage: {
      d1: "complete",
      queues: "complete",
      workers: "complete",
      controlPlane: "complete",
      providerDestinations: "complete",
    },
    providerDestinations: {
      githubUnchanged: true,
      cloudflareNotificationsUnchanged: true,
      cloudflareIssuesUnchanged: true,
      cloudflareCasbUnchanged: true,
    },
    controlPlane: {
      mechanism: "secrets_store_edge_proxy",
      credentialClass: "CLOUDFLARE_API_TOKEN_W1",
      serverSideOnly: true,
      credentialValueExported: false,
      permissionsVerified: true,
    },
    production: {
      databaseIds: ["prod-db"],
      queueIds: ["prod-queue", "prod-dlq"],
      workerNames: ["skvallerbyttan", "events", "ingest"],
    },
    databases: [],
    queues: [],
    workers: [],
  };
}

test("fresh complete inventory with all staging resources absent is ready to create", async () => {
  const result = evaluateStagingProvisioningPreflightV1(
    await plan(),
    snapshot(),
    "account-1",
    "repo-sha",
    NOW,
  );

  assert.equal(result.ready, true);
  assert.deepEqual(result.reasons, []);
  assert.deepEqual(
    Object.fromEntries(result.resources.map((item) => [item.kind + ":" + item.name, item.action])),
    {
      "database:avkroken-events-preview-eu": "create",
      "queue:avkroken-ingest-events-preview-v1-dlq": "create",
      "queue:avkroken-ingest-events-preview-v1": "create",
      "worker:events-staging": "create",
      "worker:ingest-staging": "create",
    },
  );
});

test("stale or incomplete live inventory blocks every create decision", async () => {
  const value = snapshot();
  value.observedAt = new Date(NOW - MAX_STAGING_PREFLIGHT_AGE_MS - 1).toISOString();
  value.coverage.queues = "partial";

  const result = evaluateStagingProvisioningPreflightV1(await plan(), value, "account-1", "repo-sha", NOW);
  assert.equal(result.ready, false);
  assert.ok(result.reasons.some((reason) => reason.includes("observedAt")));
  assert.ok(result.reasons.some((reason) => reason.includes("coverage.queues")));
  assert.ok(result.resources.every((item) => item.action === "blocked"));
});

test("missing required coverage key fails closed instead of proving absence", async () => {
  const value = snapshot() as StagingInventorySnapshotV1 & {
    coverage: Partial<StagingInventorySnapshotV1["coverage"]>;
  };
  delete value.coverage.queues;

  const result = evaluateStagingProvisioningPreflightV1(
    await plan(),
    value as StagingInventorySnapshotV1,
    "account-1",
    "repo-sha",
    NOW,
  );
  assert.equal(result.ready, false);
  assert.ok(result.reasons.some((reason) => reason.includes("coverage.queues")));
  assert.ok(result.resources.every((item) => item.action === "blocked"));
});

test("existing D1 must have proven ownership, EU jurisdiction, disabled replication and unique identity", async () => {
  const value = snapshot();
  value.databases.push({
    name: "avkroken-events-preview-eu",
    id: "staging-db",
    jurisdiction: "eu",
    readReplication: "disabled",
    ownershipConfirmed: true,
  });

  const ok = evaluateStagingProvisioningPreflightV1(await plan(), value, "account-1", "repo-sha", NOW);
  assert.equal(ok.ready, true);
  assert.equal(ok.resources.find((item) => item.kind === "database")?.action, "reuse");

  value.databases[0].jurisdiction = "unknown";
  const unknown = evaluateStagingProvisioningPreflightV1(await plan(), value, "account-1", "repo-sha", NOW);
  assert.equal(unknown.ready, false);
  assert.ok(unknown.reasons.some((reason) => reason.includes("database.jurisdiction")));

  value.databases[0].jurisdiction = "eu";
  value.databases[0].id = "prod-db";
  const reusedProduction = evaluateStagingProvisioningPreflightV1(await plan(), value, "account-1", "repo-sha", NOW);
  assert.equal(reusedProduction.ready, false);
  assert.ok(reusedProduction.reasons.some((reason) => reason.includes("production database")));
});

test("existing source Queue may be reused only with exact retention/DLQ and zero or exact consumer", async () => {
  const value = snapshot();
  value.queues.push(
    {
      name: "avkroken-ingest-events-preview-v1-dlq",
      id: "staging-dlq",
      messageRetentionSeconds: 345600,
      deadLetterQueue: null,
      ownershipConfirmed: true,
      consumers: [],
    },
    {
      name: "avkroken-ingest-events-preview-v1",
      id: "staging-queue",
      messageRetentionSeconds: 604800,
      deadLetterQueue: "avkroken-ingest-events-preview-v1-dlq",
      ownershipConfirmed: true,
      consumers: [],
    },
  );

  const partial = evaluateStagingProvisioningPreflightV1(await plan(), value, "account-1", "repo-sha", NOW);
  assert.equal(partial.ready, true);
  assert.equal(
    partial.resources.find((item) => item.name === "avkroken-ingest-events-preview-v1")?.action,
    "reuse",
  );

  value.queues[1].consumers = [{
    worker: "events-staging",
    maxBatchSize: 10,
    maxBatchTimeoutSeconds: 1,
    maxRetries: 5,
  }];
  value.workers.push({
    name: "events-staging",
    deploymentCommitSha: "repo-sha",
    ownershipConfirmed: true,
    publicRoutes: [],
    secretBindings: [],
    plainTextVars: [],
    otherBindings: [],
    triggers: [],
    d1Bindings: [],
    queueProducerBindings: [],
    queueConsumerBindings: [{
      queueId: "staging-queue",
      queueName: "avkroken-ingest-events-preview-v1",
    }],
  });
  const configured = evaluateStagingProvisioningPreflightV1(await plan(), value, "account-1", "repo-sha", NOW);
  assert.equal(configured.ready, true);

  value.queues[1].consumers[0].maxRetries = 3;
  const drift = evaluateStagingProvisioningPreflightV1(await plan(), value, "account-1", "repo-sha", NOW);
  assert.equal(drift.ready, false);
  assert.ok(drift.reasons.some((reason) => reason.includes("queue.consumer.maxRetries")));
});

test("staging workers fail closed on public routes, provider secrets or production resource bindings", async () => {
  const value = snapshot();
  value.workers.push({
    name: "events-staging",
    deploymentCommitSha: "repo-sha",
    ownershipConfirmed: true,
    publicRoutes: [],
    secretBindings: [],
    plainTextVars: [],
    otherBindings: [],
    triggers: [],
    d1Bindings: [{ binding: "EVENTS_DB", databaseId: "prod-db", databaseName: "avkroken-events-preview-eu" }],
    queueProducerBindings: [],
    queueConsumerBindings: [{
      queueId: "staging-queue",
      queueName: "avkroken-ingest-events-preview-v1",
    }],
  });
  value.workers.push({
    name: "ingest-staging",
    deploymentCommitSha: "repo-sha",
    ownershipConfirmed: true,
    publicRoutes: ["ingest-staging.example.invalid"],
    secretBindings: ["SKVALLERBYTTAN_WEBHOOK_SECRET"],
    plainTextVars: [],
    otherBindings: [],
    triggers: [],
    d1Bindings: [],
    queueProducerBindings: [{
      binding: "EVENTS_QUEUE",
      queueId: "prod-queue",
      queueName: "avkroken-ingest-events-preview-v1",
    }],
    queueConsumerBindings: [],
  });

  const result = evaluateStagingProvisioningPreflightV1(await plan(), value, "account-1", "repo-sha", NOW);
  assert.equal(result.ready, false);
  for (const fragment of [
    "worker.publicRoutes",
    "worker.secretBindings",
    "production database",
    "production queue",
  ]) {
    assert.ok(result.reasons.some((reason) => reason.includes(fragment)), fragment);
  }
});

test("duplicate planned names and wrong account/control-plane evidence block provisioning", async () => {
  const value = snapshot();
  value.databases.push(
    {
      name: "avkroken-events-preview-eu",
      id: "one",
      jurisdiction: "eu",
      readReplication: "disabled",
      ownershipConfirmed: true,
    },
    {
      name: "avkroken-events-preview-eu",
      id: "two",
      jurisdiction: "eu",
      readReplication: "disabled",
      ownershipConfirmed: true,
    },
  );
  value.controlPlane.credentialValueExported = true;
  value.controlPlane.permissionsVerified = false;
  value.providerDestinations.githubUnchanged = false;

  const result = evaluateStagingProvisioningPreflightV1(await plan(), value, "different-account", "repo-sha", NOW);
  assert.equal(result.ready, false);
  assert.ok(result.reasons.some((reason) => reason.includes("accountId")));
  assert.ok(result.reasons.some((reason) => reason.includes("credentialValueExported")));
  assert.ok(result.reasons.some((reason) => reason.includes("permissionsVerified")));
  assert.ok(result.reasons.some((reason) => reason.includes("providerDestinations.githubUnchanged")));
  assert.ok(result.reasons.some((reason) => reason.includes("multiple database resources")));
});


test("existing staging worker rejects unplanned bindings, vars and triggers", async () => {
  const value = snapshot();
  value.workers.push({
    name: "events-staging",
    deploymentCommitSha: "repo-sha",
    ownershipConfirmed: true,
    publicRoutes: [],
    secretBindings: [],
    plainTextVars: ["UNPLANNED_FLAG"],
    otherBindings: [{ type: "service", name: "UNPLANNED_SERVICE" }],
    triggers: ["0 * * * *"],
    d1Bindings: [],
    queueProducerBindings: [],
    queueConsumerBindings: [],
  });

  const result = evaluateStagingProvisioningPreflightV1(
    await plan(),
    value,
    "account-1",
    "repo-sha",
    NOW,
  );
  assert.equal(result.ready, false);
  for (const fragment of ["worker.plainTextVars", "worker.otherBindings", "worker.triggers"]) {
    assert.ok(result.reasons.some((reason) => reason.includes(fragment)), fragment);
  }
});

test("existing worker deployment and bound resource IDs must match current repository and inventory", async () => {
  const value = snapshot();
  value.databases.push({
    name: "avkroken-events-preview-eu",
    id: "staging-db",
    jurisdiction: "eu",
    readReplication: "disabled",
    ownershipConfirmed: true,
  });
  value.queues.push(
    {
      name: "avkroken-ingest-events-preview-v1-dlq",
      id: "staging-dlq",
      messageRetentionSeconds: 345600,
      deadLetterQueue: null,
      ownershipConfirmed: true,
      consumers: [],
    },
    {
      name: "avkroken-ingest-events-preview-v1",
      id: "staging-queue",
      messageRetentionSeconds: 604800,
      deadLetterQueue: "avkroken-ingest-events-preview-v1-dlq",
      ownershipConfirmed: true,
      consumers: [],
    },
  );
  value.workers.push({
    name: "events-staging",
    deploymentCommitSha: "old-sha",
    ownershipConfirmed: true,
    publicRoutes: [],
    secretBindings: [],
    plainTextVars: [],
    otherBindings: [],
    triggers: [],
    d1Bindings: [{
      binding: "EVENTS_DB",
      databaseId: "other-db",
      databaseName: "avkroken-events-preview-eu",
    }],
    queueProducerBindings: [],
    queueConsumerBindings: [{
      queueId: "other-queue",
      queueName: "avkroken-ingest-events-preview-v1",
    }],
  });

  const result = evaluateStagingProvisioningPreflightV1(
    await plan(),
    value,
    "account-1",
    "repo-sha",
    NOW,
  );
  assert.equal(result.ready, false);
  for (const fragment of [
    "worker.deploymentCommitSha",
    "D1 binding ID",
    "queue binding ID",
    "has no consumer",
  ]) {
    assert.ok(result.reasons.some((reason) => reason.includes(fragment)), fragment);
  }
});
