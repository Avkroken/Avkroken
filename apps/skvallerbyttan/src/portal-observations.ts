import { WorkerEntrypoint } from "cloudflare:workers";
import type { Env } from "./env";
import { getCapabilities, type CapabilityObservation } from "./capabilities";
import { getProviderHealth } from "./provider-health";
import { getObservedActivity } from "./activity";

type PublicProviderStatus =
  | "available"
  | "not_configured"
  | "not_observed"
  | "permission_denied"
  | "error"
  | "unknown";

type PublicCapability = {
  key: string;
  name: string;
  provider: "github" | "cloudflare";
  status: string;
  dataState: string;
  freshness: string;
  lastSuccessAt: string | null;
  scopeCoverage: {
    expected: number;
    observed: number;
    available: number;
    permissionDenied: number;
    error: number;
  } | null;
};

type PublicActivityCoverage = {
  provider: string;
  capability: string;
  source: string;
  coverage: string;
  firstObservedAt: string | null;
  lastObservedAt: string | null;
  periodComplete: false;
  sampling: string;
  observedCount: number;
};

export type PortalOperationsSnapshot = {
  schemaVersion: 1;
  generatedAt: string;
  providers: Array<{
    provider: "github" | "cloudflare";
    status: PublicProviderStatus;
    lastObservedAt: string | null;
  }>;
  capabilities: PublicCapability[];
  activity: {
    available: boolean;
    status: string;
    period: {
      days: number;
      from: string | null;
      to: string | null;
    } | null;
    observedTotal: number;
    byProvider: Array<{ provider: string; observedCount: number }>;
    byCapability: Array<{ provider: string; capability: string; observedCount: number }>;
    coverage: PublicActivityCoverage[];
  };
};

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function array(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(record(item)))
    : [];
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function number(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function providerStatus(value: unknown): PublicProviderStatus {
  return [
    "available",
    "not_configured",
    "not_observed",
    "permission_denied",
    "error",
  ].includes(String(value))
    ? String(value) as PublicProviderStatus
    : "unknown";
}

function sanitizeCapability(capability: CapabilityObservation): PublicCapability {
  return {
    key: capability.key,
    name: capability.name,
    provider: capability.provider,
    status: capability.status,
    dataState: capability.dataState,
    freshness: capability.freshness,
    lastSuccessAt: capability.lastSuccessAt,
    scopeCoverage: capability.scopeCoverage
      ? {
          expected: capability.scopeCoverage.expected,
          observed: capability.scopeCoverage.observed,
          available: capability.scopeCoverage.available,
          permissionDenied: capability.scopeCoverage.permissionDenied,
          error: capability.scopeCoverage.error,
        }
      : null,
  };
}

function sanitizeProvider(
  provider: "github" | "cloudflare",
  providerHealth: Record<string, unknown>,
): PortalOperationsSnapshot["providers"][number] {
  const providers = record(providerHealth.providers);
  const state = record(providers?.[provider]);
  const auth = record(state?.auth);

  return {
    provider,
    status: providerStatus(state?.status),
    lastObservedAt: text(auth?.lastObservedAt),
  };
}

function sanitizeActivity(activity: Record<string, unknown>): PortalOperationsSnapshot["activity"] {
  const available = activity.available === true;
  const grouped = available ? array(activity.grouped) : [];
  const coverage = available ? array(activity.coverage) : [];
  const period = available ? record(activity.period) : null;

  const byProvider = new Map<string, number>();
  const byCapability = new Map<string, { provider: string; capability: string; observedCount: number }>();

  for (const row of grouped) {
    const provider = text(row.provider);
    const capability = text(row.capability);
    const observedCount = number(row.observedCount);
    if (!provider || !capability) continue;

    byProvider.set(provider, (byProvider.get(provider) ?? 0) + observedCount);
    const key = provider + ":" + capability;
    const existing = byCapability.get(key);
    byCapability.set(key, {
      provider,
      capability,
      observedCount: (existing?.observedCount ?? 0) + observedCount,
    });
  }

  const providerRows = [...byProvider.entries()]
    .map(([provider, observedCount]) => ({ provider, observedCount }))
    .sort((left, right) => left.provider.localeCompare(right.provider, "sv"));

  const capabilityRows = [...byCapability.values()]
    .sort((left, right) =>
      right.observedCount - left.observedCount ||
      left.capability.localeCompare(right.capability, "sv")
    );

  const coverageRows: PublicActivityCoverage[] = coverage
    .map((row): PublicActivityCoverage | null => {
      const provider = text(row.provider);
      const capability = text(row.capability);
      const source = text(row.source);
      const coverageValue = text(row.coverage);
      if (!provider || !capability || !source || !coverageValue) return null;

      return {
        provider,
        capability,
        source,
        coverage: coverageValue,
        firstObservedAt: text(row.firstObservedAt),
        lastObservedAt: text(row.lastObservedAt),
        periodComplete: false,
        sampling: text(row.sampling) ?? "unknown",
        observedCount: number(row.observedCount),
      };
    })
    .filter((row): row is PublicActivityCoverage => Boolean(row));

  return {
    available,
    status: text(activity.status) ?? (available ? "available" : "unknown"),
    period: period
      ? {
          days: number(period.days),
          from: text(period.from),
          to: text(period.to),
        }
      : null,
    observedTotal: providerRows.reduce((sum, row) => sum + row.observedCount, 0),
    byProvider: providerRows,
    byCapability: capabilityRows,
    coverage: coverageRows,
  };
}

export function buildPortalOperationsSnapshot(input: {
  generatedAt: string;
  capabilities: CapabilityObservation[];
  providerHealth: Record<string, unknown>;
  activity: Record<string, unknown>;
}): PortalOperationsSnapshot {
  return {
    schemaVersion: 1,
    generatedAt: input.generatedAt,
    providers: [
      sanitizeProvider("github", input.providerHealth),
      sanitizeProvider("cloudflare", input.providerHealth),
    ],
    capabilities: input.capabilities
      .map(sanitizeCapability)
      .sort((left, right) =>
        left.provider.localeCompare(right.provider, "sv") ||
        left.name.localeCompare(right.name, "sv")
      ),
    activity: sanitizeActivity(input.activity),
  };
}

export async function getPortalOperationsSnapshot(env: Env): Promise<PortalOperationsSnapshot> {
  const capabilitySnapshot = await getCapabilities(env);
  const [providerHealth, activity] = await Promise.all([
    Promise.resolve(getProviderHealth(env, capabilitySnapshot.capabilities)),
    getObservedActivity(env, { days: 1 }),
  ]);

  return buildPortalOperationsSnapshot({
    generatedAt: capabilitySnapshot.generatedAt,
    capabilities: capabilitySnapshot.capabilities,
    providerHealth,
    activity,
  });
}

export class PortalObservationsService extends WorkerEntrypoint<Env> {
  async getPublicOperationsSummary(): Promise<PortalOperationsSnapshot> {
    return getPortalOperationsSnapshot(this.env);
  }
}
