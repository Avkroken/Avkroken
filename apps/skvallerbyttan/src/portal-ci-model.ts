import type { ActionSummary, WorkflowRun } from "./metrics";

type RepositoryRun = WorkflowRun & {
  actor?: { login?: string };
  display_title?: string;
  id?: number;
  [key: string]: unknown;
};

export type RepositoryActionsInput = {
  available: boolean;
  summary: ActionSummary | null;
  runs: RepositoryRun[];
  status: number;
  reason?: string;
  acceptedPermissions: string | null;
};

export type PortalRepositoryCiSnapshot = {
  schemaVersion: 1;
  generatedAt: string;
  repository: string;
  available: boolean;
  status: "available" | "unavailable";
  coverage: {
    providerSampleLimit: 100;
    recentRunsLimit: 12;
  };
  summary: {
    totalRuns: number;
    sampledRuns: number;
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
  recentRuns: Array<{
    id: number;
    name: string | null;
    title: string | null;
    event: string | null;
    status: string | null;
    conclusion: string | null;
    createdAt: string | null;
    updatedAt: string | null;
    url: string;
  }>;
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
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function nullableDuration(value: unknown): number | null {
  if (value == null) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function passRate(value: unknown): number | null {
  if (value == null) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 1 ? number : null;
}

function runUrl(repository: string, id: number, value: unknown): string | null {
  const url = safeText(value, 360);
  if (!url) return null;

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.host !== "github.com") return null;
    if (parsed.pathname !== "/" + repository + "/actions/runs/" + id) return null;
    if (parsed.search || parsed.hash || parsed.username || parsed.password) return null;
    return parsed.href;
  } catch {
    return null;
  }
}

function sanitizeSummary(summary: ActionSummary | null): PortalRepositoryCiSnapshot["summary"] {
  if (!summary) return null;

  return {
    totalRuns: nonNegative(summary.totalRuns),
    sampledRuns: nonNegative(summary.sampledRuns),
    completedSample: nonNegative(summary.completedSample),
    successfulSample: nonNegative(summary.successfulSample),
    failedSample: nonNegative(summary.failedSample),
    cancelledSample: nonNegative(summary.cancelledSample),
    inProgressSample: nonNegative(summary.inProgressSample),
    passRate: passRate(summary.passRate),
    failedLast24h: nonNegative(summary.failedLast24h),
    failedLast7d: nonNegative(summary.failedLast7d),
    latestFailureAt: timestamp(summary.latestFailureAt),
    medianDurationMs: nullableDuration(summary.medianDurationMs),
    p95DurationMs: nullableDuration(summary.p95DurationMs),
    mttrMedianMs: nullableDuration(summary.mttrMedianMs),
    mttrSampleCount: nonNegative(summary.mttrSampleCount),
  };
}

export function buildPortalRepositoryCiSnapshot(input: {
  generatedAt: string;
  repository: string;
  actions: RepositoryActionsInput;
}): PortalRepositoryCiSnapshot {
  if (!PUBLIC_REPOSITORY.test(input.repository)) {
    throw new Error("invalid public repository");
  }

  const recentRuns = input.actions.available
    ? input.actions.runs
      .map((run) => {
        const id = Number(run.id);
        if (!Number.isSafeInteger(id) || id <= 0) return null;
        const url = runUrl(input.repository, id, run.html_url);
        if (!url) return null;

        return {
          id,
          name: safeText(run.name, 160),
          title: safeText(run.display_title, 240),
          event: safeText(run.event, 80),
          status: safeText(run.status, 80),
          conclusion: safeText(run.conclusion, 80),
          createdAt: timestamp(run.created_at),
          updatedAt: timestamp(run.updated_at),
          url,
        };
      })
      .filter((run): run is NonNullable<typeof run> => Boolean(run))
      .slice(0, 12)
    : [];

  return {
    schemaVersion: 1,
    generatedAt: timestamp(input.generatedAt) ?? new Date(0).toISOString(),
    repository: input.repository,
    available: input.actions.available,
    status: input.actions.available ? "available" : "unavailable",
    coverage: {
      providerSampleLimit: 100,
      recentRunsLimit: 12,
    },
    summary: input.actions.available ? sanitizeSummary(input.actions.summary) : null,
    recentRuns,
  };
}
