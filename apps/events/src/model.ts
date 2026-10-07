import {
  type ActorRefV1,
  type CorrelationV1,
  type IngressMessageV1,
  type ObservationEventV1,
  type ResourceRefV1,
} from "../../../packages/observability-contracts/src/index.ts";
import { canonicalContentHash, canonicalEventIdForKey } from "./identity.ts";
const INGEST_SOURCES = new Set([
  "github",
  "cloudflare_notifications",
  "cloudflare_issues",
  "cloudflare_casb",
]);

export class InvalidIngressMessageError extends Error {
  constructor(readonly field: string) {
    super(`invalid ingress message: ${field}`);
    this.name = "InvalidIngressMessageError";
  }
}

function object(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new InvalidIngressMessageError(field);
  }
  return value as Record<string, unknown>;
}

function requiredString(value: unknown, field: string, max: number): string {
  if (typeof value !== "string") throw new InvalidIngressMessageError(field);
  const result = value.trim();
  if (!result || result.length > max) throw new InvalidIngressMessageError(field);
  return result;
}

function optionalString(value: unknown, field: string, max: number): string | null {
  if (value == null) return null;
  if (typeof value !== "string") throw new InvalidIngressMessageError(field);
  const result = value.trim();
  if (!result) return null;
  if (result.length > max) throw new InvalidIngressMessageError(field);
  return result;
}

function iso(value: unknown, field: string, required: true): string;
function iso(value: unknown, field: string, required: false): string | null;
function iso(value: unknown, field: string, required: boolean): string | null {
  if (value == null && !required) return null;
  if (typeof value !== "string") throw new InvalidIngressMessageError(field);
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new InvalidIngressMessageError(field);
  return new Date(timestamp).toISOString();
}

function resource(value: unknown): ResourceRefV1 | null {
  if (value == null) return null;
  const input = object(value, "resource");
  return {
    type: requiredString(input.type, "resource.type", 120),
    id: optionalString(input.id, "resource.id", 200),
    name: optionalString(input.name, "resource.name", 200),
    scope: optionalString(input.scope, "resource.scope", 120),
    repository: optionalString(input.repository, "resource.repository", 160),
  };
}

function actor(value: unknown): ActorRefV1 | null {
  if (value == null) return null;
  const input = object(value, "actor");
  if (typeof input.resolved !== "boolean") throw new InvalidIngressMessageError("actor.resolved");
  return {
    id: optionalString(input.id, "actor.id", 160),
    type: requiredString(input.type, "actor.type", 80),
    name: optionalString(input.name, "actor.name", 160),
    slug: optionalString(input.slug, "actor.slug", 160),
    resolved: input.resolved,
  };
}

function correlation(value: unknown): CorrelationV1 {
  const input = object(value, "correlation");
  const result: CorrelationV1 = {};
  const fields = [
    ["correlationId", 200],
    ["eventId", 200],
    ["traceId", 200],
    ["requestId", 200],
    ["providerEventId", 240],
    ["resourceId", 200],
    ["repository", 160],
    ["commitSha", 80],
    ["deploymentId", 200],
    ["service", 120],
    ["environment", 80],
  ] as const;
  for (const [field, max] of fields) {
    const normalized = optionalString(input[field], `correlation.${field}`, max);
    if (normalized !== null) result[field] = normalized;
  }
  return result;
}

function assertJsonLength(value: unknown, field: string, max: number): void {
  if (JSON.stringify(value).length > max) throw new InvalidIngressMessageError(field);
}

function metadata(value: unknown): Record<string, string | number | boolean | null> {
  const input = object(value, "metadata");
  const entries = Object.entries(input);
  if (entries.length > 32) throw new InvalidIngressMessageError("metadata.size");
  const result: Record<string, string | number | boolean | null> = {};
  for (const [key, item] of entries) {
    if (!/^[A-Za-z0-9_.:-]{1,80}$/.test(key)) throw new InvalidIngressMessageError("metadata.key");
    if (item === null || typeof item === "boolean") {
      result[key] = item;
      continue;
    }
    if (typeof item === "number") {
      if (!Number.isFinite(item)) throw new InvalidIngressMessageError(`metadata.${key}`);
      result[key] = item;
      continue;
    }
    if (typeof item === "string" && item.length <= 500) {
      result[key] = item;
      continue;
    }
    throw new InvalidIngressMessageError(`metadata.${key}`);
  }
  assertJsonLength(result, "metadata.size", 16384);
  return result;
}

