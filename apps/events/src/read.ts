import {
  COVERAGE_VALUES,
  OBSERVATION_SOURCES,
  clampPageLimit,
  isFlatMetadata,
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
const CORRELATION_KEYS = new Set([
  "correlationId",
  "eventId",
  "traceId",
  "requestId",
  "providerEventId",
  "resourceId",
  "repository",
  "commitSha",
  "deploymentId",
  "service",
  "environment",
]);

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

type EventCursor = {
  from: string;
  to: string;
  receivedAt: string;
  id: string;
};

type NormalizedEventQuery = {
  limit: number;
  provider: "github" | "cloudflare" | null;
  source: string | null;
  capability: string | null;
  event: string | null;
  repository: string | null;
  repositories: string[] | null;
  resource: string | null;
  from: string;
  to: string;
  cursor: EventCursor | null;
};

function iso(value: string | undefined, field: string): string | null {
  if (value === undefined) return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new InvalidEventQueryError(field);
  return new Date(parsed).toISOString();
}

function validIso(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
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

function encodeCursor(cursor: EventCursor): string {
  return btoa(["v1", cursor.from, cursor.to, cursor.receivedAt, cursor.id].join("\n"))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function decodeCursor(value: string | undefined): EventCursor | null {
  if (value === undefined) return null;
  if (!/^[A-Za-z0-9_-]{1,768}$/.test(value)) throw new InvalidEventQueryError("cursor");
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  let decoded: string;
  try {
    decoded = atob(padded);
  } catch {
    throw new InvalidEventQueryError("cursor");
  }
  const parts = decoded.split("\n");
  if (parts.length !== 5 || parts[0] !== "v1" || !EVENT_ID.test(parts[4])) {
    throw new InvalidEventQueryError("cursor");
  }
  const from = iso(parts[1], "cursor");
  const to = iso(parts[2], "cursor");
  const receivedAt = iso(parts[3], "cursor");
  if (!from || !to || !receivedAt) throw new InvalidEventQueryError("cursor");
  if (Date.parse(from) > Date.parse(to) || Date.parse(to) - Date.parse(from) > MAX_WINDOW_DAYS * DAY_MS) {
    throw new InvalidEventQueryError("cursor");
  }
  return { from, to, receivedAt, id: parts[4] };
}

export function normalizeEventQuery(
  input: EventQueryV1 = {},
  nowMs = Date.now(),
): NormalizedEventQuery {
  const cursor = decodeCursor(input.cursor);
  const explicitTo = iso(input.to, "to");
  const explicitFrom = iso(input.from, "from");
  if (cursor && explicitTo && explicitTo !== cursor.to) throw new InvalidEventQueryError("cursor.to");
  if (cursor && explicitFrom && explicitFrom !== cursor.from) throw new InvalidEventQueryError("cursor.from");

  const to = cursor?.to ?? explicitTo ?? new Date(nowMs).toISOString();
  const from = cursor?.from ?? explicitFrom ?? new Date(Date.parse(to) - DEFAULT_WINDOW_DAYS * DAY_MS).toISOString();
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
    ? null
    : [...new Set(input.repositories.map((value) => repository(value, "repositories")))];
  if (repositories && repositories.length > 50) throw new InvalidEventQueryError("repositories");
  if (singleRepository && repositories !== null) throw new InvalidEventQueryError("repositories");

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
    cursor,
  };
}

function parseObject(value: string | null, field: string, nullable: true): Record<string, unknown> | null;
function parseObject(value: string | null, field: string, nullable: false): Record<string, unknown>;
function parseObject(value: string | null, field: string, nullable: boolean): Record<string, unknown> | null {
  if (value === null) {
    if (nullable) return null;
    throw new CorruptEventRowError(field);
  }
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not object");
    return parsed as Record<string, unknown>;
  } catch {
    throw new CorruptEventRowError(field);
  }
}

function nullOrString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function requireNullOrString(value: unknown, field: string): string | null {
  if (!nullOrString(value)) throw new CorruptEventRowError(field);
  return value;
}

function requiredOwn(record: Record<string, unknown>, key: string, field: string): unknown {
  if (!Object.prototype.hasOwnProperty.call(record, key)) throw new CorruptEventRowError(field);
  return record[key];
}

function validateResource(value: Record<string, unknown> | null): ResourceRefV1 | null {
  if (value === null) return null;
  const type = requiredOwn(value, "type", "resource_json.type");
  const id = requireNullOrString(requiredOwn(value, "id", "resource_json.id"), "resource_json.id");
  const name = requireNullOrString(requiredOwn(value, "name", "resource_json.name"), "resource_json.name");
  const scope = requireNullOrString(requiredOwn(value, "scope", "resource_json.scope"), "resource_json.scope");
  const repositoryValue = requireNullOrString(
    requiredOwn(value, "repository", "resource_json.repository"),
    "resource_json.repository",
  );
  if (typeof type !== "string" || !type.trim()) throw new CorruptEventRowError("resource_json.type");
  return { type, id, name, scope, repository: repositoryValue };
}

function validateActor(value: Record<string, unknown> | null): ActorRefV1 | null {
  if (value === null) return null;
  const id = requiredOwn(value, "id", "actor_json.id");
  const type = requiredOwn(value, "type", "actor_json.type");
  const name = requiredOwn(value, "name", "actor_json.name");
  const slug = requiredOwn(value, "slug", "actor_json.slug");
  const resolved = requiredOwn(value, "resolved", "actor_json.resolved");
  if (!nullOrString(id)) throw new CorruptEventRowError("actor_json.id");
  if (typeof type !== "string" || !type.trim()) throw new CorruptEventRowError("actor_json.type");
  if (!nullOrString(name)) throw new CorruptEventRowError("actor_json.name");
  if (!nullOrString(slug)) throw new CorruptEventRowError("actor_json.slug");
  if (typeof resolved !== "boolean") throw new CorruptEventRowError("actor_json.resolved");
  return { id, type, name, slug, resolved };
}

function validateCorrelation(value: Record<string, unknown>): CorrelationV1 {
  for (const [key, item] of Object.entries(value)) {
    if (!CORRELATION_KEYS.has(key) || typeof item !== "string") {
      throw new CorruptEventRowError(`correlation_json.${key}`);
    }
  }
  return value as CorrelationV1;
}

function validateProvenance(value: Record<string, unknown>): ProvenanceV1 {
  const source = requiredOwn(value, "source", "provenance_json.source");
  const provider = requiredOwn(value, "provider", "provenance_json.provider");
  const observedAt = requiredOwn(value, "observedAt", "provenance_json.observedAt");
  const receivedAt = requiredOwn(value, "receivedAt", "provenance_json.receivedAt");
  const coverage = requiredOwn(value, "coverage", "provenance_json.coverage");
  const periodComplete = requiredOwn(value, "periodComplete", "provenance_json.periodComplete");
  const sampling = requiredOwn(value, "sampling", "provenance_json.sampling");
  const direct = requiredOwn(value, "direct", "provenance_json.direct");
  const inherited = requiredOwn(value, "inherited", "provenance_json.inherited");
  const derived = requiredOwn(value, "derived", "provenance_json.derived");
  const sourceId = requiredOwn(value, "sourceId", "provenance_json.sourceId");

  if (typeof source !== "string" || !(OBSERVATION_SOURCES as readonly string[]).includes(source)) {
    throw new CorruptEventRowError("provenance_json.source");
  }
  if (!nullOrString(provider)) throw new CorruptEventRowError("provenance_json.provider");
  if (!validIso(observedAt)) throw new CorruptEventRowError("provenance_json.observedAt");
  if (receivedAt !== null && !validIso(receivedAt)) throw new CorruptEventRowError("provenance_json.receivedAt");
  if (typeof coverage !== "string" || !(COVERAGE_VALUES as readonly string[]).includes(coverage)) {
    throw new CorruptEventRowError("provenance_json.coverage");
  }
  if (periodComplete !== null && typeof periodComplete !== "boolean") {
    throw new CorruptEventRowError("provenance_json.periodComplete");
  }
  if (!nullOrString(sampling)) throw new CorruptEventRowError("provenance_json.sampling");
  if (typeof direct !== "boolean") throw new CorruptEventRowError("provenance_json.direct");
  if (typeof inherited !== "boolean") throw new CorruptEventRowError("provenance_json.inherited");
  if (typeof derived !== "boolean") throw new CorruptEventRowError("provenance_json.derived");
  if (!nullOrString(sourceId)) throw new CorruptEventRowError("provenance_json.sourceId");

  return {
    source: source as ProvenanceV1["source"],
    provider,
    observedAt,
    receivedAt,
    coverage: coverage as ProvenanceV1["coverage"],
    periodComplete,
    sampling,
    direct,
    inherited,
    derived,
    sourceId,
  };
}

function validateMetadata(value: Record<string, unknown>): Record<string, string | number | boolean | null> {
  if (!isFlatMetadata(value)) throw new CorruptEventRowError("metadata_json");
  return value;
}

export function eventFromRow(row: EventRow): ObservationEventV1 {
  if (row.schema_version !== 1) throw new CorruptEventRowError("schema_version");
  if (!EVENT_ID.test(row.id)) throw new CorruptEventRowError("id");
  if (row.provider !== "github" && row.provider !== "cloudflare") throw new CorruptEventRowError("provider");
  if (typeof row.capability !== "string" || !row.capability.trim() || !row.capability.startsWith(`${row.provider}.`)) {
    throw new CorruptEventRowError("capability");
  }
  if (typeof row.event !== "string" || !row.event.trim()) throw new CorruptEventRowError("event");
  if (row.action !== null && typeof row.action !== "string") throw new CorruptEventRowError("action");
  if (!(OBSERVATION_SOURCES as readonly string[]).includes(row.source)) throw new CorruptEventRowError("source");
  if (!(COVERAGE_VALUES as readonly string[]).includes(row.coverage)) throw new CorruptEventRowError("coverage");
  if (row.derived !== 0 && row.derived !== 1) throw new CorruptEventRowError("derived");
  if (!validIso(row.received_at)) throw new CorruptEventRowError("received_at");
  if (row.occurred_at !== null && !validIso(row.occurred_at)) throw new CorruptEventRowError("occurred_at");

  const resource = validateResource(parseObject(row.resource_json, "resource_json", true));
  const actor = validateActor(parseObject(row.actor_json, "actor_json", true));
  const correlation = validateCorrelation(parseObject(row.correlation_json, "correlation_json", false));
  const provenance = validateProvenance(parseObject(row.provenance_json, "provenance_json", false));
  const metadata = validateMetadata(parseObject(row.metadata_json, "metadata_json", false));

  if ((resource?.type ?? null) !== row.resource_type) throw new CorruptEventRowError("resource_type");
  if ((resource?.id ?? null) !== row.resource_id) throw new CorruptEventRowError("resource_id");
  if ((resource?.repository ?? null) !== row.repository) throw new CorruptEventRowError("repository");
  if (provenance.source !== row.source) throw new CorruptEventRowError("source");
  if (provenance.coverage !== row.coverage) throw new CorruptEventRowError("coverage");
  if (provenance.provider !== null && provenance.provider !== row.provider) {
    throw new CorruptEventRowError("provenance_json.provider");
  }
  if (provenance.derived !== (row.derived === 1)) throw new CorruptEventRowError("derived");

  return {
    id: row.id,
    schemaVersion: 1,
    provider: row.provider,
    capability: row.capability,
    event: row.event,
    action: row.action,
    occurredAt: row.occurred_at,
    receivedAt: row.received_at,
    resource,
    actor,
    correlation,
    provenance,
    derived: row.derived === 1,
    metadata,
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

  if (query.repositories !== null) {
    if (query.repositories.length === 0) {
      clauses.push("1 = 0");
    } else {
      clauses.push(`repository IN (${query.repositories.map(() => "?").join(", ")})`);
      values.push(...query.repositories);
    }
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
    nextCursor: truncated && last
      ? encodeCursor({ from: query.from, to: query.to, receivedAt: last.received_at, id: last.id })
      : null,
    truncated,
  };
}
