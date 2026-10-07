import {
  OBSERVATION_SOURCES,
  clampPageLimit,
  type ActorRefV1,
  type CorrelationV1,
  type EventQueryV1,
  type ObservationEventV1,
  type PageV1,
  type ProvenanceV1,
  type ResourceRefV1,
} from "../../../packages/observability-contracts/src/index.ts";
import type { D1DatabaseLike } from "./store.ts";

const DAY_MS = 86_400_000;
const DEFAULT_WINDOW_DAYS = 30;
const MAX_WINDOW_DAYS = 90;
const REPOSITORY = /^[A-Za-z0-9_.-]+$/;
const EVENT_ID = /^evt_[0-9a-f]{64}$/;

export class InvalidEventQueryError extends Error {
  constructor(readonly field: string) {
    super(`invalid event query: ${field}`);
    this.name = "InvalidEventQueryError";
  }
}

export class CorruptEventRowError extends Error {
  constructor(readonly field: string) {
    super(`corrupt event row: ${field}`);
    this.name = "CorruptEventRowError";
  }
}

type EventRow = {
  id: string;
  schema_version: number;
  provider: string;
  capability: string;
  source: string;
  coverage: string;
  event: string;
  action: string | null;
  derived: number;
  resource_type: string | null;
  resource_id: string | null;
  repository: string | null;
  occurred_at: string | null;
  received_at: string;
  resource_json: string | null;
  actor_json: string | null;
  correlation_json: string;
  provenance_json: string;
  metadata_json: string;
};

type NormalizedEventQuery = {
  limit: number;
  provider: "github" | "cloudflare" | null;
  source: string | null;
  capability: string | null;
  event: string | null;
  repository: string | null;
  repositories: string[];
  resource: string | null;
  from: string;
  to: string;
  cursor: { receivedAt: string; id: string } | null;
};

function iso(value: string | undefined, field: string): string | null {
  if (value === undefined) return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new InvalidEventQueryError(field);
  return new Date(parsed).toISOString();
}

function text(value: string | undefined, field: string, max: number): string | null {
  if (value === undefined) return null;
  const normalized = value.trim();
  if (!normalized || normalized.length > max) throw new InvalidEventQueryError(field);
  return normalized;
}

function repository(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized || !REPOSITORY.test(normalized) || normalized === "." || normalized === "..") {
    throw new InvalidEventQueryError(field);
  }
  return normalized;
}

function encodeCursor(receivedAt: string, id: string): string {
  return btoa(`${receivedAt}\n${id}`)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function decodeCursor(value: string | undefined): { receivedAt: string; id: string } | null {
  if (value === undefined) return null;
  if (!/^[A-Za-z0-9_-]{1,512}$/.test(value)) throw new InvalidEventQueryError("cursor");
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  let decoded: string;
  try {
    decoded = atob(padded);
  } catch {
    throw new InvalidEventQueryError("cursor");
  }
  const parts = decoded.split("\n");
  if (parts.length !== 2 || !EVENT_ID.test(parts[1])) throw new InvalidEventQueryError("cursor");
  const receivedAt = iso(parts[0], "cursor");
  if (!receivedAt) throw new InvalidEventQueryError("cursor");
  return { receivedAt, id: parts[1] };
}

export function normalizeEventQuery(
  input: EventQueryV1 = {},
  nowMs = Date.now(),
): NormalizedEventQuery {
  const to = iso(input.to, "to") ?? new Date(nowMs).toISOString();
  const from = iso(input.from, "from") ?? new Date(Date.parse(to) - DEFAULT_WINDOW_DAYS * DAY_MS).toISOString();
  const fromMs = Date.parse(from);
  const toMs = Date.parse(to);
  if (fromMs > toMs) throw new InvalidEventQueryError("range");
  if (toMs - fromMs > MAX_WINDOW_DAYS * DAY_MS) throw new InvalidEventQueryError("range");

  const provider = input.provider ?? null;
  if (provider !== null && provider !== "github" && provider !== "cloudflare") {
    throw new InvalidEventQueryError("provider");
  }
  const source = input.source ?? null;
  if (source !== null && !(OBSERVATION_SOURCES as readonly string[]).includes(source)) {
    throw new InvalidEventQueryError("source");
  }
  const singleRepository = input.repository === undefined ? null : repository(input.repository, "repository");
  const repositories = input.repositories === undefined
    ? []
    : [...new Set(input.repositories.map((value) => repository(value, "repositories")))];
  if (repositories.length > 50) throw new InvalidEventQueryError("repositories");
  if (singleRepository && repositories.length) throw new InvalidEventQueryError("repositories");

  return {
    limit: clampPageLimit(input.limit),
    provider,
    source,
    capability: text(input.capability, "capability", 200),
    event: text(input.event, "event", 160),
    repository: singleRepository,
    repositories,
    resource: text(input.resource, "resource", 200),
    from,
    to,
    cursor: decodeCursor(input.cursor),
  };
}

function parseObject<T>(value: string | null, field: string, nullable: true): T | null;
function parseObject<T>(value: string | null, field: string, nullable: false): T;
function parseObject<T>(value: string | null, field: string, nullable: boolean): T | null {
  if (value === null) {
    if (nullable) return null;
    throw new CorruptEventRowError(field);
  }
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("not object");
    }
    return parsed as T;
  } catch {
    throw new CorruptEventRowError(field);
  }
}

