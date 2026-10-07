export const OBSERVATION_STATUSES = [
  "available",
  "unavailable",
  "permission_denied",
  "not_configured",
  "not_supported",
  "not_exposed_by_provider",
  "unknown",
  "not_observed",
  "stale",
  "error",
] as const;

export const AUTH_ISSUER_V1 = "https://auth.denied.se" as const;

export const SERVICE_IDS = [
  "auth",
  "ingest",
  "events",
  "state",
  "logs",
  "statistik",
  "status",
  "api",
  "skvallerbyttan",
  "docs",
  "logos",
] as const;

export const OBSERVATION_SOURCES = [
  "webhook",
  "audit_log",
  "snapshot_diff",
  "reconciliation",
  "provider_api",
  "runtime",
  "import",
  "derived",
] as const;

export const COVERAGE_VALUES = [
  "complete",
  "partial",
  "sampled",
  "since_installation",
  "since_first_observation",
  "unknown",
] as const;

export type ObservationStatus = (typeof OBSERVATION_STATUSES)[number];
export type ServiceId = (typeof SERVICE_IDS)[number];
export type ObservationSourceV1 = (typeof OBSERVATION_SOURCES)[number];
export type CoverageV1 = (typeof COVERAGE_VALUES)[number];
export type Provider = "github" | "cloudflare";
export type ProviderSupport = "supported" | "not_supported" | "not_exposed_by_provider" | "unknown";
export type PermissionState = "granted" | "permission_denied" | "not_required" | "unknown";
export type Freshness = "fresh" | "stale" | "unknown";
export type Completeness = "complete" | "partial" | "unknown";
export type IncidentStateV1 = "open" | "recovering" | "resolved";
export type IdentityKindV1 = "user" | "machine" | "service";

export type IngressSourceV1 =
  | "github"
  | "cloudflare_notifications"
  | "cloudflare_issues"
  | "cloudflare_casb";

export interface IngressMessageV1 {
  schemaVersion: 1;
  messageId: string;
  idempotencyKey: string;
  provider: Provider;
  source: IngressSourceV1;
  capability: string;
  event: string;
  action: string | null;
  receivedAt: string;
  occurredAt: string | null;
  resource: ResourceRefV1 | null;
  actor: ActorRefV1 | null;
  correlation: CorrelationV1;
  metadata: Record<string, string | number | boolean | null>;
}

export type CapabilityRuntimeState = {
  status: ObservationStatus;
  permissionState: PermissionState;
  dataState: ObservationStatus;
  freshness: Freshness;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastHttpStatus: number | null;
  lastError: string | null;
};

export interface ProvenanceV1 {
  source: ObservationSourceV1;
  provider: string | null;
  observedAt: string;
  receivedAt: string | null;
  coverage: CoverageV1;
  periodComplete: boolean | null;
  sampling: string | null;
  direct: boolean;
  inherited: boolean;
  derived: boolean;
  sourceId: string | null;
}

export interface CorrelationV1 {
  correlationId?: string;
  eventId?: string;
  traceId?: string;
  requestId?: string;
  providerEventId?: string;
  resourceId?: string;
  repository?: string;
  commitSha?: string;
  deploymentId?: string;
  service?: string;
  environment?: string;
}

export interface ResourceRefV1 {
  type: string;
  id: string | null;
  name: string | null;
  scope: string | null;
  repository: string | null;
}

export interface ActorRefV1 {
  id: string | null;
  type: string;
  name: string | null;
  slug: string | null;
  resolved: boolean;
}

export interface ServiceResultV1<T> {
  schemaVersion: 1;
  service: ServiceId;
  generatedAt: string;
  status: ObservationStatus;
  freshness: Freshness;
  completeness: Completeness;
  lastSuccessAt: string | null;
  reason: string | null;
  staleDataAvailable: boolean;
  data: T | null;
  provenance?: ProvenanceV1[];
  correlation?: CorrelationV1;
}

export interface ObservationEventV1 {
  id: string;
  schemaVersion: 1;
  provider: string;
  capability: string;
  event: string;
  action: string | null;
  occurredAt: string | null;
  receivedAt: string;
  resource: ResourceRefV1 | null;
  actor: ActorRefV1 | null;
  correlation: CorrelationV1;
  provenance: ProvenanceV1;
  derived: boolean;
  metadata: Record<string, string | number | boolean | null>;
}

export interface StateRecordV1<T> {
  id: string;
  schemaVersion: 1;
  provider: string;
  capability: string;
  scope: ResourceRefV1;
  status: ObservationStatus;
  providerSupport: ProviderSupport;
  permissionState: PermissionState;
  dataState: ObservationStatus;
  freshness: Freshness;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastHttpStatus: number | null;
  reason: string | null;
  derived: boolean;
  provenance: ProvenanceV1[];
  value: T | null;
}

export interface DependencyStatusV1 {
  service: ServiceId | string;
  status: ObservationStatus;
  freshness: Freshness;
  required: boolean;
  observedAt: string | null;
  reason: string | null;
}

