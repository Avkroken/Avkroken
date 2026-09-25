import type { ActionSummary } from "./metrics";

export type PortalCiFreshness = "fresh" | "stale" | "unknown";

export type PortalRepositoryCiSnapshot = {
  schemaVersion: 1;
  generatedAt: string;
  repository: string;
  available: boolean;
  status: "available" | "unavailable" | "not_observed";
  freshness: PortalCiFreshness;
  sourceRefreshedAt: string | null;
  coverage: {
    sampledRuns: number;
    totalRuns: number;
    sampleLimit: 100;
  } | null;
  summary: {
    completedSample: number;
    successfulSample: number;
    failedSample: number;
    cancelledSample: number;
    inProgressSample: number;
    passRate: number | null;
    failedLast24h: number;
    failedLast7d: number;
    latestFailureAt: string | null;
    medianDurationMs: number | null;
    p95DurationMs: number | null;
    mttrMedianMs: number | null;
    mttrSampleCount: number;
  } | null;
};

export type PortalCiRepositoryObservation = {
  fullName?: unknown;
  visibility?: unknown;
  archived?: unknown;
  actions?: unknown;
  capabilities?: unknown;
};

const PUBLIC_REPOSITORY = /^Avkroken\/[A-Za-z0-9._-]+$/;

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

function nonNegative(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.trunc(number)) : 0;
}

function nullableDuration(value: unknown): number | null {
  if (value == null) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function normalizedPassRate(value: unknown): number | null {
  if (value == null) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 1 ? number : null;
}

function actionSummary(value: unknown): ActionSummary | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as ActionSummary;
}

function actionsAvailable(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return (value as Record<string, unknown>).actions === true;
}

export function publicCiRepository(
  repositories: PortalCiRepositoryObservation[],
  repository: string,
): PortalCiRepositoryObservation | null {
  if (!PUBLIC_REPOSITORY.test(repository)) return null;

  return repositories.find((row) =>
    row?.fullName === repository &&
    row?.visibility === "public" &&
    row?.archived !== true
  ) ?? null;
}

export function buildPortalRepositoryCiSnapshot(input: {
  generatedAt: string;
  repository: string;
  observation: PortalCiRepositoryObservation | null;
  sourceRefreshedAt: string | null;
  freshness: PortalCiFreshness;
}): PortalRepositoryCiSnapshot {
  if (!PUBLIC_REPOSITORY.test(input.repository)) {
    throw new Error("invalid public repository");
  }

  const generatedAt = timestamp(input.generatedAt) ?? new Date(0).toISOString();
  const sourceRefreshedAt = timestamp(input.sourceRefreshedAt);

  if (!input.observation) {
    return {
      schemaVersion: 1,
      generatedAt,
      repository: input.repository,
      available: false,
      status: "not_observed",
      freshness: "unknown",
      sourceRefreshedAt,
      coverage: null,
      summary: null,
    };
  }

  const summary = actionSummary(input.observation.actions);
  const available = actionsAvailable(input.observation.capabilities) && summary !== null;

  if (!available || !summary) {
    return {
      schemaVersion: 1,
      generatedAt,
      repository: input.repository,
      available: false,
      status: "unavailable",
      freshness: input.freshness,
      sourceRefreshedAt,
      coverage: null,
      summary: null,
    };
  }

  const sampledRuns = nonNegative(summary.sampledRuns);
  const totalRuns = nonNegative(summary.totalRuns);

  return {
    schemaVersion: 1,
    generatedAt,
    repository: input.repository,
    available: true,
    status: "available",
    freshness: input.freshness,
    sourceRefreshedAt,
    coverage: {
      sampledRuns,
      totalRuns,
      sampleLimit: 100,
    },
    summary: {
      completedSample: nonNegative(summary.completedSample),
      successfulSample: nonNegative(summary.successfulSample),
      failedSample: nonNegative(summary.failedSample),
      cancelledSample: nonNegative(summary.cancelledSample),
      inProgressSample: nonNegative(summary.inProgressSample),
      passRate: normalizedPassRate(summary.passRate),
      failedLast24h: nonNegative(summary.failedLast24h),
      failedLast7d: nonNegative(summary.failedLast7d),
      latestFailureAt: timestamp(summary.latestFailureAt),
      medianDurationMs: nullableDuration(summary.medianDurationMs),
      p95DurationMs: nullableDuration(summary.p95DurationMs),
      mttrMedianMs: nullableDuration(summary.mttrMedianMs),
      mttrSampleCount: nonNegative(summary.mttrSampleCount),
    },
  };
}
