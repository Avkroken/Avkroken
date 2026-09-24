import { gamnackenPrivateKeyConfigured, type Env } from "./env";
import { cloudflareApiConfigured, getCloudflareBudget } from "./cloudflare";
import { getGitHubBudget, getGitHubInstallationMetadata } from "./github";
import type { CapabilityObservation } from "./capabilities";

type ProviderHealthStatus =
  | "available"
  | "not_configured"
  | "not_observed"
  | "permission_denied"
  | "error";

const GITHUB_READINESS_CAPABILITY = "github.avkroken.repositories";

const CLOUDFLARE_READINESS_CAPABILITIES = [
  "cloudflare.avkroken.zones",
  "cloudflare.avkroken.account",
  "cloudflare.avkroken.zero_trust.tunnels",
] as const;

function githubConfigured(env: Env): boolean {
  return Boolean(
    env.GAMNACKEN_GITHUB_APP_CLIENT_ID?.trim() &&
    gamnackenPrivateKeyConfigured(env),
  );
}

function healthFromBudget(
  configured: boolean,
  budget: { observedAt: string | null; throttled: boolean; lastStatus: number | null },
): ProviderHealthStatus {
  if (!configured) return "not_configured";
  if (!budget.observedAt) return "not_observed";
  if (budget.throttled) return "error";
  if (budget.lastStatus === 401 || budget.lastStatus === 403) return "permission_denied";
  if (budget.lastStatus != null && budget.lastStatus >= 400) return "error";
  return "available";
}

function persistentGitHubHealth(
  configured: boolean,
  capabilities: readonly CapabilityObservation[],
): {
  status: ProviderHealthStatus;
  lastObservedAt: string | null;
  lastStatus: number | null;
} {
  if (!configured) {
    return { status: "not_configured", lastObservedAt: null, lastStatus: null };
  }

  const row = capabilities.find((item) => item.key === GITHUB_READINESS_CAPABILITY);
  if (!row?.lastAttemptAt) {
    return { status: "not_observed", lastObservedAt: null, lastStatus: null };
  }

  if (
    row.permissionState === "permission_denied" ||
    row.lastHttpStatus === 401 ||
    row.lastHttpStatus === 403
  ) {
    return {
      status: "permission_denied",
      lastObservedAt: row.lastAttemptAt,
      lastStatus: row.lastHttpStatus,
    };
  }

  if (
    row.status === "error" ||
    (row.lastHttpStatus != null && row.lastHttpStatus >= 400)
  ) {
    return {
      status: "error",
      lastObservedAt: row.lastAttemptAt,
      lastStatus: row.lastHttpStatus,
    };
  }

  if (row.status === "available" && row.lastHttpStatus === 200) {
    return {
      status: "available",
      lastObservedAt: row.lastAttemptAt,
      lastStatus: row.lastHttpStatus,
    };
  }

  return {
    status: "not_observed",
    lastObservedAt: row.lastAttemptAt,
    lastStatus: row.lastHttpStatus,
  };
}

function persistentCloudflareHealth(
  configured: boolean,
  capabilities: readonly CapabilityObservation[],
): {
  status: ProviderHealthStatus;
  lastObservedAt: string | null;
  lastStatus: number | null;
} {
  if (!configured) {
    return { status: "not_configured", lastObservedAt: null, lastStatus: null };
  }

  const rows = CLOUDFLARE_READINESS_CAPABILITIES
    .map((key) => capabilities.find((item) => item.key === key))
    .filter((item): item is CapabilityObservation => Boolean(item?.lastAttemptAt));

  if (rows.length === 0) {
    return { status: "not_observed", lastObservedAt: null, lastStatus: null };
  }

  const latest = [...rows].sort((left, right) =>
    String(right.lastAttemptAt).localeCompare(String(left.lastAttemptAt))
  )[0];

  if (rows.some((item) =>
    item.permissionState === "permission_denied" ||
    item.lastHttpStatus === 401 ||
    item.lastHttpStatus === 403
  )) {
    return {
      status: "permission_denied",
      lastObservedAt: latest.lastAttemptAt,
      lastStatus: latest.lastHttpStatus,
    };
  }

  if (rows.some((item) =>
    item.status === "error" ||
    (item.lastHttpStatus != null && item.lastHttpStatus >= 400)
  )) {
    return {
      status: "error",
      lastObservedAt: latest.lastAttemptAt,
      lastStatus: latest.lastHttpStatus,
    };
  }

  if (
    rows.length === CLOUDFLARE_READINESS_CAPABILITIES.length &&
    rows.every((item) => item.lastHttpStatus === 200)
  ) {
    return {
      status: "available",
      lastObservedAt: latest.lastAttemptAt,
      lastStatus: latest.lastHttpStatus,
    };
  }

  return {
    status: "not_observed",
    lastObservedAt: latest.lastAttemptAt,
    lastStatus: latest.lastHttpStatus,
  };
}

