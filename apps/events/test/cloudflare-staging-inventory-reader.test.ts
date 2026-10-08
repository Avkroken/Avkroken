import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  CloudflareInventoryShapeError,
  CloudflareStagingInventoryReaderV1,
  type CloudflareStagingInventoryProxyV1,
} from "../src/cloudflare-staging-inventory-reader.ts";
import {
  collectStagingInventorySnapshotV1,
  type StagingInventoryEvidenceV1,
} from "../src/staging-inventory-collector.ts";
import type { RuntimeProvisioningPlanV1 } from "../src/runtime-gate.ts";

async function plan(): Promise<RuntimeProvisioningPlanV1> {
  return JSON.parse(
    await readFile(new URL("../runtime-provisioning.v1.json", import.meta.url), "utf8"),
  ) as RuntimeProvisioningPlanV1;
}

function proxy(overrides: Partial<CloudflareStagingInventoryProxyV1> = {}): CloudflareStagingInventoryProxyV1 {
  return {
    getAccountIdentity: async () => ({ id: "account-1" }),
    listD1Databases: async () => [],
    getD1Database: async () => { throw new Error("unexpected detail"); },
    listQueues: async () => [],
    listQueueConsumers: async () => [],
    listWorkers: async () => [],
    inspectPlannedWorker: async () => { throw new Error("unexpected worker detail"); },
    ...overrides,
  };
}

