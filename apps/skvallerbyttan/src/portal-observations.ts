import { WorkerEntrypoint } from "cloudflare:workers";
import type { Env } from "./env";
import { getCapabilities } from "./capabilities";
import { getProviderHealth } from "./provider-health";
import { organization } from "./env";
import { getObservedActivity } from "./activity";
import {
  githubInstallationRepositories,
  githubListAll,
  mapLimit,
} from "./github";
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
import {
  buildPortalPublicRepositoriesSnapshot,
  type PortalPublicRepositoriesSnapshot,
} from "./portal-repository-model";
import {
  normalizeReleaseDeploymentRequests,
  sanitizeReleaseDeployments,
  type PortalReleaseDeploymentRequest,
  type PortalReleaseDeploymentsSnapshot,
} from "./portal-release-deployment-model";

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
const PORTAL_RELEASE_DEPLOYMENT_PAGE_LIMIT = 2;

type PortalInventoryRepository = {
  name?: unknown;
  full_name?: unknown;
  visibility?: unknown;
  private?: unknown;
  archived?: unknown;
};

type PortalRawDeployment = {
  sha?: unknown;
  environment?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
};

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

export async function getPortalPublicRepositoriesSnapshot(
  env: Env,
): Promise<PortalPublicRepositoriesSnapshot> {
  const result = await githubInstallationRepositories<unknown>(env, 10);
  if (!result.available) {
    throw new Error("public repository inventory unavailable");
  }

  return buildPortalPublicRepositoriesSnapshot({
    generatedAt: new Date().toISOString(),
    owner: organization(env),
    repositories: result.value,
    truncated: result.truncated,
  });
}

export async function getPortalReleaseDeploymentsSnapshot(
  env: Env,
  values: readonly unknown[],
): Promise<PortalReleaseDeploymentsSnapshot> {
  const requests = normalizeReleaseDeploymentRequests(values);
  const generatedAt = new Date().toISOString();
  const coverage = {
    repositoryLimit: 8 as const,
    shaLimitPerRepository: 20 as const,
    deploymentPageLimit: 2 as const,
  };

  if (!requests.length) {
    return {
      schemaVersion: 1,
      generatedAt,
      status: "available",
      coverage,
      repositories: [],
    };
  }

  const owner = organization(env);
  const inventory = await githubInstallationRepositories<PortalInventoryRepository>(env, 10);
  if (!inventory.available) {
    return {
      schemaVersion: 1,
      generatedAt,
      status: "unavailable",
      coverage,
      repositories: requests.map((request) => ({
        repository: `${owner}/${request.repository}`,
        status: "unavailable" as const,
        truncated: false,
        matches: [],
      })),
    };
  }

  const observedRepositories = new Set(
    inventory.value.flatMap((repository) =>
      typeof repository.name === "string"
        ? [repository.name.toLowerCase()]
        : []
    ),
  );
  const publicRepositories = new Set(
    inventory.value.flatMap((repository) => {
      if (
        typeof repository.name !== "string" ||
        typeof repository.full_name !== "string" ||
        repository.visibility !== "public" ||
        repository.private === true ||
        repository.archived === true ||
        repository.full_name.toLowerCase() !== `${owner}/${repository.name}`.toLowerCase()
      ) {
        return [];
      }
      return [repository.name.toLowerCase()];
    }),
  );

  const repositories = await mapLimit(
    requests,
    2,
    async (request: PortalReleaseDeploymentRequest) => {
      const fullName = `${owner}/${request.repository}`;
      if (!publicRepositories.has(request.repository.toLowerCase())) {
        const observed = observedRepositories.has(request.repository.toLowerCase());
        return {
          repository: fullName,
          status: observed || !inventory.truncated
            ? "not_observed" as const
            : "unavailable" as const,
          truncated: inventory.truncated,
          matches: [],
        };
      }

      const encoded = `${encodeURIComponent(owner)}/${encodeURIComponent(request.repository)}`;
      const deployments = await githubListAll<PortalRawDeployment>(
        env,
        `/repos/${encoded}/deployments?per_page=100`,
        PORTAL_RELEASE_DEPLOYMENT_PAGE_LIMIT,
      );

      if (!deployments.available) {
        return {
          repository: fullName,
          status: "unavailable" as const,
          truncated: false,
          matches: [],
        };
      }

      return {
        repository: fullName,
        status: "available" as const,
        truncated: deployments.truncated,
        matches: sanitizeReleaseDeployments(
          fullName,
          request.commitShas,
          deployments.value,
        ),
      };
    },
  );

  return {
    schemaVersion: 1,
    generatedAt,
    status: "available",
    coverage,
    repositories,
  };
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
  const owner = organization(env);
  const observation = publicCiRepository(repositories, repository, owner);

  const stale = cached
    ? sourceCacheInvalidated(cached) ||
      sourceCacheAgeMs(cached.refreshedAt) > PORTAL_CI_FRESH_MS
    : false;

  return buildPortalRepositoryCiSnapshot({
    generatedAt: new Date().toISOString(),
    owner,
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

  async getPublicRepositories(): Promise<PortalPublicRepositoriesSnapshot> {
    return getPortalPublicRepositoriesSnapshot(this.env);
  }

  async getPublicReleaseDeployments(
    requests: unknown[],
  ): Promise<PortalReleaseDeploymentsSnapshot> {
    if (!Array.isArray(requests)) {
      throw new Error("invalid release deployment requests");
    }
    return getPortalReleaseDeploymentsSnapshot(this.env, requests);
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