export interface ServiceStatusV1 {
  service: ServiceId;
  status: ObservationStatus;
  freshness: Freshness;
  ready: boolean | null;
  live: boolean | null;
  observedAt: string | null;
  lastSuccessAt: string | null;
  reason: string | null;
  dependencies: DependencyStatusV1[];
  activeIncidentIds: string[];
}

export interface TimeRangeV1 {
  from: string;
  to: string;
}

export interface MetricPointV1 {
  timestamp: string;
  value: number;
  sampleInterval?: number;
}

export interface ErrorRecordV1 {
  id: string;
  service: string;
  environment: string | null;
  code: string;
  message: string;
  occurredAt: string;
  severity: "debug" | "info" | "warning" | "error" | "critical";
  correlation: CorrelationV1;
  deployment: {
    versionId?: string;
    commitSha?: string;
  } | null;
}

export interface ApiErrorV1 {
  schemaVersion: 1;
  service: ServiceId;
  generatedAt: string;
  error: {
    code: string;
    message: string;
    retryable: boolean;
  };
  correlation?: CorrelationV1;
}

export interface PageRequestV1 {
  cursor?: string;
  limit?: number;
}

export interface EventQueryV1 extends PageRequestV1 {
  provider?: Provider;
  source?: ObservationSourceV1;
  capability?: string;
  event?: string;
  repository?: string;
  repositories?: string[];
  resource?: string;
  from?: string;
  to?: string;
}

export interface PageV1<T> {
  items: T[];
  nextCursor: string | null;
  truncated: boolean;
}

export interface SectionResultV1<T> {
  service: ServiceId;
  status: ObservationStatus;
  freshness: Freshness;
  data: T | null;
  reason: string | null;
}

export interface AggregateV1<TSections extends Record<string, SectionResultV1<unknown>>> {
  schemaVersion: 1;
  generatedAt: string;
  completeness: Completeness;
  sections: TSections;
}

export interface AuthClaimsV1 {
  v: 1;
  iss: typeof AUTH_ISSUER_V1;
  sub: string;
  kind: IdentityKindV1;
  aud: string | string[];
  scopes: string[];
  iat: number;
  exp: number;
  nbf?: number;
  jti: string;
}

export function isObservationStatus(value: string): value is ObservationStatus {
  return (OBSERVATION_STATUSES as readonly string[]).includes(value);
}

export function freshnessFromTimestamp(
  lastSuccessAt: string | null,
  ttlMs: number,
  nowMs = Date.now(),
): Freshness {
  if (!lastSuccessAt) return "unknown";
  const timestamp = Date.parse(lastSuccessAt);
  if (!Number.isFinite(timestamp)) return "unknown";
  return nowMs - timestamp <= ttlMs ? "fresh" : "stale";
}

export function statusFromHttp(
  status: number,
): Pick<CapabilityRuntimeState, "status" | "permissionState" | "dataState"> {
  if (status >= 200 && status < 300) {
    return { status: "available", permissionState: "granted", dataState: "available" };
  }
  if (status === 401 || status === 403) {
    return { status: "permission_denied", permissionState: "permission_denied", dataState: "unavailable" };
  }
  if (status === 404) {
    return { status: "unknown", permissionState: "unknown", dataState: "unknown" };
  }
  if (status === 0 || status === 408 || status === 429 || status >= 500) {
    return { status: "error", permissionState: "unknown", dataState: "error" };
  }
  return { status: "unavailable", permissionState: "unknown", dataState: "unavailable" };
}

export function effectiveStatus(input: {
  implemented: boolean;
  providerSupport: ProviderSupport;
  permissionState: PermissionState;
  dataState: ObservationStatus;
  freshness: Freshness;
}): ObservationStatus {
  if (!input.implemented) return "not_supported";
  if (input.providerSupport === "not_supported") return "not_supported";
  if (input.providerSupport === "not_exposed_by_provider") return "not_exposed_by_provider";
  if (input.permissionState === "permission_denied") return "permission_denied";
  if (input.dataState === "not_configured") return "not_configured";
  if (input.dataState === "not_observed") return "not_observed";
  if (input.dataState === "error") return "error";
  if (input.dataState === "unknown") return "unknown";
  if (input.freshness === "stale" && input.dataState === "available") return "stale";
  return input.dataState;
}

export function clampPageLimit(value: number | undefined, defaults = { value: 50, max: 100 }): number {
  if (!Number.isFinite(value)) return defaults.value;
  const integer = Math.trunc(value as number);
  if (integer < 1) return 1;
  return Math.min(integer, defaults.max);
}

export function authClaimsAllow(
  claims: AuthClaimsV1,
  audience: string,
  requiredScopes: readonly string[],
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (claims.iss !== AUTH_ISSUER_V1) return false;
  if (!audiences.includes(audience)) return false;
  if (claims.nbf !== undefined && claims.nbf > nowSeconds) return false;
  if (claims.iat > nowSeconds + 60) return false;
  if (claims.exp <= nowSeconds) return false;
  const scopes = new Set(claims.scopes);
  return requiredScopes.every((scope) => scopes.has(scope));
}

export function isFlatMetadata(
  value: Record<string, unknown>,
): value is Record<string, string | number | boolean | null> {
  return Object.values(value).every((item) =>
    item === null || typeof item === "string" || typeof item === "number" || typeof item === "boolean"
  );
}
