import type { Env, RuntimeSecrets } from "./env.ts";

export interface RuntimeConfig {
  baseUrl: string;
  allowedGitHubIds: ReadonlySet<string>;
  adminGitHubIds: ReadonlySet<string>;
  cloudflare:
    | { enabled: false; scopes: readonly string[] }
    | {
        enabled: true;
        clientId: string;
        clientSecret: string;
        scopes: readonly string[];
      };
}

const MIN_SECRET_LENGTH = 32;
const DEFAULT_CLOUDFLARE_SCOPES = ["offline_access"] as const;

function required(value: string | undefined, name: string): string {
  const normalized = value?.trim();
  if (!normalized) throw new Error(`${name} is required`);
  return normalized;
}

export function canonicalBaseUrl(value: string): string {
  const input = required(value, "KROSA_MAJA_BASE_URL");
  const url = new URL(input);
  if (url.protocol !== "https:") throw new Error("KROSA_MAJA_BASE_URL must use https");
  if (url.username || url.password) throw new Error("KROSA_MAJA_BASE_URL must not contain credentials");
  if (url.search || url.hash) throw new Error("KROSA_MAJA_BASE_URL must not contain query or fragment");
  if (url.pathname !== "/" && url.pathname !== "") {
    throw new Error("KROSA_MAJA_BASE_URL must be an origin without a path");
  }
  return url.origin;
}

export function parseGitHubIds(value: string, name: string): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const part of value.split(",")) {
    const id = part.trim();
    if (!id) continue;
    if (!/^[1-9][0-9]*$/.test(id)) throw new Error(`${name} contains an invalid GitHub numeric ID`);
    ids.add(id);
  }
  if (ids.size === 0) throw new Error(`${name} must contain at least one GitHub numeric ID`);
  return ids;
}

export function parseCloudflareScopes(value?: string): readonly string[] {
  const scopes = new Set<string>(DEFAULT_CLOUDFLARE_SCOPES);
  for (const part of (value ?? "").split(/[\s,]+/)) {
    const scope = part.trim();
    if (!scope) continue;
    if (/[^\x21-\x7E]/.test(scope)) throw new Error("KROSA_MAJA_CLOUDFLARE_SCOPES contains invalid characters");
    if (scope.includes(":")) throw new Error("Cloudflare OAuth scopes must not use colon-delimited names");
    scopes.add(scope);
  }
  return [...scopes];
}

export function readRuntimeConfig(env: Env, secrets: RuntimeSecrets): RuntimeConfig {
  const baseUrl = canonicalBaseUrl(env.KROSA_MAJA_BASE_URL);

  const authSecret = required(secrets.authSecret, "KROSA_MAJA_AUTH_SECRET");
  if (authSecret.length < MIN_SECRET_LENGTH) {
    throw new Error(`KROSA_MAJA_AUTH_SECRET must be at least ${MIN_SECRET_LENGTH} characters`);
  }

  const internalAdminSecret = required(
    secrets.internalAdminSecret,
    "KROSA_MAJA_INTERNAL_ADMIN_SECRET",
  );
  if (internalAdminSecret.length < MIN_SECRET_LENGTH) {
    throw new Error(`KROSA_MAJA_INTERNAL_ADMIN_SECRET must be at least ${MIN_SECRET_LENGTH} characters`);
  }

  required(env.KROSA_MAJA_GITHUB_CLIENT_ID, "KROSA_MAJA_GITHUB_CLIENT_ID");
  required(secrets.githubClientSecret, "KROSA_MAJA_CLIENT_SECRET");

  const allowedGitHubIds = parseGitHubIds(
    required(secrets.allowedGitHubIds, "KROSA_MAJA_ALLOWED_GITHUB_IDS"),
    "KROSA_MAJA_ALLOWED_GITHUB_IDS",
  );
  const adminGitHubIds = parseGitHubIds(
    required(secrets.adminGitHubIds, "KROSA_MAJA_ADMIN_GITHUB_IDS"),
    "KROSA_MAJA_ADMIN_GITHUB_IDS",
  );
  for (const adminId of adminGitHubIds) {
    if (!allowedGitHubIds.has(adminId)) {
      throw new Error("KROSA_MAJA_ADMIN_GITHUB_IDS must be a subset of KROSA_MAJA_ALLOWED_GITHUB_IDS");
    }
  }

  const cloudflareClientId = env.KROSA_MAJA_CLOUDFLARE_CLIENT_ID?.trim() ?? "";
  const cloudflareClientSecret = secrets.cloudflareClientSecret.trim();
  if (Boolean(cloudflareClientId) !== Boolean(cloudflareClientSecret)) {
    throw new Error(
      "KROSA_MAJA_CLOUDFLARE_CLIENT_ID and KROSA_MAJA_CLOUDFLARE_CLIENT_SECRET must either both be configured or both be absent",
    );
  }

  const scopes = parseCloudflareScopes(env.KROSA_MAJA_CLOUDFLARE_SCOPES);
  return {
    baseUrl,
    allowedGitHubIds,
    adminGitHubIds,
    cloudflare: cloudflareClientId
      ? {
          enabled: true,
          clientId: cloudflareClientId,
          clientSecret: cloudflareClientSecret,
          scopes,
        }
      : { enabled: false, scopes },
  };
}

export function requestUsesConfiguredOrigin(request: Request, baseUrl: string): boolean {
  return new URL(request.url).origin === new URL(baseUrl).origin;
}

export function sameOriginPost(request: Request, baseUrl: string): boolean {
  const origin = request.headers.get("origin");
  return request.method === "POST" && origin === new URL(baseUrl).origin;
}
