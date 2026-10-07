import assert from "node:assert/strict";
import test from "node:test";
import type {
  IngressMessageV1,
  ObservationEventV1,
  ProvenanceV1,
} from "../../../packages/observability-contracts/src/index.ts";
import { reduceGitHubWebhook } from "../../ingest/src/reducers.ts";
import { legacyActivityProjection } from "../src/model.ts";
import {
  MAX_LEGACY_IMPORT_BATCH,
  canonicalEventFromLegacyRow,
  planLegacyImport,
  type LegacyObservationEventRow,
} from "../src/legacy.ts";
import {
  CorruptEventRowError,
  InvalidEventQueryError,
  eventFromRow,
  getEventById,
  listEvents,
  normalizeEventQuery,
} from "../src/read.ts";
import { eventRetentionCutoff, pruneEvents } from "../src/retention.ts";
import {
  MAX_INGRESS_BATCH_SIZE,
  processIngressQueueBatch,
  type QueueMessageLike,
} from "../src/consumer.ts";
import type {
  D1DatabaseLike,
  D1ResultSetLike,
  D1RunResultLike,
  D1StatementLike,
} from "../src/store.ts";

type StoredIdentity = { id: string; content_hash: string };

class TestDb implements D1DatabaseLike {
  readonly calls: Array<{ sql: string; params: unknown[]; operation: "run" | "first" | "all" }> = [];
  readonly identities = new Map<string, StoredIdentity>();
  rows: Record<string, unknown>[] = [];
  firstRow: Record<string, unknown> | null = null;
  deleteChanges = 0;

  prepare(sql: string): D1StatementLike {
    const db = this;
    return new class implements D1StatementLike {
      params: unknown[] = [];
      bind(...values: unknown[]): D1StatementLike {
        this.params = values;
        return this;
      }
      async run(): Promise<D1RunResultLike> {
        db.calls.push({ sql, params: [...this.params], operation: "run" });
        if (/INSERT OR IGNORE INTO events/.test(sql)) {
          const id = String(this.params[0]);
          const idempotencyKey = String(this.params[2]);
          const contentHash = String(this.params[3]);
          if (db.identities.has(idempotencyKey)) return { meta: { changes: 0 } };
          db.identities.set(idempotencyKey, { id, content_hash: contentHash });
          return { meta: { changes: 1 } };
        }
        if (/DELETE FROM events/.test(sql)) return { meta: { changes: db.deleteChanges } };
        throw new Error("unexpected run");
      }
      async first<T>(): Promise<T | null> {
        db.calls.push({ sql, params: [...this.params], operation: "first" });
        if (/SELECT id, content_hash FROM events/.test(sql)) {
          return (db.identities.get(String(this.params[0])) ?? null) as T | null;
        }
        if (/FROM events\s+WHERE id = \?/.test(sql)) {
          return db.firstRow as T | null;
        }
        throw new Error("unexpected first");
      }
      async all<T>(): Promise<D1ResultSetLike<T>> {
        db.calls.push({ sql, params: [...this.params], operation: "all" });
        return { results: db.rows as T[] };
      }
    }();
  }
}

function provenance(receivedAt: string): ProvenanceV1 {
  return {
    source: "webhook",
    provider: "github",
    observedAt: receivedAt,
    receivedAt,
    coverage: "since_first_observation",
    periodComplete: false,
    sampling: "none",
    direct: true,
    inherited: false,
    derived: false,
    sourceId: "github:delivery",
  };
}

