import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  activityFromCloudflareWebhook,
  activityFromGitHubWebhook,
} from "../../skvallerbyttan/src/activity.ts";
import {
  reduceCloudflareWebhook,
  reduceGitHubWebhook,
} from "../../ingest/src/reducers.ts";
import {
  InvalidIngressMessageError,
  canonicalEventFromIngress,
  legacyActivityProjection,
  normalizeIngressMessage,
} from "../src/model.ts";
import {
  processIngressMessage,
  persistIngressMessage,
  type D1DatabaseLike,
  type D1StatementLike,
} from "../src/store.ts";

type StoredIdentity = { id: string; content_hash: string };

class MemoryDb implements D1DatabaseLike {
  readonly identities = new Map<string, StoredIdentity>();

  prepare(sql: string): D1StatementLike {
    const db = this;
    return new class implements D1StatementLike {
      params: unknown[] = [];
      bind(...values: unknown[]): D1StatementLike {
        this.params = values;
        return this;
      }
      async run() {
        if (!/INSERT OR IGNORE INTO events/.test(sql)) throw new Error("unexpected run");
        const id = String(this.params[0]);
        const idempotencyKey = String(this.params[2]);
        const contentHash = String(this.params[3]);
        if (db.identities.has(idempotencyKey)) return { meta: { changes: 0 } };
        db.identities.set(idempotencyKey, { id, content_hash: contentHash });
        return { meta: { changes: 1 } };
      }
      async first<T>(): Promise<T | null> {
        if (!/SELECT id, content_hash FROM events/.test(sql)) throw new Error("unexpected first");
        return (db.identities.get(String(this.params[0])) ?? null) as T | null;
      }
      async all<T>() {
        return { results: [] as T[] };
      }
    }();
  }
}

test("canonical event IDs and content hashes are stable across retry attempts", async () => {
  const base = reduceGitHubWebhook({
    deliveryId: "delivery-1",
    event: "workflow_run",
    payload: {
      action: "completed",
      repository: { name: "Avkroken", owner: { login: "Avkroken" } },
      workflow_run: { id: 42 },
      sender: { id: 7, login: "octocat", type: "User" },
    },
    receivedAt: "2026-10-07T09:00:00.000Z",
    messageId: "attempt-1",
  });
  const retry = {
    ...base,
    messageId: "attempt-2",
    receivedAt: "2026-10-07T09:01:00.000Z",
  };

  const first = await canonicalEventFromIngress(base);
  const second = await canonicalEventFromIngress(retry);

  assert.equal(first.event.id, second.event.id);
  assert.equal(first.contentHash, second.contentHash);
  assert.notEqual(first.firstMessageId, second.firstMessageId);
  assert.equal(first.event.receivedAt, "2026-10-07T09:00:00.000Z");
  assert.equal(second.event.receivedAt, "2026-10-07T09:01:00.000Z");
});

test("canonical storage inserts once and treats retry as idempotent duplicate", async () => {
  const db = new MemoryDb();
  const message = reduceGitHubWebhook({
    deliveryId: "delivery-duplicate",
    event: "issues",
    payload: {
      action: "opened",
      repository: { name: "Avkroken", owner: { login: "Avkroken" } },
      issue: { number: 17 },
    },
    receivedAt: "2026-10-07T09:00:00.000Z",
    messageId: "attempt-a",
  });

  const first = await persistIngressMessage(db, message, "2026-10-07T09:00:01.000Z");
  const duplicate = await persistIngressMessage(db, {
    ...message,
    messageId: "attempt-b",
    receivedAt: "2026-10-07T09:02:00.000Z",
  }, "2026-10-07T09:02:01.000Z");

  assert.equal(first.status, "inserted");
  assert.equal(duplicate.status, "duplicate");
  if (first.status === "inserted" && duplicate.status === "duplicate") {
    assert.equal(duplicate.eventId, first.event.id);
  }
  assert.equal(db.identities.size, 1);
});

test("same idempotency key with different semantic content is a conflict", async () => {
  const db = new MemoryDb();
  const message = reduceGitHubWebhook({
    deliveryId: "delivery-conflict",
    event: "issues",
    payload: {
      action: "opened",
      repository: { name: "Avkroken", owner: { login: "Avkroken" } },
      issue: { number: 17 },
    },
    receivedAt: "2026-10-07T09:00:00.000Z",
    messageId: "attempt-a",
  });
  assert.equal((await persistIngressMessage(db, message)).status, "inserted");
  const conflict = await persistIngressMessage(db, { ...message, action: "closed", messageId: "attempt-b" });
  assert.equal(conflict.status, "conflict");
});

