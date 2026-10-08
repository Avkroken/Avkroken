import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  collectStagingInventorySnapshotV1,
  type StagingInventoryEvidenceV1,
  type StagingInventoryReadPortV1,
} from "../src/staging-inventory-collector.ts";
import { evaluateStagingProvisioningPreflightV1 } from "../src/staging-preflight.ts";
import type { RuntimeProvisioningPlanV1 } from "../src/runtime-gate.ts";

async function plan(): Promise<RuntimeProvisioningPlanV1> {
  return JSON.parse(
    await readFile(new URL("../runtime-provisioning.v1.json", import.meta.url), "utf8"),
  ) as RuntimeProvisioningPlanV1;
}

function evidence(): StagingInventoryEvidenceV1 {
  return {
    observedAt: "2026-10-07T16:10:00.000Z",
    accountId: "account-1",
    coverage: {
      controlPlane: "complete",
      providerDestinations: "complete",
    },
    controlPlane: {
      mechanism: "secrets_store_edge_proxy",
      credentialClass: "CLOUDFLARE_API_TOKEN_W1",
      serverSideOnly: true,
      credentialValueExported: false,
      permissionsVerified: true,
    },
    providerDestinations: {
      githubUnchanged: true,
      cloudflareNotificationsUnchanged: true,
      cloudflareIssuesUnchanged: true,
      cloudflareCasbUnchanged: true,
    },
    production: {
      databaseIds: ["prod-db"],
      queueIds: ["prod-queue"],
      workerNames: ["skvallerbyttan"],
    },
    ownership: {
      databaseIds: [],
      queueIds: [],
      workerNames: [],
    },
  };
}

function reader(overrides: Partial<StagingInventoryReadPortV1> = {}): StagingInventoryReadPortV1 {
  return {
    getAccountId: async () => "account-1",
    listDatabases: async () => [],
    listQueues: async () => [],
    listQueueConsumers: async () => [],
    listWorkers: async () => [],
    inspectWorker: async (name) => ({
      name,
      deploymentCommitSha: null,
      publicRoutes: [],
      secretBindings: [],
      plainTextVars: [],
      otherBindings: [],
      triggers: [],
      d1Bindings: [],
      queueProducerBindings: [],
      queueConsumerBindings: [],
    }),
    ...overrides,
  };
}

test("complete empty provider inventory proves planned staging resources absent", async () => {
  const currentPlan = await plan();
  const result = await collectStagingInventorySnapshotV1(currentPlan, reader(), evidence());
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.snapshot.coverage, {
    d1: "complete",
    queues: "complete",
    workers: "complete",
    controlPlane: "complete",
    providerDestinations: "complete",
  });

  const decision = evaluateStagingProvisioningPreflightV1(
    currentPlan,
    result.snapshot,
    "account-1",
    "repo-sha",
    Date.parse("2026-10-07T16:10:30.000Z"),
  );
  assert.equal(decision.ready, true);
  assert.ok(decision.resources.every((resource) => resource.action === "create"));
});

test("external control-plane evidence preserves its own coverage and fails closed", async () => {
  const currentPlan = await plan();
  const currentEvidence = evidence();
  currentEvidence.coverage.controlPlane = "partial";
  const result = await collectStagingInventorySnapshotV1(currentPlan, reader(), currentEvidence);
  assert.equal(result.snapshot.coverage.controlPlane, "partial");

  const decision = evaluateStagingProvisioningPreflightV1(
    currentPlan,
    result.snapshot,
    "account-1",
    "repo-sha",
    Date.parse("2026-10-07T16:10:30.000Z"),
  );
  assert.equal(decision.ready, false);
  assert.ok(decision.reasons.some((reason) => reason.includes("coverage.controlPlane")));
});

test("failed provider list cannot be interpreted as resource absence", async () => {
  const currentPlan = await plan();
  const result = await collectStagingInventorySnapshotV1(
    currentPlan,
    reader({
      listQueues: async () => { throw new TypeError("secret-bearing provider detail"); },
    }),
    evidence(),
  );

  assert.equal(result.snapshot.coverage.queues, "unavailable");
  assert.deepEqual(result.snapshot.queues, []);
  assert.deepEqual(result.errors, ["queues:list:TypeError"]);
  assert.equal(JSON.stringify(result).includes("secret-bearing"), false);

  const decision = evaluateStagingProvisioningPreflightV1(
    currentPlan,
    result.snapshot,
    "account-1",
    "repo-sha",
    Date.parse("2026-10-07T16:10:30.000Z"),
  );
  assert.equal(decision.ready, false);
  assert.ok(decision.reasons.some((reason) => reason.includes("coverage.queues")));
});

