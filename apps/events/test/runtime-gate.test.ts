import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  evaluateShadowCutoverGateV1,
  validateRuntimeProvisioningPlanV1,
  type RuntimeProvisioningPlanV1,
  type ShadowParityEvidenceV1,
} from "../src/runtime-gate.ts";

const EVALUATED_AT = Date.parse("2026-10-10T12:05:00.000Z");

async function plan(): Promise<RuntimeProvisioningPlanV1> {
  return JSON.parse(
    await readFile(new URL("../runtime-provisioning.v1.json", import.meta.url), "utf8"),
  ) as RuntimeProvisioningPlanV1;
}

function evidence(): ShadowParityEvidenceV1 {
  return {
    schemaVersion: 1,
    generatedAt: "2026-10-10T12:05:00.000Z",
    window: {
      from: "2026-10-07T12:00:00.000Z",
      to: "2026-10-10T12:00:00.000Z",
    },
    provisioning: {
      eventsWorker: "events-staging",
      ingestWorker: "ingest-staging",
      databaseName: "avkroken-events-preview-eu",
      databaseJurisdiction: "eu",
      databaseReadReplication: "disabled",
      migrationsApplied: true,
      noPendingMigrations: true,
      queueName: "avkroken-ingest-events-preview-v1",
      deadLetterQueue: "avkroken-ingest-events-preview-v1-dlq",
      messageRetentionSeconds: 604800,
      consumerWorker: "events-staging",
      consumerCount: 1,
      maxBatchSize: 10,
      maxBatchTimeoutSeconds: 1,
      maxRetries: 5,
      productionDatabaseReferenced: false,
      productionQueueReferenced: false,
      productionProviderSecretsBound: false,
      ingestPublicProviderRouteConfigured: false,
      eventsPublicRouteConfigured: false,
      shadowServiceBindingTarget: "ingest-staging",
      shadowServiceBindingEntrypoint: "VerifiedShadowIngressService",
    },
    parity: {
      canonicalCount: 25,
      shadowCount: 25,
      matched: 25,
      missingInShadow: 0,
      extraInShadow: 0,
      contentMismatches: 0,
      idempotencyConflicts: 0,
      mirrorFailures: 0,
    },
    queue: {
      accepted: 25,
      inserted: 25,
      duplicates: 0,
      unresolvedRetries: 0,
      dlqCount: 0,
      backlogKnown: true,
      backlogMessages: 0,
      oldestMessageAgeSeconds: null,
    },
    backfill: {
      completed: true,
      beforeExclusive: "2026-10-07T12:00:00.000Z",
      latestImportedReceivedAt: "2026-10-07T11:59:59.000Z",
      invalidRows: 0,
      conflicts: 0,
    },
    reads: {
      comparisons: 25,
      mismatches: 0,
      errors: 0,
    },
  };
}

test("runtime provisioning plan locks isolated EU D1 and Queue contracts", async () => {
  const value = await plan();
  assert.deepEqual(validateRuntimeProvisioningPlanV1(value), []);
  assert.equal(value.production.database.databaseId, null);
  assert.equal(value.shadow.database.databaseId, null);
  assert.notEqual(value.production.database.name, value.shadow.database.name);
  assert.notEqual(value.production.queue.name, value.shadow.queue.name);
  assert.equal(value.shadow.mode, "persistent_staging_environment");
  assert.equal(value.shadow.source.providerSecretsRequired, false);
  assert.equal(value.shadow.source.failSoft, true);
});

test("standard-volume 72-hour evidence passes the cutover gate", async () => {
  const result = evaluateShadowCutoverGateV1(await plan(), evidence(), EVALUATED_AT);
  assert.deepEqual(result, {
    pass: true,
    reasons: [],
    actualShadowHours: 72,
    requiredShadowHours: 72,
  });
});

test("low-volume evidence requires a seven-day window", async () => {
  const value = evidence();
  value.parity.canonicalCount = 5;
  value.parity.shadowCount = 5;
  value.parity.matched = 5;
  value.queue.accepted = 5;
  value.queue.inserted = 5;
  value.reads.comparisons = 5;

  const short = evaluateShadowCutoverGateV1(await plan(), value, EVALUATED_AT);
  assert.equal(short.pass, false);
  assert.equal(short.requiredShadowHours, 168);
  assert.ok(short.reasons.some((reason) => /168 hours/.test(reason)));

  value.window.to = "2026-10-14T12:00:00.000Z";
  value.generatedAt = "2026-10-14T12:05:00.000Z";
  const longEnough = evaluateShadowCutoverGateV1(await plan(), value, Date.parse("2026-10-14T12:05:00.000Z"));
  assert.equal(longEnough.pass, true);
});

test("zero traffic never produces cutover confidence", async () => {
  const value = evidence();
  value.window.to = "2026-10-14T12:00:00.000Z";
  value.parity.canonicalCount = 0;
  value.parity.shadowCount = 0;
  value.parity.matched = 0;
  value.queue.accepted = 0;
  value.queue.inserted = 0;
  value.reads.comparisons = 0;
  const result = evaluateShadowCutoverGateV1(await plan(), value, EVALUATED_AT);
  assert.equal(result.pass, false);
  assert.ok(result.reasons.some((reason) => /at least one canonical event/.test(reason)));
  assert.ok(result.reasons.some((reason) => /reads.comparisons/.test(reason)));
});