export function normalizeIngressMessage(value: unknown): IngressMessageV1 {
  const input = object(value, "message");
  if (input.schemaVersion !== 1) throw new InvalidIngressMessageError("schemaVersion");
  const provider = requiredString(input.provider, "provider", 40);
  if (provider !== "github" && provider !== "cloudflare") {
    throw new InvalidIngressMessageError("provider");
  }
  const source = requiredString(input.source, "source", 80);
  if (!INGEST_SOURCES.has(source)) throw new InvalidIngressMessageError("source");
  if ((provider === "github") !== (source === "github")) {
    throw new InvalidIngressMessageError("provider/source");
  }
  const capability = requiredString(input.capability, "capability", 200);
  if (!capability.startsWith(`${provider}.`)) {
    throw new InvalidIngressMessageError("capability/provider");
  }

  const normalizedResource = resource(input.resource);
  const normalizedActor = actor(input.actor);
  const normalizedCorrelation = correlation(input.correlation);
  const normalizedMetadata = metadata(input.metadata);
  if (normalizedResource) assertJsonLength(normalizedResource, "resource.size", 4096);
  if (normalizedActor) assertJsonLength(normalizedActor, "actor.size", 4096);
  assertJsonLength(normalizedCorrelation, "correlation.size", 8192);

  return {
    schemaVersion: 1,
    messageId: requiredString(input.messageId, "messageId", 128),
    idempotencyKey: requiredString(input.idempotencyKey, "idempotencyKey", 512),
    provider,
    source: source as IngressMessageV1["source"],
    capability,
    event: requiredString(input.event, "event", 160),
    action: optionalString(input.action, "action", 160),
    receivedAt: iso(input.receivedAt, "receivedAt", true),
    occurredAt: iso(input.occurredAt, "occurredAt", false),
    resource: normalizedResource,
    actor: normalizedActor,
    correlation: normalizedCorrelation,
    metadata: normalizedMetadata,
  };
}

function sortedMetadata(
  value: Record<string, string | number | boolean | null>,
): Record<string, string | number | boolean | null> {
  return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)));
}

function semanticFingerprint(message: IngressMessageV1): string {
  return JSON.stringify({
    provider: message.provider,
    source: message.source,
    capability: message.capability,
    event: message.event,
    action: message.action,
    occurredAt: message.occurredAt,
    resource: message.resource,
    actor: message.actor,
    correlation: message.correlation,
    metadata: sortedMetadata(message.metadata),
  });
}

export type CanonicalizedIngress = {
  event: ObservationEventV1;
  idempotencyKey: string;
  contentHash: string;
  firstMessageId: string;
};

export async function canonicalEventFromIngress(value: unknown): Promise<CanonicalizedIngress> {
  const message = normalizeIngressMessage(value);
  const eventId = await canonicalEventIdForKey(message.idempotencyKey);
  const contentHash = await canonicalContentHash(semanticFingerprint(message));
  const event: ObservationEventV1 = {
    id: eventId,
    schemaVersion: 1,
    provider: message.provider,
    capability: message.capability,
    event: message.event,
    action: message.action,
    occurredAt: message.occurredAt,
    receivedAt: message.receivedAt,
    resource: message.resource,
    actor: message.actor,
    correlation: message.correlation,
    provenance: {
      source: "webhook",
      provider: message.provider,
      observedAt: message.occurredAt ?? message.receivedAt,
      receivedAt: message.receivedAt,
      coverage: "since_first_observation",
      periodComplete: false,
      sampling: "none",
      direct: true,
      inherited: false,
      derived: false,
      sourceId: message.idempotencyKey,
    },
    derived: false,
    metadata: message.metadata,
  };
  return {
    event,
    idempotencyKey: message.idempotencyKey,
    contentHash,
    firstMessageId: message.messageId,
  };
}

export function legacyActivityProjection(event: ObservationEventV1): {
  provider: string;
  capability: string;
  source: string;
  coverage: string;
  event: string;
  action: string | null;
  resourceType: string | null;
  resourceId: string | null;
  repository: string | null;
  occurredAt: string | null;
  receivedAt: string;
} {
  return {
    provider: event.provider,
    capability: event.capability,
    source: event.provenance.source,
    coverage: event.provenance.coverage,
    event: event.event,
    action: event.action,
    resourceType: event.resource?.type ?? null,
    resourceId: event.resource?.id ?? null,
    repository: event.resource?.repository ?? null,
    occurredAt: event.occurredAt,
    receivedAt: event.receivedAt,
  };
}