test("existing source Queue with zero consumers can be reused before consumer/DLQ wiring", async () => {
  const currentPlan = await plan();
  const currentEvidence = evidence();
  currentEvidence.ownership.queueIds = ["staging-queue"];
  const result = await collectStagingInventorySnapshotV1(
    currentPlan,
    reader({
      listQueues: async () => [{
        name: "avkroken-ingest-events-preview-v1",
        id: "staging-queue",
        messageRetentionSeconds: 604800,
      }],
      listQueueConsumers: async () => [],
    }),
    currentEvidence,
  );

  const decision = evaluateStagingProvisioningPreflightV1(
    currentPlan,
    result.snapshot,
    "account-1",
    "repo-sha",
    Date.parse("2026-10-07T16:10:30.000Z"),
  );
  assert.equal(decision.ready, true);
  assert.equal(
    decision.resources.find((item) => item.name === "avkroken-ingest-events-preview-v1")?.action,
    "reuse",
  );
});

test("configured consumer must carry exact DLQ and bounded retry policy", async () => {
  const currentPlan = await plan();
  const currentEvidence = evidence();
  currentEvidence.ownership.queueIds = ["staging-queue", "staging-dlq"];
  currentEvidence.ownership.workerNames = ["events-staging"];

  const result = await collectStagingInventorySnapshotV1(
    currentPlan,
    reader({
      listQueues: async () => [
        {
          name: "avkroken-ingest-events-preview-v1",
          id: "staging-queue",
          messageRetentionSeconds: 604800,
        },
        {
          name: "avkroken-ingest-events-preview-v1-dlq",
          id: "staging-dlq",
          messageRetentionSeconds: 345600,
        },
      ],
      listQueueConsumers: async (queueId) => queueId === "staging-queue" ? [{
        worker: "events-staging",
        maxBatchSize: 10,
        maxBatchTimeoutSeconds: 1,
        maxRetries: 5,
        deadLetterQueue: "avkroken-ingest-events-preview-v1-dlq",
      }] : [],
      listWorkers: async () => [{ name: "events-staging" }],
      inspectWorker: async () => ({
        name: "events-staging",
        deploymentCommitSha: "repo-sha",
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
      }),
    }),
    currentEvidence,
  );

  const decision = evaluateStagingProvisioningPreflightV1(
    currentPlan,
    result.snapshot,
    "account-1",
    "repo-sha",
    Date.parse("2026-10-07T16:10:30.000Z"),
  );
  assert.equal(decision.ready, true);

  result.snapshot.queues[0].consumers[0].deadLetterQueue = null;
  const drift = evaluateStagingProvisioningPreflightV1(
    currentPlan,
    result.snapshot,
    "account-1",
    "repo-sha",
    Date.parse("2026-10-07T16:10:30.000Z"),
  );
  assert.equal(drift.ready, false);
  assert.ok(drift.reasons.some((reason) => reason.includes("queue.consumer.deadLetterQueue")));
});

test("planned worker inspection failure degrades worker coverage and blocks absence/reuse proof", async () => {
  const currentPlan = await plan();
  const result = await collectStagingInventorySnapshotV1(
    currentPlan,
    reader({
      listWorkers: async () => [{ name: "events-staging" }],
      inspectWorker: async () => { throw new Error("provider payload"); },
    }),
    evidence(),
  );

  assert.equal(result.snapshot.coverage.workers, "partial");
  assert.deepEqual(result.snapshot.workers, []);
  assert.deepEqual(result.errors, ["workers:inspect:events-staging:Error"]);
  assert.equal(JSON.stringify(result).includes("provider payload"), false);

  const decision = evaluateStagingProvisioningPreflightV1(
    currentPlan,
    result.snapshot,
    "account-1",
    "repo-sha",
    Date.parse("2026-10-07T16:10:30.000Z"),
  );
  assert.equal(decision.ready, false);
  assert.ok(decision.reasons.some((reason) => reason.includes("coverage.workers")));
});


test("snapshot account is bound to the reader account identity", async () => {
  const currentPlan = await plan();
  const currentEvidence = evidence();
  currentEvidence.accountId = "claimed-account";

  const boundReader = {
    getAccountId: async () => "queried-account",
    listDatabases: async () => [],
    listQueues: async () => [],
    listQueueConsumers: async () => [],
    listWorkers: async () => [],
    inspectWorker: async (name: string) => ({
      name,
      deploymentCommitSha: null,
      publicRoutes: [],
      secretBindings: [],
      plainTextVars: [],
      otherBindings: [],
      triggers: [],
      d1Bindings: [],
      queueProducerBindings: [],
      queueConsumerBindings: [],
    }),
  };

  const result = await collectStagingInventorySnapshotV1(
    currentPlan,
    boundReader,
    currentEvidence,
  );

  assert.equal(result.snapshot.accountId, "queried-account");
  assert.equal(result.snapshot.coverage.controlPlane, "partial");
  assert.deepEqual(result.errors, ["account:evidence_mismatch"]);
});
