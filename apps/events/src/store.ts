import {
  InvalidIngressMessageError,
  canonicalEventFromIngress,
} from "./model.ts";
import type { ObservationEventV1 } from "../../../packages/observability-contracts/src/index.ts";

export interface D1RunResultLike {
  meta?: { changes?: number | null };
}

export interface D1ResultSetLike<T> {
  results?: T[];
}

export interface D1StatementLike {
  bind(...values: unknown[]): D1StatementLike;
  run(): Promise<D1RunResultLike>;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<D1ResultSetLike<T>>;
}

export interface D1DatabaseLike {
  prepare(sql: string): D1StatementLike;
}

type ExistingEventIdentity = {
  id: string;
  content_hash: string;
};

export type CanonicalEventWrite = {
  event: ObservationEventV1;
  idempotencyKey: string;
  contentHash: string;
  firstMessageId: string;
};

export type PersistResult =
  | { status: "inserted"; event: ObservationEventV1 }
  | { status: "duplicate"; eventId: string }
  | {
      status: "conflict";
      eventId: string;
      existingContentHash: string;
      incomingContentHash: string;
    };

function json(value: unknown): string {
  return JSON.stringify(value);
}

export async function persistCanonicalEvent(
  db: D1DatabaseLike,
  canonical: CanonicalEventWrite,
  persistedAt = new Date().toISOString(),
): Promise<PersistResult> {
  const event = canonical.event;
  const result = await db.prepare(
    `INSERT OR IGNORE INTO events (
       id, schema_version, idempotency_key, content_hash, provider, capability, source, coverage,
       event, action, derived, resource_type, resource_id, repository, occurred_at, received_at,
       resource_json, actor_json, correlation_json, provenance_json, metadata_json,
       first_message_id, persisted_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    event.id,
    event.schemaVersion,
    canonical.idempotencyKey,
    canonical.contentHash,
    event.provider,
    event.capability,
    event.provenance.source,
    event.provenance.coverage,
    event.event,
    event.action,
    event.derived ? 1 : 0,
    event.resource?.type ?? null,
    event.resource?.id ?? null,
    event.resource?.repository ?? null,
    event.occurredAt,
    event.receivedAt,
    event.resource ? json(event.resource) : null,
    event.actor ? json(event.actor) : null,
    json(event.correlation),
    json(event.provenance),
    json(event.metadata),
    canonical.firstMessageId,
    persistedAt,
  ).run();

  if (Number(result.meta?.changes ?? 0) > 0) {
    return { status: "inserted", event };
  }

  const existing = await db.prepare(
    "SELECT id, content_hash FROM events WHERE idempotency_key = ?",
  ).bind(canonical.idempotencyKey).first<ExistingEventIdentity>();

  if (!existing) {
    throw new Error("event insert ignored without matching idempotency row");
  }
  if (existing.content_hash === canonical.contentHash) {
    return { status: "duplicate", eventId: existing.id };
  }
  return {
    status: "conflict",
    eventId: existing.id,
    existingContentHash: existing.content_hash,
    incomingContentHash: canonical.contentHash,
  };
}

export async function persistIngressMessage(
  db: D1DatabaseLike,
  input: unknown,
  persistedAt = new Date().toISOString(),
): Promise<PersistResult> {
  return persistCanonicalEvent(db, await canonicalEventFromIngress(input), persistedAt);
}

export type ProcessIngressResult =
  | { disposition: "ack"; status: "inserted" | "duplicate"; eventId: string }
  | { disposition: "retry"; status: "invalid" | "conflict" | "storage_error"; reason: string };

export async function processIngressMessage(
  db: D1DatabaseLike,
  input: unknown,
): Promise<ProcessIngressResult> {
  try {
    const result = await persistIngressMessage(db, input);
    if (result.status === "inserted") {
      return { disposition: "ack", status: "inserted", eventId: result.event.id };
    }
    if (result.status === "duplicate") {
      return { disposition: "ack", status: "duplicate", eventId: result.eventId };
    }
    return {
      disposition: "retry",
      status: "conflict",
      reason: "idempotency_key_content_conflict",
    };
  } catch (error) {
    if (error instanceof InvalidIngressMessageError) {
      return {
        disposition: "retry",
        status: "invalid",
        reason: `schema_validation:${error.field}`,
      };
    }
    return {
      disposition: "retry",
      status: "storage_error",
      reason: "event_storage_failed",
    };
  }
}

