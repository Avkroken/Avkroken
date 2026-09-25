export type PortalActivityCoverage =
  | "complete"
  | "partial"
  | "sampled"
  | "since_installation"
  | "since_first_observation"
  | "unknown";

export type PortalActivitySource =
  | "webhook"
  | "audit_log"
  | "snapshot_diff"
  | "reconciliation";

export type PortalActivitySnapshot = {
  schemaVersion: 1;
  generatedAt: string;
  available: boolean;
  status: "available" | "not_configured" | "unavailable";
  period: {
    days: number;
    from: string;
    to: string;
  } | null;
  repositoryCount: number;
  grouped: Array<{
    capability: string;
    event: string;
    observedCount: number;
  }>;
  coverage: Array<{
    capability: string;
    source: PortalActivitySource;
    coverage: PortalActivityCoverage;
    firstObservedAt: string | null;
    lastObservedAt: string | null;
    periodComplete: false;
    sampling: string;
    observedCount: number;
  }>;
  recent: Array<{
    repository: string;
    capability: string;
    source: PortalActivitySource;
    coverage: PortalActivityCoverage;
    event: string;
    action: string | null;
    occurredAt: string | null;
    receivedAt: string;
  }>;
};

const PUBLIC_REPOSITORY = /^Avkroken\/[A-Za-z0-9_.-]+$/;
const CAPABILITY = /^github\.avkroken\.[A-Za-z0-9_.-]+$/;
const SOURCES = new Set<PortalActivitySource>([
  "webhook",
  "audit_log",
  "snapshot_diff",
  "reconciliation",
]);
const COVERAGE = new Set<PortalActivityCoverage>([
  "complete",
  "partial",
  "sampled",
  "since_installation",
  "since_first_observation",
  "unknown",
]);

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function safeText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text || text.length > maxLength) return null;
  return text;
}

function timestamp(value: unknown): string | null {
  const text = safeText(value, 64);
  return text && Number.isFinite(Date.parse(text)) ? text : null;
}

function count(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.trunc(number)) : 0;
}

function capability(value: unknown): string | null {
  const text = safeText(value, 120);
  return text && CAPABILITY.test(text) ? text : null;
}

function source(value: unknown): PortalActivitySource | null {
  return typeof value === "string" && SOURCES.has(value as PortalActivitySource)
    ? value as PortalActivitySource
    : null;
}

function coverage(value: unknown): PortalActivityCoverage | null {
  return typeof value === "string" && COVERAGE.has(value as PortalActivityCoverage)
    ? value as PortalActivityCoverage
    : null;
}

function period(value: unknown): PortalActivitySnapshot["period"] {
  const item = record(value);
  if (!item) return null;

  const days = count(item.days);
  const from = timestamp(item.from);
  const to = timestamp(item.to);
  if (days < 1 || days > 30 || !from || !to) return null;

  return { days, from, to };
}

function allowedRepositories(
  organization: string,
  repositoryNames: readonly string[],
): Map<string, string> {
  const result = new Map<string, string>();

  for (const value of repositoryNames.slice(0, 50)) {
    const name = safeText(value, 120);
    if (!name || !/^[A-Za-z0-9_.-]+$/.test(name) || name === "." || name === "..") continue;
    const fullName = organization + "/" + name;
    if (!PUBLIC_REPOSITORY.test(fullName)) continue;
    result.set(name, fullName);
  }

  return result;
}

export function buildPortalActivitySnapshot(input: {
  generatedAt: string;
  organization: string;
  repositoryNames: string[];
  observed: unknown;
}): PortalActivitySnapshot {
  const generatedAt = timestamp(input.generatedAt) ?? new Date(0).toISOString();
  const repositories = allowedRepositories(input.organization, input.repositoryNames);
  const observed = record(input.observed);

  if (!observed) {
    return {
      schemaVersion: 1,
      generatedAt,
      available: false,
      status: "unavailable",
      period: null,
      repositoryCount: repositories.size,
      grouped: [],
      coverage: [],
      recent: [],
    };
  }

  if (observed.available === false) {
    return {
      schemaVersion: 1,
      generatedAt,
      available: false,
      status: observed.status === "not_configured" ? "not_configured" : "unavailable",
      period: null,
      repositoryCount: repositories.size,
      grouped: [],
      coverage: [],
      recent: [],
    };
  }

  const grouped = Array.isArray(observed.grouped)
    ? observed.grouped.flatMap((value) => {
      const item = record(value);
      if (!item || item.provider !== "github") return [];
      const key = capability(item.capability);
      const event = safeText(item.event, 120);
      if (!key || !event) return [];
      return [{
        capability: key,
        event,
        observedCount: count(item.observedCount),
      }];
    })
    : [];

  const coverageRows = Array.isArray(observed.coverage)
    ? observed.coverage.flatMap((value) => {
      const item = record(value);
      if (!item || item.provider !== "github") return [];
      const key = capability(item.capability);
      const rowSource = source(item.source);
      const rowCoverage = coverage(item.coverage);
      if (!key || !rowSource || !rowCoverage) return [];

      return [{
        capability: key,
        source: rowSource,
        coverage: rowCoverage,
        firstObservedAt: timestamp(item.firstObservedAt),
        lastObservedAt: timestamp(item.lastObservedAt),
        periodComplete: false as const,
        sampling: safeText(item.sampling, 80) || "unknown",
        observedCount: count(item.observedCount),
      }];
    })
    : [];

  const recent = Array.isArray(observed.recent)
    ? observed.recent.flatMap((value) => {
      const item = record(value);
      if (!item || item.provider !== "github") return [];

      const shortRepository = safeText(item.repository, 120);
      const repository = shortRepository ? repositories.get(shortRepository) : null;
      const key = capability(item.capability);
      const rowSource = source(item.source);
      const rowCoverage = coverage(item.coverage);
      const event = safeText(item.event, 120);
      const receivedAt = timestamp(item.receivedAt);

      if (!repository || !key || !rowSource || !rowCoverage || !event || !receivedAt) {
        return [];
      }

      return [{
        repository,
        capability: key,
        source: rowSource,
        coverage: rowCoverage,
        event,
        action: safeText(item.action, 120),
        occurredAt: timestamp(item.occurredAt),
        receivedAt,
      }];
    })
    : [];

  return {
    schemaVersion: 1,
    generatedAt,
    available: true,
    status: "available",
    period: period(observed.period),
    repositoryCount: repositories.size,
    grouped,
    coverage: coverageRows,
    recent,
  };
}
