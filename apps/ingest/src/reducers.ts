import type {
  ActorRefV1,
  IngressMessageV1,
  ResourceRefV1,
} from "../../../packages/observability-contracts/src/index.ts";
import { sha256Hex } from "./crypto.ts";

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function text(value: unknown, max = 200): string | null {
  if (typeof value !== "string") return null;
  const result = value.trim();
  return result ? result.slice(0, max) : null;
}

function number(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isoFromUnixSeconds(value: unknown): string | null {
  const seconds = number(value);
  if (seconds === null || seconds < 0) return null;
  const date = new Date(seconds * 1000);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function actorFromGitHub(payload: Record<string, unknown>): ActorRefV1 | null {
  const sender = record(payload.sender);
  if (!sender) return null;
  const id = sender.id;
  const login = text(sender.login, 120);
  const type = text(sender.type, 80) || "unknown";
  if (!login && id == null) return null;
  return {
    id: typeof id === "number" && Number.isSafeInteger(id) ? String(id) : text(id, 120),
    type,
    name: login,
    slug: login,
    resolved: Boolean(login),
  };
}

function githubCapability(event: string): string {
  if (event.startsWith("pull_request")) return "github.avkroken.pull_requests";
  if (
    event === "issues" ||
    event === "issue_comment" ||
    event === "issue_dependencies" ||
    event === "related_issues"
  ) {
    return "github.avkroken.pull_requests";
  }
  if (event.includes("workflow") || event === "check_run" || event === "check_suite" || event === "status") {
    return "github.avkroken.actions";
  }
  if (event.includes("scanning") || event === "dependabot_alert") return "github.avkroken.security";
  if (event === "custom_property" || event === "custom_property_values") return "github.avkroken.custom_properties";
  if (event === "repository_ruleset" || event === "branch_protection_rule") {
    return "github.avkroken.repositories.effective_rulesets";
  }
  return "github.avkroken.repositories";
}

function githubResourceId(payload: Record<string, unknown>): string | null {
  const candidates = [
    record(payload.workflow_run)?.id,
    record(payload.pull_request)?.number,
    record(payload.issue)?.number,
    record(payload.alert)?.number,
    record(payload.ruleset)?.id,
    record(payload.release)?.id,
    record(payload.deployment)?.id,
    record(payload.repository)?.id,
  ];
  for (const value of candidates) {
    if (typeof value === "number" && Number.isSafeInteger(value)) return String(value);
    const candidate = text(value, 120);
    if (candidate) return candidate;
  }
  return null;
}

export function githubOwner(payload: Record<string, unknown>): string | null {
  return text(record(payload.organization)?.login, 120)
    || text(record(record(payload.repository)?.owner)?.login, 120);
}

export function githubRepository(payload: Record<string, unknown>): string | null {
  const name = text(record(payload.repository)?.name, 120);
  return name && /^[A-Za-z0-9_.-]+$/.test(name) ? name : null;
}

export function hasGitHubInstallation(body: string): boolean {
  try {
    const parsed = record(JSON.parse(body));
    return Boolean(parsed && record(parsed.installation));
  } catch {
    return false;
  }
}

export function isRetiredGitHubAppWebhook(hookTargetType: string, body: string): boolean {
  return hookTargetType.toLowerCase() === "integration" || hasGitHubInstallation(body);
}

function securityMetadata(
  event: string,
  payload: Record<string, unknown>,
): Record<string, string | number | boolean | null> {
  const alert = record(payload.alert);
  if (!alert) return {};
  const metadata: Record<string, string | number | boolean | null> = {};
  const alertNumber = number(alert.number);
  if (alertNumber !== null) metadata.alertNumber = alertNumber;

  if (event === "code_scanning_alert") {
    const rule = record(alert.rule);
    metadata.securitySeverity = text(rule?.security_severity_level, 80) || text(rule?.severity, 80);
    metadata.securitySubject = text(rule?.id, 160) || text(rule?.name, 160);
    metadata.securityResolution = text(alert.dismissed_reason, 80);
  } else if (event === "dependabot_alert") {
    const advisory = record(alert.security_advisory);
    const vulnerability = record(alert.security_vulnerability);
    const dependency = record(alert.dependency);
    const dependencyPackage = record(dependency?.package);
    const vulnerabilityPackage = record(vulnerability?.package);
    const packageName = text(dependencyPackage?.name, 120) || text(vulnerabilityPackage?.name, 120);
    const ecosystem = text(dependencyPackage?.ecosystem, 80) || text(vulnerabilityPackage?.ecosystem, 80);
    metadata.securitySeverity = text(advisory?.severity, 80) || text(vulnerability?.severity, 80);
    metadata.securitySubject = packageName ? (ecosystem ? `${ecosystem}:${packageName}` : packageName) : text(advisory?.ghsa_id, 120);
    metadata.securityResolution = text(alert.dismissed_reason, 80);
  } else if (event === "secret_scanning_alert") {
    metadata.securitySubject = text(alert.secret_type_display_name, 160) || text(alert.secret_type, 160);
    metadata.securityResolution = text(alert.resolution, 80);
  }
  return metadata;
}

function resource(repository: string | null, event: string, id: string | null): ResourceRefV1 | null {
  if (!repository && !id) return null;
  return {
    type: event,
    id,
    name: repository,
    scope: repository ? "repository" : null,
    repository,
  };
}

export function reduceGitHubWebhook(input: {
  deliveryId: string;
  event: string;
  payload: Record<string, unknown>;
  receivedAt?: string;
  messageId?: string;
}): IngressMessageV1 {
  const receivedAt = input.receivedAt ?? new Date().toISOString();
  const repository = githubRepository(input.payload);
  const resourceId = githubResourceId(input.payload);
  const action = text(input.payload.action, 120);
  return {
    schemaVersion: 1,
    messageId: input.messageId ?? crypto.randomUUID(),
    idempotencyKey: `github:${input.deliveryId}`,
    provider: "github",
    source: "github",
    capability: githubCapability(input.event),
    event: input.event,
    action,
    receivedAt,
    occurredAt: null,
    resource: resource(repository, input.event, resourceId),
    actor: actorFromGitHub(input.payload),
    correlation: {
      providerEventId: input.deliveryId,
      resourceId: resourceId ?? undefined,
      repository: repository ?? undefined,
    },
    metadata: securityMetadata(input.event, input.payload),
  };
}

function cloudflareCapability(source: "notifications" | "issues" | "casb"): string {
  return source === "notifications"
    ? "cloudflare.avkroken.notifications"
    : source === "issues"
      ? "cloudflare.avkroken.workers"
      : "cloudflare.avkroken.zero_trust";
}

function notificationExplicitDeliveryId(payload: Record<string, unknown>): string | null {
  const correlation = text(payload.alert_correlation_id, 160);
  const event = text(payload.alert_event, 160);
  const timestamp = number(payload.ts);
  return correlation && event ? [correlation, event, timestamp === null ? null : String(timestamp)].filter(Boolean).join(":") : null;
}

export function isGenericCloudflareWebhookTest(payload: Record<string, unknown>): boolean {
  const keys = Object.keys(payload);
  return keys.length === 1 && keys[0] === "text" && Boolean(text(payload.text));
}

export function hasCloudflareIssueIdentity(payload: Record<string, unknown>): boolean {
  return Boolean(text(payload.alert_correlation_id, 160) && text(payload.alert_event, 160));
}

export async function reduceCloudflareWebhook(input: {
  source: "notifications" | "issues" | "casb";
  payload: Record<string, unknown>;
  body: string;
  deliveryId?: string;
  receivedAt?: string;
  messageId?: string;
}): Promise<IngressMessageV1> {
  const receivedAt = input.receivedAt ?? new Date().toISOString();
  const sourcePrefix = input.source === "notifications"
    ? "cloudflare-notifications"
    : input.source === "issues"
      ? "cloudflare-issues"
      : "cloudflare-casb";
  const explicitId = input.source === "casb"
    ? text(input.payload.id, 160)
    : notificationExplicitDeliveryId(input.payload);
  const deliveryId = input.deliveryId?.trim() || (
    explicitId
      ? `${sourcePrefix}:${explicitId}`
      : `${sourcePrefix}:sha256:${await sha256Hex(input.body)}`
  );
  const event = input.source === "casb"
    ? text(input.payload.type, 160) || "posture_finding"
    : text(input.payload.alert_type, 160) || (input.source === "issues" ? "workers_issue" : "notification");
  const action = input.source === "casb" ? null : text(input.payload.alert_event, 160);
  const eventId = input.source === "casb"
    ? text(input.payload.id, 160)
    : text(input.payload.alert_correlation_id, 160);
  const occurredAt = input.source === "casb" ? null : isoFromUnixSeconds(input.payload.ts);
  const metadata: Record<string, string | number | boolean | null> = {};
  if (input.source !== "casb") {
    metadata.accountId = text(input.payload.account_id, 80);
    metadata.policyId = text(input.payload.policy_id, 80);
  }
  if (input.source === "notifications") {
    metadata.summary = text(input.payload.policy_name, 200) || text(input.payload.name, 200);
  }
  return {
    schemaVersion: 1,
    messageId: input.messageId ?? crypto.randomUUID(),
    idempotencyKey: deliveryId,
    provider: "cloudflare",
    source: input.source === "notifications"
      ? "cloudflare_notifications"
      : input.source === "issues"
        ? "cloudflare_issues"
        : "cloudflare_casb",
    capability: cloudflareCapability(input.source),
    event,
    action,
    receivedAt,
    occurredAt,
    resource: eventId ? {
      type: input.source,
      id: eventId,
      name: null,
      scope: "account",
      repository: null,
    } : null,
    actor: null,
    correlation: {
      providerEventId: eventId ?? undefined,
      resourceId: eventId ?? undefined,
    },
    metadata,
  };
}

export function parseObjectJson(body: string): Record<string, unknown> | null {
  try {
    return record(JSON.parse(body));
  } catch {
    return null;
  }
}
