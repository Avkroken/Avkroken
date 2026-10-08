import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  runStagingProvisioningPreflightV1,
} from "../control-plane/staging-preflight-runner.ts";
import type { CloudflareStagingInventoryProxyV1 } from "../src/cloudflare-staging-inventory-reader.ts";
import type { StagingInventoryEvidenceV1 } from "../src/staging-inventory-collector.ts";
import type { RuntimeProvisioningPlanV1 } from "../src/runtime-gate.ts";

async function plan(): Promise<RuntimeProvisioningPlanV1> {
  return JSON.parse(
    await readFile(new URL("../runtime-provisioning.v1.json", import.meta.url), "utf8"),
  ) as RuntimeProvisioningPlanV1;
}

type RunnerEvidence = Omit<StagingInventoryEvidenceV1, "observedAt" | "accountId">;

function evidence(): RunnerEvidence {
  return {
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

function proxy(accountId = "account-1"): CloudflareStagingInventoryProxyV1 {
  return {
    getAccountIdentity: async () => ({ id: accountId }),
    getActiveWorkerDeployment: async () => {
      throw new Error("unexpected deployment read");
    },
    listD1Databases: async () => [],
    getD1Database: async () => {
      throw new Error("unexpected D1 detail");
    },
    listQueues: async () => [],
    listQueueConsumers: async () => [],
    listWorkers: async () => [],
    inspectPlannedWorker: async () => {
      throw new Error("unexpected Worker detail");
    },
  };
}

test("operator runner composes read-only inventory into a sanitized ready report", async () => {
  const nowMs = Date.parse("2026-10-08T08:00:00.000Z");
  const report = await runStagingProvisioningPreflightV1({
    plan: await plan(),
    proxy: proxy(),
    evidence: evidence(),
    expectedAccountId: "account-1",
    expectedRepositorySha: "a".repeat(40),
    nowMs,
  });

  assert.equal(report.schemaVersion, 1);
  assert.equal(report.ready, true);
  assert.equal(report.observedAt, "2026-10-08T08:00:00.000Z");
  assert.equal(report.evaluatedAt, "2026-10-08T08:00:00.000Z");
  assert.deepEqual(report.collectionErrors, []);
  assert.deepEqual(report.coverage, {
    d1: "complete",
    queues: "complete",
    workers: "complete",
    controlPlane: "complete",
    providerDestinations: "complete",
  });
  assert.deepEqual(report.inventoryCounts, {
    databases: 0,
    queues: 0,
    workers: 0,
  });
  assert.ok(report.resources.every((resource) => resource.action === "create"));
  assert.equal(JSON.stringify(report).includes("prod-db"), false);
  assert.equal(JSON.stringify(report).includes("prod-queue"), false);
});

test("operator runner binds the report to the provider account and fails closed on mismatch", async () => {
  const report = await runStagingProvisioningPreflightV1({
    plan: await plan(),
    proxy: proxy("account-2"),
    evidence: evidence(),
    expectedAccountId: "account-1",
    expectedRepositorySha: "a".repeat(40),
    nowMs: Date.parse("2026-10-08T08:00:00.000Z"),
  });

  assert.equal(report.ready, false);
  assert.equal(report.accountId, "account-2");
  assert.equal(report.coverage.controlPlane, "partial");
  assert.deepEqual(report.collectionErrors, ["account:evidence_mismatch"]);
  assert.ok(report.reasons.some((reason) => reason.includes("accountId")));
  assert.ok(report.resources.every((resource) => resource.action === "blocked"));
});
