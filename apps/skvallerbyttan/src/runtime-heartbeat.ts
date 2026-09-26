import {
  cloudflareApiToken,
  gamnackenPrivateKey,
  resolveSecretValue,
  type Env,
  type RuntimeHeartbeatChecks,
} from "./env";
import { authConfigured } from "./auth";
import { githubInstallationRepositories } from "./github";
import {
  CloudflareApiError,
  getCloudflareAccount,
  getCloudflareTunnels,
  getCloudflareZones,
} from "./cloudflare";
import { recordCapabilityObservation } from "./capabilities";

export type RuntimeReadiness = {
  ready: boolean;
  checks: RuntimeHeartbeatChecks;
};

export type RuntimeReadinessProbes = {
  d1(env: Env): Promise<boolean>;
  secrets(env: Env): Promise<boolean>;
  github(env: Env): Promise<boolean>;
  cloudflareR1(env: Env): Promise<boolean>;
  cloudflareR2(env: Env): Promise<boolean>;
  cloudflareR3(env: Env): Promise<boolean>;
};

async function safeProbe(probe: () => Promise<boolean>): Promise<boolean> {
  try {
    return await probe();
  } catch {
    return false;
  }
}

async function observeCloudflareProbe(
  env: Env,
  capability: string,
  loader: () => Promise<unknown>,
): Promise<boolean> {
  try {
    await loader();
    await recordCapabilityObservation(env, capability, {
      status: "available",
      permissionState: "granted",
      dataState: "available",
      httpStatus: 200,
    });
    return true;
  } catch (error) {
    if (error instanceof CloudflareApiError) {
      const denied = error.status === 401 || error.status === 403;
      const unconfigured = error.status === 503;
      await recordCapabilityObservation(env, capability, {
        status: denied ? "permission_denied" : unconfigured ? "not_configured" : "error",
        permissionState: denied ? "permission_denied" : "unknown",
        dataState: denied ? "unavailable" : unconfigured ? "not_configured" : "error",
        httpStatus: error.status,
        error: `cloudflare-http-${error.status}`,
      });
      return false;
    }

    await recordCapabilityObservation(env, capability, {
      status: "error",
      permissionState: "unknown",
      dataState: "error",
      httpStatus: 0,
      error: "cloudflare-provider-request-failed",
    });
    return false;
  }
}

async function observeGitHubProbe(env: Env): Promise<boolean> {
  const result = await githubInstallationRepositories<unknown>(env, 1);
  const denied = !result.available && (result.status === 401 || result.status === 403);
  await recordCapabilityObservation(env, "github.avkroken.repositories", {
    status: result.available ? "available" : denied ? "permission_denied" : "error",
    permissionState: result.available ? "granted" : denied ? "permission_denied" : "unknown",
    dataState: result.available ? "available" : denied ? "unavailable" : "error",
    httpStatus: result.status,
    error: result.available ? null : result.status === 0 ? "github-provider-request-failed" : `github-http-${result.status}`,
    acceptedPermissions: result.acceptedPermissions,
  });
  return result.available;
}

const defaultProbes: RuntimeReadinessProbes = {
  async d1(env) {
    if (!env.STATS_DB) return false;
    const row = await env.STATS_DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();
    return row?.ok === 1;
  },

  async secrets(env) {
    const values = await Promise.all([
      gamnackenPrivateKey(env),
      resolveSecretValue(env.GITHUB_OAUTH_CLIENT_SECRET),
      cloudflareApiToken(env, "r1"),
      cloudflareApiToken(env, "r2"),
      cloudflareApiToken(env, "r3"),
    ]);
    return values.every((value) => Boolean(value));
  },

  async github(env) {
    return observeGitHubProbe(env);
  },

  async cloudflareR1(env) {
    return observeCloudflareProbe(
      env,
      "cloudflare.avkroken.zones",
      () => getCloudflareZones(env),
    );
  },

  async cloudflareR2(env) {
    return observeCloudflareProbe(
      env,
      "cloudflare.avkroken.account",
      () => getCloudflareAccount(env),
    );
  },

  async cloudflareR3(env) {
    return observeCloudflareProbe(
      env,
      "cloudflare.avkroken.zero_trust.tunnels",
      () => getCloudflareTunnels(env),
    );
  },
};

export async function runtimeReadiness(
  env: Env,
  probes: RuntimeReadinessProbes = defaultProbes,
): Promise<RuntimeReadiness> {
  const checks: RuntimeHeartbeatChecks = {
    config: authConfigured(env) && Boolean(env.AVKROKEN_OPERATIONS),
    d1: await safeProbe(() => probes.d1(env)),
    secrets: await safeProbe(() => probes.secrets(env)),
    github: await safeProbe(() => probes.github(env)),
    cloudflareR1: await safeProbe(() => probes.cloudflareR1(env)),
    cloudflareR2: await safeProbe(() => probes.cloudflareR2(env)),
    cloudflareR3: await safeProbe(() => probes.cloudflareR3(env)),
  };

  return {
    ready: Object.values(checks).every((value) => value === true),
    checks,
  };
}

export async function reportRuntimeHeartbeat(
  env: Env,
  probes: RuntimeReadinessProbes = defaultProbes,
): Promise<{ sent: boolean; ready: boolean; checks: RuntimeHeartbeatChecks }> {
  const readiness = await runtimeReadiness(env, probes);
  const service = env.AVKROKEN_OPERATIONS;

  if (!service) {
    console.error("operational heartbeat service binding is not configured");
    return { sent: false, ...readiness };
  }

  try {
    const result = await service.postHeartbeat({
      service: "skvallerbyttan",
      emittedAt: new Date().toISOString(),
      ready: readiness.ready,
      checks: readiness.checks,
    });

    if (!result?.ok) {
      console.error("operational heartbeat receiver rejected delivery");
      return { sent: false, ...readiness };
    }

    return { sent: true, ...readiness };
  } catch (error) {
    console.error("operational heartbeat delivery failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return { sent: false, ...readiness };
  }
}
