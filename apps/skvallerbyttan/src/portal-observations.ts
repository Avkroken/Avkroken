import { WorkerEntrypoint } from "cloudflare:workers";
import type { Env } from "./env";
import { getCapabilities } from "./capabilities";
import { getProviderHealth } from "./provider-health";
import { organization } from "./env";
import { getObservedActivity } from "./activity";
import {
  buildPortalRepositoryCiSnapshot,
  publicCiRepository,
  type PortalCiRepositoryObservation,
  type PortalRepositoryCiSnapshot,
} from "./portal-ci-model";
import {
  buildPortalActivitySnapshot,
  type PortalActivitySnapshot,
} from "./portal-activity-model";
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

function boundedActivityDays(value: number): number {
  if (!Number.isFinite(value)) return 30;
  return Math.min(30, Math.max(1, Math.trunc(value)));
}

function requestedRepositoryNames(values: readonly unknown[]): string[] {
  const result = new Set<string>();

  for (const value of values) {
    if (typeof value !== "string") continue;
    const name = value.trim();
    if (!name || name === "." || name === ".." || !REPOSITORY_NAME.test(name)) continue;
    result.add(name);
    if (result.size >= 50) break;
  }

  return [...result];
}

function publicObservedRepositoryNames(
  repositories: PortalCiRepositoryObservation[],
  requested: readonly string[],
  org: string,
): string[] {
  const allowed = new Set(requested);
  return repositories.flatMap((row) => {
    if (
      row?.visibility !== "public" ||
      row?.archived === true ||
      typeof row?.fullName !== "string" ||
      !row.fullName.startsWith(org + "/")
    ) {
      return [];
    }

    const name = row.fullName.slice(org.length + 1);
    return allowed.has(name) && REPOSITORY_NAME.test(name) ? [name] : [];
  });
}

export async function getPortalActivitySnapshot(
  env: Env,
  repositoryNames: string[],
  days = 30,
): Promise<PortalActivitySnapshot> {
  const org = organization(env);
  const requested = requestedRepositoryNames(repositoryNames);
  const cached = await readSourceCache<OverviewCache>(env, "overview");
  const repositories = Array.isArray(cached?.value?.repositories)
    ? cached.value.repositories
    : [];
  const publicRepositories = publicObservedRepositoryNames(
    repositories,
    requested,
    org,
  );

  if (!cached || !publicRepositories.length) {
    return buildPortalActivitySnapshot({
      generatedAt: new Date().toISOString(),
      organization: org,
      repositoryNames: publicRepositories,
      observed: {
        available: false,
        status: "not_observed",
      },
    });
  }

  const observed = await getObservedActivity(env, {
    days: boundedActivityDays(days),
    provider: "github",
    repositories: publicRepositories,
  });

  return buildPortalActivitySnapshot({
    generatedAt: new Date().toISOString(),
    organization: org,
    repositoryNames: publicRepositories,
    observed,
  });
}

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

  async getPublicActivity(
    repositoryNames: string[],
    days = 30,
  ): Promise<PortalActivitySnapshot> {
    if (!Array.isArray(repositoryNames)) {
      throw new Error("invalid repository names");
    }
    return getPortalActivitySnapshot(this.env, repositoryNames, days);
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
