import { WorkerEntrypoint } from "cloudflare:workers";
import type { Env } from "./env";
import { getCapabilities } from "./capabilities";
import { getProviderHealth } from "./provider-health";
import { organization } from "./env";
import {
  buildPortalRepositoryCiSnapshot,
  publicCiRepository,
  type PortalCiRepositoryObservation,
  type PortalRepositoryCiSnapshot,
} from "./portal-ci-model";
import {
  readSourceCache,
  sourceCacheAgeMs,
  sourceCacheInvalidated,
} from "./source-cache";
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

const PORTAL_CI_FRESH_MS = 6 * 60 * 60 * 1000;

type OverviewCache = {
  repositories?: PortalCiRepositoryObservation[];
};

export async function getPortalRepositoryCiSnapshot(
  env: Env,
  repoName: string,
): Promise<PortalRepositoryCiSnapshot> {
  const repository = `${organization(env)}/${repoName}`;
  const cached = await readSourceCache<OverviewCache>(env, "overview");
  const repositories = Array.isArray(cached?.value?.repositories)
    ? cached.value.repositories
    : [];
  const observation = publicCiRepository(repositories, repository);

  const stale = cached
    ? sourceCacheInvalidated(cached) ||
      sourceCacheAgeMs(cached.refreshedAt) > PORTAL_CI_FRESH_MS
    : false;

  return buildPortalRepositoryCiSnapshot({
    generatedAt: new Date().toISOString(),
    repository,
    observation,
    sourceRefreshedAt: cached?.refreshedAt ?? null,
    freshness: cached ? (stale ? "stale" : "fresh") : "unknown",
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