test("parity, DLQ, backlog and isolation failures block cutover", async () => {
  const value = evidence();
  value.parity.missingInShadow = 1;
  value.parity.matched = 24;
  value.parity.mirrorFailures = 1;
  value.queue.unresolvedRetries = 1;
  value.queue.dlqCount = 1;
  value.queue.backlogMessages = 2;
  value.queue.oldestMessageAgeSeconds = 90;
  value.provisioning.productionQueueReferenced = true;
  value.provisioning.productionProviderSecretsBound = true;
  value.provisioning.ingestPublicProviderRouteConfigured = true;
  value.provisioning.databaseReadReplication = "auto";
  value.reads.mismatches = 1;

  const result = evaluateShadowCutoverGateV1(await plan(), value, EVALUATED_AT);
  assert.equal(result.pass, false);
  for (const fragment of [
    "missingInShadow",
    "mirrorFailures",
    "unresolvedRetries",
    "dlqCount",
    "oldestMessageAgeSeconds",
    "productionQueueReferenced",
    "productionProviderSecretsBound",
    "ingestPublicProviderRouteConfigured",
    "databaseReadReplication",
    "reads.mismatches",
  ]) {
    assert.ok(result.reasons.some((reason) => reason.includes(fragment)), fragment);
  }
});

test("partial read sampling cannot qualify as parity", async () => {
  const value = evidence();
  value.reads.comparisons = 24;
  const result = evaluateShadowCutoverGateV1(await plan(), value, EVALUATED_AT);
  assert.equal(result.pass, false);
  assert.ok(result.reasons.some((reason) => reason.includes("reads.comparisons")));
});

test("backfill boundary must end strictly before shadow traffic", async () => {
  const value = evidence();
  value.backfill.latestImportedReceivedAt = value.backfill.beforeExclusive;
  const result = evaluateShadowCutoverGateV1(await plan(), value, EVALUATED_AT);
  assert.equal(result.pass, false);
  assert.ok(result.reasons.some((reason) => /latestImportedReceivedAt/.test(reason)));
});

test("provisioning drift from ADR values is rejected", async () => {
  const value = await plan();
  value.shadow.queue.maxRetries = 3;
  value.shadow.database.jurisdiction = "us";
  const reasons = validateRuntimeProvisioningPlanV1(value);
  assert.ok(reasons.some((reason) => reason.includes("shadow.queue.maxRetries")));
  assert.ok(reasons.some((reason) => reason.includes("shadow.database.jurisdiction")));
});

test("expired cutover evidence fails even if its report timestamp is refreshed", async () => {
  const target = await plan();
  const now = EVALUATED_AT + 24 * 60 * 60 * 1000;
  const value = evidence();
  let result = evaluateShadowCutoverGateV1(target, value, now);
  assert.equal(result.pass, false);
  assert.ok(result.reasons.some((reason) => reason.includes("generatedAt is stale")));
  assert.ok(result.reasons.some((reason) => reason.includes("window.to is stale")));

  value.generatedAt = new Date(now).toISOString();
  result = evaluateShadowCutoverGateV1(target, value, now);
  assert.equal(result.pass, false);
  assert.ok(result.reasons.some((reason) => reason.includes("window.to is stale")));
});

test("cutover freshness accepts the exact age limit and rejects one millisecond beyond", async () => {
  const target = await plan();
  const value = evidence();
  value.generatedAt = value.window.to;
  const limit = Date.parse(value.window.to) + 15 * 60 * 1000;
  assert.equal(evaluateShadowCutoverGateV1(target, value, limit).pass, true);
  assert.equal(evaluateShadowCutoverGateV1(target, value, limit + 1).pass, false);
});

test("future evidence and invalid evaluation clocks cannot pass cutover", async () => {
  const target = await plan();
  const value = evidence();
  value.generatedAt = value.window.to;
  const end = Date.parse(value.window.to);
  assert.equal(evaluateShadowCutoverGateV1(target, value, end - 60_000).pass, true);
  const future = evaluateShadowCutoverGateV1(target, value, end - 60_001);
  assert.equal(future.pass, false);
  assert.ok(future.reasons.some((reason) => reason.includes("generatedAt is in the future")));
  assert.ok(future.reasons.some((reason) => reason.includes("window.to is in the future")));
  for (const now of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    const result = evaluateShadowCutoverGateV1(target, value, now);
    assert.equal(result.pass, false);
    assert.ok(result.reasons.some((reason) => reason.includes("now must be a valid timestamp")));
  }
});

test("cutover uses the current clock when no evaluation time is supplied", async (t) => {
  t.mock.method(Date, "now", () => EVALUATED_AT + 24 * 60 * 60 * 1000);
  const result = evaluateShadowCutoverGateV1(await plan(), evidence());
  assert.equal(result.pass, false);
  assert.ok(result.reasons.some((reason) => reason.includes("generatedAt is stale")));
});