test("queue processing acks inserted/duplicate and retries deterministic poison input", async () => {
  const db = new MemoryDb();
  const valid = reduceGitHubWebhook({
    deliveryId: "delivery-process",
    event: "push",
    payload: { repository: { name: "Avkroken", owner: { login: "Avkroken" } } },
    receivedAt: "2026-10-07T09:00:00.000Z",
    messageId: "attempt-a",
  });

  assert.equal((await processIngressMessage(db, valid)).disposition, "ack");
  assert.equal((await processIngressMessage(db, { ...valid, messageId: "attempt-b" })).status, "duplicate");
  const invalid = await processIngressMessage(db, { ...valid, metadata: { nested: { raw: true } } });
  assert.deepEqual(invalid, {
    disposition: "retry",
    status: "invalid",
    reason: "schema_validation:metadata.nested",
  });
});

test("runtime normalization rejects provider/source mismatch and unbounded metadata", () => {
  const base = reduceGitHubWebhook({
    deliveryId: "delivery-validation",
    event: "push",
    payload: { repository: { name: "Avkroken", owner: { login: "Avkroken" } } },
    receivedAt: "2026-10-07T09:00:00.000Z",
    messageId: "attempt",
  });
  assert.throws(
    () => normalizeIngressMessage({ ...base, source: "cloudflare_issues" }),
    InvalidIngressMessageError,
  );
  assert.throws(
    () => normalizeIngressMessage({ ...base, metadata: { value: "x".repeat(501) } }),
    InvalidIngressMessageError,
  );

  const oversizedMetadata = Object.fromEntries(
    Array.from({ length: 32 }, (_, index) => [
      `key-${String(index).padStart(2, "0")}-${"k".repeat(70)}`,
      "x".repeat(500),
    ]),
  );
  assert.throws(
    () => normalizeIngressMessage({ ...base, metadata: oversizedMetadata }),
    (error: unknown) => error instanceof InvalidIngressMessageError && error.field === "metadata.size",
  );
});

test("GitHub canonical event projects to current Activity semantics", async () => {
  const payload = {
    action: "completed",
    repository: { name: "Avkroken", owner: { login: "Avkroken" } },
    workflow_run: { id: 42 },
  };
  const current = activityFromGitHubWebhook(
    "delivery-parity",
    "workflow_run",
    "Avkroken",
    payload,
    "2026-10-07T09:00:00.000Z",
  );
  const canonical = await canonicalEventFromIngress(reduceGitHubWebhook({
    deliveryId: "delivery-parity",
    event: "workflow_run",
    payload,
    receivedAt: "2026-10-07T09:00:00.000Z",
    messageId: "attempt",
  }));
  const { eventKey: _eventKey, ...expected } = current;
  assert.deepEqual(legacyActivityProjection(canonical.event), expected);
});

test("Cloudflare canonical event projects to current Activity semantics", async () => {
  const body = JSON.stringify({
    account_id: "account",
    policy_id: "policy",
    alert_type: "workers_issue",
    alert_correlation_id: "correlation",
    alert_event: "ALERT_STATE_EVENT_START",
    ts: 1_700_000_000,
  });
  const ingress = await reduceCloudflareWebhook({
    source: "issues",
    payload: JSON.parse(body),
    body,
    receivedAt: "2026-10-07T09:00:00.000Z",
    messageId: "attempt",
  });
  const current = activityFromCloudflareWebhook({
    deliveryId: ingress.idempotencyKey,
    source: "issues",
    eventType: ingress.event,
    eventId: ingress.resource?.id ?? null,
    state: ingress.action,
    occurredAt: ingress.occurredAt,
    receivedAt: ingress.receivedAt,
  });
  const canonical = await canonicalEventFromIngress(ingress);
  const { eventKey: _eventKey, ...expected } = current;
  assert.deepEqual(legacyActivityProjection(canonical.event), expected);
});

test("Events migration owns unique idempotency and bounded normalized JSON", async () => {
  const sql = await readFile(new URL("../migrations/0001_events.sql", import.meta.url), "utf8");
  assert.match(sql, /schema_version INTEGER NOT NULL CHECK \(schema_version = 1\)/);
  assert.match(sql, /idempotency_key TEXT NOT NULL UNIQUE/);
  assert.match(sql, /provider TEXT NOT NULL CHECK \(provider IN \('github', 'cloudflare'\)\)/);
  assert.match(sql, /derived INTEGER NOT NULL CHECK \(derived IN \(0, 1\)\)/);
  assert.match(sql, /json_valid\(metadata_json\)/);
  assert.match(sql, /length\(metadata_json\) <= 16384/);
  assert.match(sql, /idx_events_capability_received/);
});
