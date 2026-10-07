import type {
  CoverageV1,
  ObservationEventV1,
  ObservationSourceV1,
  Provider,
  ResourceRefV1,
} from "../../../packages/observability-contracts/src/index.ts";
import { canonicalContentHash, canonicalEventIdForKey } from "./identity.ts";
import type { CanonicalEventWrite } from "./store.ts";

const SOURCES = new Set<ObservationSourceV1>([
  "webhook",
  "audit_log",
  "snapshot_diff",
  "reconciliation",
]);
const COVERAGE = new Set<CoverageV1>([
  "complete",
  "partial",
  "sampled",
  "since_installation",
  "since_first_observation",
  "unknown",
]);
const REPOSITORY = /^[A-Za-z0-9_.-]+$/;

export type LegacyObservationEventRow = {
  event_key: string;
  provider: string;
  capability: string;
  source: string;
  coverage: string;
  event: string;
  action: string | null;
  resource_type: string | null;
  resource_id: string | null;
  repository: string | null;
  occurred_at: string | null;
  received_at: string;
};

export class InvalidLegacyEventError extends Error {
  constructor(readonly field: string) {
    super(`invalid legacy event: ${field}`);
    this.name = "InvalidLegacyEventError";
  }
}

function required(value: string, field: string, max: number): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > max) throw new InvalidLegacyEventError(field);
  return normalized;
}

function optional(value: string | null, field: string, max: number): string | null {
  if (value === null) return null;
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.length > max) throw new InvalidLegacyEventError(field);
  return normalized;
}

function timestamp(value: string | null, field: string, requiredValue: true): string;
function timestamp(value: string | null, field: string, requiredValue: false): string | null;
function timestamp(value: string | null, field: string, requiredValue: boolean): string | null {
  if (value === null && !requiredValue) return null;
  if (value === null) throw new InvalidLegacyEventError(field);
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new InvalidLegacyEventError(field);
  return new Date(parsed).toISOString();
}

function legacyResource(row: LegacyObservationEventRow): ResourceRefV1 | null {
  const type = optional(row.resource_type, "resource_type", 120);
  const id = optional(row.resource_id, "resource_id", 200);
  const repository = optional(row.repository, "repository", 160);
  if (repository && !REPOSITORY.test(repository)) throw new InvalidLegacyEventError("repository");
  if (!type && !id && !repository) return null;
  if (!type) throw new InvalidLegacyEventError("resource_type");
  return { type, id, name: repository, scope: repository ? "repository" : null, repository };
}

function canonicalLegacyIdempotencyKey(
  provider: Provider,
  source: ObservationSourceV1,
  eventKey: string,
  capability: string,
): string {
  if (source !== "webhook") return `legacy:${eventKey}`;
  const suffix = `:${capability}`;
  if (!eventKey.endsWith(suffix)) throw new InvalidLegacyEventError("event_key");
  const deliveryKey = eventKey.slice(0, -suffix.length);
  if (provider === "github") {
    if (!deliveryKey.startsWith("github:")) throw new InvalidLegacyEventError("event_key");
    return deliveryKey;
  }
  if (!deliveryKey.startsWith("cloudflare:")) throw new InvalidLegacyEventError("event_key");
  const canonical = deliveryKey.slice("cloudflare:".length);
  if (!canonical.startsWith("cloudflare-")) throw new InvalidLegacyEventError("event_key");
  return canonical;
}

export async function canonicalEventFromLegacyRow(
  row: LegacyObservationEventRow,
): Promise<CanonicalEventWrite> {
  const eventKey = required(row.event_key, "event_key", 512);
  const provider = required(row.provider, "provider", 40) as Provider;
  if (provider !== "github" && provider !== "cloudflare") throw new InvalidLegacyEventError("provider");
  const source = required(row.source, "source", 80) as ObservationSourceV1;
  if (!SOURCES.has(source)) throw new InvalidLegacyEventError("source");
  const coverage = required(row.coverage, "coverage", 80) as CoverageV1;
  if (!COVERAGE.has(coverage)) throw new InvalidLegacyEventError("coverage");
  const receivedAt = timestamp(row.received_at, "received_at", true);
  const occurredAt = timestamp(row.occurred_at, "occurred_at", false);
  const resource = legacyResource(row);
  const capability = required(row.capability, "capability", 200);
  const idempotencyKey = canonicalLegacyIdempotencyKey(provider, source, eventKey, capability);
  const event: ObservationEventV1 = {
    id: await canonicalEventIdForKey(idempotencyKey),
    schemaVersion: 1,
    provider,
    capability,
    event: required(row.event, "event", 160),
    action: optional(row.action, "action", 160),
    occurredAt,
    receivedAt,
    resource,
    actor: null,
    correlation: {
      eventId: eventKey,
      resourceId: resource?.id ?? undefined,
      repository: resource?.repository ?? undefined,
    },
    provenance: {
      source,
      provider,
      observedAt: occurredAt ?? receivedAt,
      receivedAt,
      coverage,
      periodComplete: false,
      sampling: null,
      direct: false,
      inherited: false,
      derived: false,
      sourceId: eventKey,
    },
    derived: false,
    metadata: {},
  };
  const fingerprint = JSON.stringify({
    provider: event.provider,
    capability: event.capability,
    event: event.event,
    action: event.action,
    occurredAt: event.occurredAt,
    receivedAt: event.receivedAt,
    resource: event.resource,
    correlation: event.correlation,
    provenance: event.provenance,
  });
  return {
    event,
    idempotencyKey,
    contentHash: await canonicalContentHash(fingerprint),
    firstMessageId: idempotencyKey,
  };
}

export const MAX_LEGACY_IMPORT_BATCH = 1000;

export type LegacyImportPlan = {
  total: number;
  valid: number;
  excluded: Array<{ index: number; reason: "at_or_after_cutover" }>;
  invalid: Array<{ index: number; field: string }>;
  writes: CanonicalEventWrite[];
};

export async function planLegacyImport(
  rows: readonly LegacyObservationEventRow[],
  input: { beforeExclusive: string },
): Promise<LegacyImportPlan> {
  if (rows.length > MAX_LEGACY_IMPORT_BATCH) {
    throw new RangeError("legacy import batch exceeds configured maximum");
  }
  const boundary = Date.parse(input.beforeExclusive);
  if (!Number.isFinite(boundary)) throw new InvalidLegacyEventError("beforeExclusive");
  const writes: CanonicalEventWrite[] = [];
  const excluded: Array<{ index: number; reason: "at_or_after_cutover" }> = [];
  const invalid: Array<{ index: number; field: string }> = [];
  for (let index = 0; index < rows.length; index += 1) {
    try {
      const receivedAt = Date.parse(rows[index].received_at);
      if (Number.isFinite(receivedAt) && receivedAt >= boundary) {
        excluded.push({ index, reason: "at_or_after_cutover" });
        continue;
      }
      writes.push(await canonicalEventFromLegacyRow(rows[index]));
    } catch (error) {
      if (error instanceof InvalidLegacyEventError) {
        invalid.push({ index, field: error.field });
        continue;
      }
      throw error;
    }
  }
  return { total: rows.length, valid: writes.length, excluded, invalid, writes };
}