export function eventFromRow(row: EventRow): ObservationEventV1 {
  if (row.schema_version !== 1) throw new CorruptEventRowError("schema_version");
  if (!EVENT_ID.test(row.id)) throw new CorruptEventRowError("id");
  if (row.derived !== 0 && row.derived !== 1) throw new CorruptEventRowError("derived");
  return {
    id: row.id,
    schemaVersion: 1,
    provider: row.provider,
    capability: row.capability,
    event: row.event,
    action: row.action,
    occurredAt: row.occurred_at,
    receivedAt: row.received_at,
    resource: parseObject<ResourceRefV1>(row.resource_json, "resource_json", true),
    actor: parseObject<ActorRefV1>(row.actor_json, "actor_json", true),
    correlation: parseObject<CorrelationV1>(row.correlation_json, "correlation_json", false),
    provenance: parseObject<ProvenanceV1>(row.provenance_json, "provenance_json", false),
    derived: row.derived === 1,
    metadata: parseObject<Record<string, string | number | boolean | null>>(row.metadata_json, "metadata_json", false),
  };
}

export async function getEventById(
  db: D1DatabaseLike,
  id: string,
): Promise<ObservationEventV1 | null> {
  if (!EVENT_ID.test(id)) throw new InvalidEventQueryError("id");
  const row = await db.prepare(
    `SELECT id, schema_version, provider, capability, source, coverage, event, action, derived,
            resource_type, resource_id, repository, occurred_at, received_at,
            resource_json, actor_json, correlation_json, provenance_json, metadata_json
       FROM events
      WHERE id = ?`,
  ).bind(id).first<EventRow>();
  return row ? eventFromRow(row) : null;
}

export async function listEvents(
  db: D1DatabaseLike,
  input: EventQueryV1 = {},
  nowMs = Date.now(),
): Promise<PageV1<ObservationEventV1>> {
  const query = normalizeEventQuery(input, nowMs);
  const clauses = ["received_at >= ?", "received_at <= ?"];
  const values: unknown[] = [query.from, query.to];

  const add = (column: string, value: string | null) => {
    if (value === null) return;
    clauses.push(`${column} = ?`);
    values.push(value);
  };
  add("provider", query.provider);
  add("source", query.source);
  add("capability", query.capability);
  add("event", query.event);
  add("repository", query.repository);

  if (query.repositories.length) {
    clauses.push(`repository IN (${query.repositories.map(() => "?").join(", ")})`);
    values.push(...query.repositories);
  }
  if (query.resource) {
    clauses.push("(resource_type = ? OR resource_id = ?)");
    values.push(query.resource, query.resource);
  }
  if (query.cursor) {
    clauses.push("(received_at < ? OR (received_at = ? AND id < ?))");
    values.push(query.cursor.receivedAt, query.cursor.receivedAt, query.cursor.id);
  }

  values.push(query.limit + 1);
  const rows = await db.prepare(
    `SELECT id, schema_version, provider, capability, source, coverage, event, action, derived,
            resource_type, resource_id, repository, occurred_at, received_at,
            resource_json, actor_json, correlation_json, provenance_json, metadata_json
       FROM events
      WHERE ${clauses.join(" AND ")}
      ORDER BY received_at DESC, id DESC
      LIMIT ?`,
  ).bind(...values).all<EventRow>();

  const all = rows.results ?? [];
  const truncated = all.length > query.limit;
  const pageRows = truncated ? all.slice(0, query.limit) : all;
  const items = pageRows.map(eventFromRow);
  const last = pageRows.at(-1);
  return {
    items,
    nextCursor: truncated && last ? encodeCursor(last.received_at, last.id) : null,
    truncated,
  };
}