function eventRow(
  hex: string,
  receivedAt: string,
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> {
  const event: ObservationEventV1 = {
    id: `evt_${hex.repeat(64)}`,
    schemaVersion: 1,
    provider: "github",
    capability: "github.avkroken.actions",
    event: "workflow_run",
    action: "completed",
    occurredAt: null,
    receivedAt,
    resource: {
      type: "workflow_run",
      id: "42",
      name: "Avkroken",
      scope: "repository",
      repository: "Avkroken",
    },
    actor: null,
    correlation: { resourceId: "42", repository: "Avkroken" },
    provenance: provenance(receivedAt),
    derived: false,
    metadata: {},
  };
  return {
    id: event.id,
    schema_version: 1,
    provider: event.provider,
    capability: event.capability,
    source: event.provenance.source,
    coverage: event.provenance.coverage,
    event: event.event,
    action: event.action,
    derived: 0,
    resource_type: event.resource?.type ?? null,
    resource_id: event.resource?.id ?? null,
    repository: event.resource?.repository ?? null,
    occurred_at: event.occurredAt,
    received_at: event.receivedAt,
    resource_json: JSON.stringify(event.resource),
    actor_json: null,
    correlation_json: JSON.stringify(event.correlation),
    provenance_json: JSON.stringify(event.provenance),
    metadata_json: JSON.stringify(event.metadata),
    ...overrides,
  };
}

test("event query defaults to a bounded 30-day window and rejects >90 days", () => {
  const now = Date.parse("2026-10-07T12:00:00.000Z");
  const query = normalizeEventQuery({}, now);
  assert.equal(query.limit, 50);
  assert.equal(query.to, "2026-10-07T12:00:00.000Z");
  assert.equal(query.from, "2026-09-07T12:00:00.000Z");

  assert.throws(
    () => normalizeEventQuery({
      from: "2026-06-01T00:00:00.000Z",
      to: "2026-10-07T00:00:00.000Z",
    }, now),
    InvalidEventQueryError,
  );
  assert.throws(
    () => normalizeEventQuery({ repository: "../escape" }, now),
    InvalidEventQueryError,
  );
  assert.throws(
    () => normalizeEventQuery({ repository: "Avkroken", repositories: ["Avkroken"] }, now),
    InvalidEventQueryError,
  );
});

test("listEvents applies bounded filters and keyset pagination", async () => {
  const db = new TestDb();
  db.rows = [
    eventRow("f", "2026-10-07T11:59:00.000Z"),
    eventRow("e", "2026-10-07T11:58:00.000Z"),
    eventRow("d", "2026-10-07T11:57:00.000Z"),
  ];
  const first = await listEvents(db, {
    limit: 2,
    provider: "github",
    capability: "github.avkroken.actions",
    repositories: ["Avkroken", "Bastion"],
    resource: "workflow_run",
  }, Date.parse("2026-10-07T12:00:00.000Z"));

  assert.equal(first.items.length, 2);
  assert.equal(first.truncated, true);
  assert.ok(first.nextCursor);
  assert.equal(first.items[0].resource?.repository, "Avkroken");
  const call = db.calls.find((item) => item.operation === "all");
  assert.ok(call);
  assert.match(call.sql, /repository IN \(\?, \?\)/);
  assert.match(call.sql, /resource_type = \? OR resource_id = \?/);
  assert.match(call.sql, /ORDER BY received_at DESC, id DESC/);
  assert.equal(call.params.at(-1), 3);

  const secondDb = new TestDb();
  secondDb.rows = [eventRow("d", "2026-10-07T11:57:00.000Z")];
  const second = await listEvents(secondDb, {
    limit: 2,
    cursor: first.nextCursor ?? undefined,
  }, Date.parse("2026-10-08T12:00:00.000Z"));
  assert.equal(second.truncated, false);
  const secondCall = secondDb.calls.find((item) => item.operation === "all");
  assert.ok(secondCall);
  assert.match(secondCall.sql, /received_at < \? OR \(received_at = \? AND id < \?\)/);
  assert.deepEqual(
    secondCall.params.slice(0, 2),
    ["2026-09-07T12:00:00.000Z", "2026-10-07T12:00:00.000Z"],
  );

  const denyAllDb = new TestDb();
  await listEvents(denyAllDb, { repositories: [] }, Date.parse("2026-10-07T12:00:00.000Z"));
  const denyAllCall = denyAllDb.calls.find((item) => item.operation === "all");
  assert.ok(denyAllCall);
  assert.match(denyAllCall.sql, /1 = 0/);
});

test("row reconstruction and event detail fail closed on corrupt rows", async () => {
  const row = eventRow("a", "2026-10-07T11:59:00.000Z");
  const event = eventFromRow(row as never);
  assert.equal(event.id, `evt_${"a".repeat(64)}`);
  assert.equal(event.provenance.source, "webhook");

  const db = new TestDb();
  db.firstRow = row;
  assert.equal((await getEventById(db, event.id))?.id, event.id);
  await assert.rejects(
    () => getEventById(db, "not-an-event-id"),
    InvalidEventQueryError,
  );
  assert.throws(
    () => eventFromRow({ ...row, metadata_json: "[]" } as never),
    CorruptEventRowError,
  );
  assert.throws(
    () => eventFromRow({ ...row, provenance_json: "{}" } as never),
    CorruptEventRowError,
  );
  assert.throws(
    () => eventFromRow({ ...row, metadata_json: JSON.stringify({ nested: { value: true } }) } as never),
    CorruptEventRowError,
  );
  assert.throws(
    () => eventFromRow({ ...row, action: 42 } as never),
    CorruptEventRowError,
  );
  assert.throws(
    () => eventFromRow({ ...row, capability: "cloudflare.avkroken.workers" } as never),
    CorruptEventRowError,
  );
});

test("retention seam deletes only rows older than the 90-day cutoff", async () => {
  const db = new TestDb();
  db.deleteChanges = 4;
  const now = Date.parse("2026-10-07T12:00:00.000Z");
  const cutoff = eventRetentionCutoff(now);
  assert.equal(cutoff, "2026-07-09T12:00:00.000Z");
  assert.equal(await pruneEvents(db, now), 4);
  const call = db.calls.find((item) => item.operation === "run");
  assert.ok(call);
  assert.match(call.sql, /DELETE FROM events WHERE received_at < \?/);
  assert.deepEqual(call.params, [cutoff]);
});

test("legacy backfill transform preserves current Activity fields deterministically", async () => {
  const row: LegacyObservationEventRow = {
    event_key: "github:delivery-legacy:github.avkroken.actions",
    provider: "github",
    capability: "github.avkroken.actions",
    source: "webhook",
    coverage: "since_first_observation",
    event: "workflow_run",
    action: "completed",
    resource_type: "workflow_run",
    resource_id: "42",
    repository: "Avkroken",
    occurred_at: null,
    received_at: "2026-10-01T10:00:00.000Z",
  };
  const first = await canonicalEventFromLegacyRow(row);
  const second = await canonicalEventFromLegacyRow(row);
  assert.equal(first.event.id, second.event.id);
  assert.equal(first.contentHash, second.contentHash);
  assert.equal(first.idempotencyKey, "github:delivery-legacy");
  const normalizedIdentity = await canonicalEventFromLegacyRow({
    ...row,
    provider: " github ",
    source: " webhook ",
  });
  assert.equal(normalizedIdentity.idempotencyKey, "github:delivery-legacy");
  assert.deepEqual(legacyActivityProjection(first.event), {
    provider: row.provider,
    capability: row.capability,
    source: row.source,
    coverage: row.coverage,
    event: row.event,
    action: row.action,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    repository: row.repository,
    occurredAt: row.occurred_at,
    receivedAt: row.received_at,
  });

  const plan = await planLegacyImport([
    row,
    { ...row, event_key: "bad", provider: "other" },
    { ...row, event_key: "github:overlap:github.avkroken.actions", received_at: "2026-10-02T00:00:00.000Z" },
  ], { beforeExclusive: "2026-10-02T00:00:00.000Z" });
  assert.equal(plan.total, 3);
  assert.equal(plan.valid, 1);
  assert.deepEqual(plan.invalid, [{ index: 1, field: "provider" }]);
  assert.deepEqual(plan.excluded, [{ index: 2, reason: "at_or_after_cutover" }]);
  await assert.rejects(
    () => planLegacyImport(
      Array.from({ length: MAX_LEGACY_IMPORT_BATCH + 1 }, () => row),
      { beforeExclusive: "2026-10-02T00:00:00.000Z" },
    ),
    RangeError,
  );
});

test("queue adapter uses item-level ack for success and retry for poison messages", async () => {
  const db = new TestDb();
  const valid = reduceGitHubWebhook({
    deliveryId: "consumer-delivery",
    event: "push",
    payload: { repository: { name: "Avkroken", owner: { login: "Avkroken" } } },
    receivedAt: "2026-10-07T12:00:00.000Z",
    messageId: "attempt-1",
  });
  const duplicate = { ...valid, messageId: "attempt-2", receivedAt: "2026-10-07T12:01:00.000Z" };
  const invalid = { ...valid, messageId: "attempt-3", metadata: { nested: { raw: true } } } as unknown as IngressMessageV1;
  const dispositions: string[] = [];
  const message = (body: IngressMessageV1, label: string): QueueMessageLike<IngressMessageV1> => ({
    body,
    ack: () => dispositions.push(`ack:${label}`),
    retry: () => dispositions.push(`retry:${label}`),
  });

  const result = await processIngressQueueBatch(db, {
    messages: [
      message(valid, "insert"),
      message(duplicate, "duplicate"),
      message(invalid, "invalid"),
    ],
  });

  assert.deepEqual(result.summary, {
    processed: 3,
    inserted: 1,
    duplicates: 1,
    retried: 1,
  });
  assert.deepEqual(dispositions, [
    "ack:insert",
    "ack:duplicate",
    "retry:invalid",
  ]);

  await assert.rejects(
    () => processIngressQueueBatch(db, {
      messages: Array.from(
        { length: MAX_INGRESS_BATCH_SIZE + 1 },
        (_, index) => message({ ...valid, messageId: `oversize-${index}` }, `oversize-${index}`),
      ),
    }),
    RangeError,
  );
});
