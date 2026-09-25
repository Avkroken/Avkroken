import { WorkerEntrypoint } from "cloudflare:workers";
import type { Env } from "./env";
import { getCapabilities } from "./capabilities";
import { getProviderHealth } from "./provider-health";
import {
  buildPortalOperationsSnapshot,
  type PortalOperationsSnapshot,
} from "./portal-observations-model";

export async function getPortalOperationsSnapshot(env: Env): Promise<PortalOperationsSnapshot> {
  const capabilitySnapshot = await getCapabilities(env);
  const providerHealth = getProviderHealth(env, capabilitySnapshot.capabilities);

  return buildPortalOperationsSnapshot({
    generatedAt: capabilitySnapshot.generatedAt,
    capabilities: capabilitySnapshot.capabilities,
    providerHealth,
  });
}

export class PortalObservationsService extends WorkerEntrypoint<Env> {
  async getPublicOperationsSummary(): Promise<PortalOperationsSnapshot> {
    return getPortalOperationsSnapshot(this.env);
  }
}
