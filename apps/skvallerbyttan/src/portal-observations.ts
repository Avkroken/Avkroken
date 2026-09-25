import { WorkerEntrypoint } from "cloudflare:workers";
import type { Env } from "./env";
import { getCapabilities } from "./capabilities";
import { getProviderHealth } from "./provider-health";
import { organization } from "./env";
import { getRepositoryActions } from "./data";
import {
  buildPortalRepositoryCiSnapshot,
  type PortalRepositoryCiSnapshot,
} from "./portal-ci-model";
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

const REPOSITORY_NAME = /^[A-Za-z0-9_.-]+$/;

export async function getPortalRepositoryCiSnapshot(
  env: Env,
  repoName: string,
): Promise<PortalRepositoryCiSnapshot> {
  const repository = `${organization(env)}/${repoName}`;
  const actions = await getRepositoryActions(env, repository);

  return buildPortalRepositoryCiSnapshot({
    generatedAt: new Date().toISOString(),
    repository,
    actions,
  });
}

export class PortalObservationsService extends WorkerEntrypoint<Env> {
  async getPublicOperationsSummary(): Promise<PortalOperationsSnapshot> {
    return getPortalOperationsSnapshot(this.env);
  }

  async getPublicRepositoryCi(repoName: string): Promise<PortalRepositoryCiSnapshot> {
    const normalized = typeof repoName === "string" ? repoName.trim() : "";
    if (
      !normalized ||
      !REPOSITORY_NAME.test(normalized) ||
      normalized === "." ||
      normalized === ".."
    ) {
      throw new Error("invalid repository name");
    }

    return getPortalRepositoryCiSnapshot(this.env, normalized);
  }
}