function evidence(): StagingInventoryEvidenceV1 {
  return {
    observedAt: "2026-10-07T20:10:00.000Z",
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

test("D1 list uses detail only for the planned staging database", async () => {
  const calls: string[] = [];
  const reader = new CloudflareStagingInventoryReaderV1(
    await plan(),
    proxy({
      listD1Databases: async () => [
        { name: "other", uuid: "other-db", jurisdiction: "eu" },
        { name: "avkroken-events-preview-eu", uuid: "staging-db", jurisdiction: "eu" },
      ],
      getD1Database: async (id) => {
        calls.push(id);
        return {
          name: "avkroken-events-preview-eu",
          uuid: "staging-db",
          jurisdiction: "eu",
          read_replication: { mode: "disabled" },
        };
      },
    }),
  );

  assert.deepEqual(await reader.listDatabases(), [
    {
      name: "other",
      id: "other-db",
      jurisdiction: "eu",
      readReplication: null,
    },
    {
      name: "avkroken-events-preview-eu",
      id: "staging-db",
      jurisdiction: "eu",
      readReplication: "disabled",
    },
  ]);
  assert.deepEqual(calls, ["staging-db"]);
});

test("Queue consumers normalize worker retry/DLQ settings from provider fields", async () => {
  const reader = new CloudflareStagingInventoryReaderV1(
    await plan(),
    proxy({
      listQueues: async () => [{
        queue_name: "avkroken-ingest-events-preview-v1",
        queue_id: "queue-id",
        settings: { message_retention_period: 604800 },
      }],
      listQueueConsumers: async () => [{
        type: "worker",
        script_name: "events-staging",
        dead_letter_queue: "avkroken-ingest-events-preview-v1-dlq",
        settings: {
          batch_size: 10,
          max_wait_time_ms: 1000,
          max_retries: 5,
        },
      }],
    }),
  );

  assert.deepEqual(await reader.listQueueConsumers("queue-id"), [{
    worker: "events-staging",
    maxBatchSize: 10,
    maxBatchTimeoutSeconds: 1,
    maxRetries: 5,
    deadLetterQueue: "avkroken-ingest-events-preview-v1-dlq",
  }]);
});

test("Queue consumer inspection is restricted to inventoried planned staging queues", async () => {
  let called = false;
  const reader = new CloudflareStagingInventoryReaderV1(
    await plan(),
    proxy({
      listQueues: async () => [{
        queue_name: "unrelated",
        queue_id: "other-queue",
        settings: { message_retention_period: 604800 },
      }],
      listQueueConsumers: async () => {
        called = true;
        return [];
      },
    }),
  );

  await assert.rejects(
    () => reader.listQueueConsumers("other-queue"),
    (error: unknown) => error instanceof CloudflareInventoryShapeError && error.field === "queueId",
  );
  assert.equal(called, false);
});

test("planned worker inspection maps bindings/routes without exposing values", async () => {
  const currentPlan = await plan();
  const reader = new CloudflareStagingInventoryReaderV1(
    currentPlan,
    proxy({
      listD1Databases: async () => [
        { name: "avkroken-events-preview-eu", uuid: "staging-db", jurisdiction: "eu" },
      ],
      getD1Database: async () => ({
        name: "avkroken-events-preview-eu",
        uuid: "staging-db",
        jurisdiction: "eu",
        read_replication: { mode: "disabled" },
      }),
      listQueues: async () => [{
        queue_name: "avkroken-ingest-events-preview-v1",
        queue_id: "staging-queue",
        settings: { message_retention_period: 604800 },
      }],
      inspectPlannedWorker: async () => ({
        worker: {
          name: "events-staging",
          subdomain: { enabled: false, previews_enabled: false },
          references: {
            domains: [],
            queues: [{
              queue_id: "staging-queue",
              queue_name: "avkroken-ingest-events-preview-v1",
            }],
          },
        },
        settings: {
          annotations: { "workers/commit_sha": "a".repeat(40) },
          bindings: [
            { type: "d1", name: "EVENTS_DB", database_id: "staging-db" },
            { type: "plain_text", name: "SHOULD_BLOCK", text: "must-not-leak" },
            { type: "secret_text", name: "SECRET", text: "must-not-leak-secret" },
          ],
        },
        schedules: { schedules: [] },
        routes: [],
      }),
    }),
  );

  const inspected = await reader.inspectWorker("events-staging");
  assert.equal(inspected.deploymentCommitSha, "a".repeat(40));
  assert.deepEqual(inspected.d1Bindings, [{
    binding: "EVENTS_DB",
    databaseId: "staging-db",
    databaseName: "avkroken-events-preview-eu",
  }]);
  assert.deepEqual(inspected.queueConsumerBindings, [{
    queueId: "staging-queue",
    queueName: "avkroken-ingest-events-preview-v1",
  }]);
  assert.deepEqual(inspected.plainTextVars, ["SHOULD_BLOCK"]);
  assert.deepEqual(inspected.secretBindings, ["SECRET"]);
  assert.equal(JSON.stringify(inspected).includes("must-not-leak"), false);
});

test("public workers.dev, preview URLs, domains, routes and cron are surfaced as blockers", async () => {
  const reader = new CloudflareStagingInventoryReaderV1(
    await plan(),
    proxy({
      listD1Databases: async () => [],
      listQueues: async () => [],
      inspectPlannedWorker: async () => ({
        worker: {
          name: "ingest-staging",
          subdomain: { enabled: true, previews_enabled: true },
          references: {
            domains: [{ hostname: "ingest-staging.example.test" }],
            queues: [],
          },
        },
        settings: { annotations: {}, bindings: [] },
        schedules: { schedules: [{ cron: "*/5 * * * *" }] },
        routes: ["example.test/ingest/*"],
      }),
    }),
  );

  const inspected = await reader.inspectWorker("ingest-staging");
  assert.deepEqual(inspected.publicRoutes, [
    "custom_domain:ingest-staging.example.test",
    "preview_urls",
    "route:example.test/ingest/*",
    "workers.dev",
  ]);
  assert.deepEqual(inspected.triggers, ["cron:*/5 * * * *"]);
});

test("reader refuses arbitrary worker inspection outside the staging allowlist", async () => {
  let called = false;
  const reader = new CloudflareStagingInventoryReaderV1(
    await plan(),
    proxy({
      inspectPlannedWorker: async () => {
        called = true;
        throw new Error("must not be called");
      },
    }),
  );

  await assert.rejects(
    () => reader.inspectWorker("skvallerbyttan"),
    (error: unknown) => error instanceof CloudflareInventoryShapeError && error.field === "worker.name",
  );
  assert.equal(called, false);
});

test("unknown provider shape fails closed through collector coverage without provider text leakage", async () => {
  const currentPlan = await plan();
  const reader = new CloudflareStagingInventoryReaderV1(
    currentPlan,
    proxy({
      listD1Databases: async () => [],
      listQueues: async () => [],
      listWorkers: async () => [{ name: "events-staging" }],
      inspectPlannedWorker: async () => ({
        worker: {
          name: "events-staging",
          subdomain: { enabled: false, previews_enabled: false },
          references: { domains: [], queues: [] },
        },
        settings: {
          annotations: {},
          bindings: [{ name: "UNKNOWN_WITH_SECRET", value: "provider-secret" }],
        },
        schedules: { schedules: [] },
        routes: [],
      }),
    }),
  );

  const result = await collectStagingInventorySnapshotV1(
    currentPlan,
    reader,
    evidence(),
  );
  assert.equal(result.snapshot.coverage.workers, "partial");
  assert.deepEqual(result.errors, ["workers:inspect:events-staging:CloudflareInventoryShapeError"]);
  assert.equal(JSON.stringify(result).includes("provider-secret"), false);
});

test("D1 detail identity mismatch fails closed", async () => {
  const reader = new CloudflareStagingInventoryReaderV1(
    await plan(),
    proxy({
      listD1Databases: async () => [{
        name: "avkroken-events-preview-eu",
        uuid: "staging-db",
        jurisdiction: "eu",
      }],
      getD1Database: async () => ({
        name: "different",
        uuid: "staging-db",
        jurisdiction: "eu",
        read_replication: { mode: "disabled" },
      }),
    }),
  );

  await assert.rejects(
    () => reader.listDatabases(),
    (error: unknown) => error instanceof CloudflareInventoryShapeError && error.field === "d1.detail.identity",
  );
});
