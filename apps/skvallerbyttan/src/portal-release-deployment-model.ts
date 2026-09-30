export type PortalReleaseDeploymentRequest = {
  repository: string;
  commitShas: string[];
};

export type PortalReleaseDeploymentMatch = {
  sha: string;
  environment: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type PortalReleaseDeploymentRepository = {
  repository: string;
  status: "available" | "unavailable" | "not_observed";
  truncated: boolean;
  matches: PortalReleaseDeploymentMatch[];
};

export type PortalReleaseDeploymentsSnapshot = {
  schemaVersion: 1;
  generatedAt: string;
  status: "available" | "unavailable";
  coverage: {
    repositoryLimit: 8;
    shaLimitPerRepository: 20;
    deploymentPageLimit: 2;
  };
  repositories: PortalReleaseDeploymentRepository[];
};

const SHA = /^[0-9a-f]{40}$/;
const REPOSITORY_NAME = /^[A-Za-z0-9._-]+$/;

function safeText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text && text.length <= maxLength ? text : null;
}

function timestamp(value: unknown): string | null {
  const text = safeText(value, 64);
  return text && Number.isFinite(Date.parse(text)) ? text : null;
}

export function normalizeReleaseDeploymentRequests(
  values: readonly unknown[],
): PortalReleaseDeploymentRequest[] {
  if (!Array.isArray(values)) return [];
  const requests: PortalReleaseDeploymentRequest[] = [];
  const seenRepositories = new Set<string>();

  for (const value of values) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const row = value as Record<string, unknown>;
    const repository = safeText(row.repository, 100);
    if (
      !repository ||
      repository === "." ||
      repository === ".." ||
      !REPOSITORY_NAME.test(repository) ||
      seenRepositories.has(repository.toLowerCase())
    ) {
      continue;
    }

    const shas = new Set<string>();
    if (Array.isArray(row.commitShas)) {
      for (const candidate of row.commitShas) {
        if (typeof candidate !== "string") continue;
        const sha = candidate.trim().toLowerCase();
        if (SHA.test(sha)) shas.add(sha);
        if (shas.size >= 20) break;
      }
    }
    if (!shas.size) continue;

    seenRepositories.add(repository.toLowerCase());
    requests.push({ repository, commitShas: [...shas] });
    if (requests.length >= 8) break;
  }
  return requests;
}

export function sanitizeReleaseDeployments(
  repository: string,
  requestedShas: readonly string[],
  deployments: readonly unknown[],
): PortalReleaseDeploymentMatch[] {
  const requested = new Set(
    requestedShas
      .map((value) => String(value).trim().toLowerCase())
      .filter((value) => SHA.test(value)),
  );
  if (!requested.size || !Array.isArray(deployments)) return [];

  const seen = new Set<string>();
  const matches: PortalReleaseDeploymentMatch[] = [];

  for (const value of deployments) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const row = value as Record<string, unknown>;
    const sha = typeof row.sha === "string" ? row.sha.trim().toLowerCase() : "";
    if (!requested.has(sha)) continue;

    const environment = safeText(row.environment, 120);
    const createdAt = timestamp(row.created_at);
    const updatedAt = timestamp(row.updated_at);
    const key = [repository, sha, environment ?? "", createdAt ?? ""].join("|");
    if (seen.has(key)) continue;
    seen.add(key);

    matches.push({ sha, environment, createdAt, updatedAt });
    if (matches.length >= 50) break;
  }

  return matches.sort((a, b) =>
    Date.parse(b.createdAt ?? "") - Date.parse(a.createdAt ?? "") ||
    a.sha.localeCompare(b.sha)
  );
}