export function getProviderHealth(
  env: Env,
  capabilities: readonly CapabilityObservation[] = [],
): Record<string, unknown> {
  const githubBudget = getGitHubBudget();
  const githubInstallation = getGitHubInstallationMetadata();
  const cloudflareBudget = getCloudflareBudget();
  const ghConfigured = githubConfigured(env);
  const cfConfigured = cloudflareApiConfigured(env);
  const persistentGitHub = persistentGitHubHealth(ghConfigured, capabilities);
  const persistentCloudflare = persistentCloudflareHealth(cfConfigured, capabilities);
  const githubStatus = persistentGitHub.lastObservedAt
    ? persistentGitHub.status
    : healthFromBudget(ghConfigured, githubBudget);
  const githubObservedAt = persistentGitHub.lastObservedAt ?? githubBudget.observedAt;
  const githubLastStatus = persistentGitHub.lastStatus ?? githubBudget.lastStatus;
  const cloudflareStatus = cloudflareBudget.observedAt
    ? healthFromBudget(cfConfigured, cloudflareBudget)
    : persistentCloudflare.status;
  const cloudflareObservedAt = cloudflareBudget.observedAt ?? persistentCloudflare.lastObservedAt;
  const cloudflareLastStatus = cloudflareBudget.lastStatus ?? persistentCloudflare.lastStatus;

  return {
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    providers: {
      github: {
        status: githubStatus,
        auth: {
          configured: ghConfigured,
          lastObservedAt: githubObservedAt,
          lastStatus: githubLastStatus,
          installation: {
            id: githubInstallation.installationId,
            repositorySelection: githubInstallation.repositorySelection,
            permissions: githubInstallation.permissions,
            tokenPermissions: githubInstallation.tokenPermissions,
            observedAt: githubInstallation.observedAt,
          },
        },
        webhook: {
          configured: Boolean(env.SKVALLERBYTTAN_WEBHOOK_SECRET?.trim() && env.STATS_DB),
          portalDocsSignalConfigured: Boolean(env.AVKROKEN_PORTAL_DOCS),
        },
        reconciliation: {
          configured: Boolean(env.STATS_DB),
          lastSuccessAt: null,
          status: "unknown",
        },
        budget: githubBudget,
      },
      cloudflare: {
        status: cloudflareStatus,
        auth: {
          configured: cfConfigured,
          lastObservedAt: cloudflareObservedAt,
          lastStatus: cloudflareLastStatus,
        },
        webhooks: {
          notificationsConfigured: Boolean(
            env.CLOUDFLARE_NOTIFICATIONS_WEBHOOK_SECRET?.trim() && env.STATS_DB,
          ),
          casbConfigured: Boolean(
            env.CLOUDFLARE_CASB_WEBHOOK_SECRET?.trim() && env.STATS_DB,
          ),
        },
        reconciliation: {
          configured: Boolean(env.STATS_DB),
          lastSuccessAt: null,
          status: "unknown",
        },
        budget: cloudflareBudget,
      },
    },
  };
}
