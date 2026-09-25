import type { CapabilityObservation } from "./capabilities";

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
};

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
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

export function buildPortalOperationsSnapshot(input: {
  generatedAt: string;
  capabilities: CapabilityObservation[];
  providerHealth: Record<string, unknown>;
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
  };
}
