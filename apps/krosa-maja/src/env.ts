export interface SecretsStoreSecretBinding {
  get(): Promise<string>;
}

export type SecretValue = string | SecretsStoreSecretBinding;

export interface Env {
  AUTH_DB: D1Database;

  KROSA_MAJA_BASE_URL: string;
  KROSA_MAJA_AUTH_SECRET: SecretValue;
  KROSA_MAJA_INTERNAL_ADMIN_SECRET: SecretValue;

  KROSA_MAJA_GITHUB_CLIENT_ID: string;
  KROSA_MAJA_CLIENT_SECRET: SecretValue;
  KROSA_MAJA_ALLOWED_GITHUB_IDS: SecretValue;
  KROSA_MAJA_ADMIN_GITHUB_IDS: SecretValue;

  KROSA_MAJA_CLOUDFLARE_CLIENT_ID?: string;
  KROSA_MAJA_CLOUDFLARE_CLIENT_SECRET?: SecretValue;
  KROSA_MAJA_CLOUDFLARE_SCOPES?: string;
}

export async function resolveSecretValue(value: SecretValue | undefined): Promise<string> {
  if (typeof value === "string") return value.trim();
  if (!value) return "";
  return (await value.get()).trim();
}

export interface RuntimeSecrets {
  authSecret: string;
  internalAdminSecret: string;
  githubClientSecret: string;
  allowedGitHubIds: string;
  adminGitHubIds: string;
  cloudflareClientSecret: string;
}

export async function resolveRuntimeSecrets(env: Env): Promise<RuntimeSecrets> {
  const [
    authSecret,
    internalAdminSecret,
    githubClientSecret,
    allowedGitHubIds,
    adminGitHubIds,
    cloudflareClientSecret,
  ] = await Promise.all([
    resolveSecretValue(env.KROSA_MAJA_AUTH_SECRET),
    resolveSecretValue(env.KROSA_MAJA_INTERNAL_ADMIN_SECRET),
    resolveSecretValue(env.KROSA_MAJA_CLIENT_SECRET),
    resolveSecretValue(env.KROSA_MAJA_ALLOWED_GITHUB_IDS),
    resolveSecretValue(env.KROSA_MAJA_ADMIN_GITHUB_IDS),
    resolveSecretValue(env.KROSA_MAJA_CLOUDFLARE_CLIENT_SECRET),
  ]);

  return {
    authSecret,
    internalAdminSecret,
    githubClientSecret,
    allowedGitHubIds,
    adminGitHubIds,
    cloudflareClientSecret,
  };
}
