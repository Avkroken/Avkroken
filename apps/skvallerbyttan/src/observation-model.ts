export {
  OBSERVATION_STATUSES,
  effectiveStatus,
  freshnessFromTimestamp,
  statusFromHttp,
  type CapabilityRuntimeState,
  type Freshness,
  type ObservationStatus,
  type PermissionState,
  type Provider,
  type ProviderSupport,
} from "../../../packages/observability-contracts/src/index.ts";

import type { Provider } from "../../../packages/observability-contracts/src/index.ts";

export type Provenance = {
  provider: Provider;
  source: string;
  scope: "organization" | "repository" | "account" | "zone" | "service";
  sourceId: string | null;
  direct: boolean;
  inherited: boolean;
  derived: boolean;
  retrievedAt: string;
};

export function provenance(input: Omit<Provenance, "retrievedAt"> & { retrievedAt?: string }): Provenance {
  return {
    ...input,
    retrievedAt: input.retrievedAt ?? new Date().toISOString(),
  };
}
