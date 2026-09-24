import assert from "node:assert/strict";
import test from "node:test";
import { readRuntimeConfig } from "../src/config.ts";
import { resolveRuntimeSecrets, type Env } from "../src/env.ts";

function secret(value: string) {
  return { get: async () => value };
}

function testEnv(): Env {
  return {
    AUTH_DB: {} as D1Database,
    KROSA_MAJA_BASE_URL: "https://auth.example.test",
    KROSA_MAJA_AUTH_SECRET: secret("a".repeat(32)),
    KROSA_MAJA_INTERNAL_ADMIN_SECRET: secret("b".repeat(32)),
    KROSA_MAJA_GITHUB_CLIENT_ID: "github-client-id",
    KROSA_MAJA_CLIENT_SECRET: secret("github-secret"),
    KROSA_MAJA_ALLOWED_GITHUB_IDS: secret("123"),
    KROSA_MAJA_ADMIN_GITHUB_IDS: secret("123"),
    KROSA_MAJA_CLOUDFLARE_CLIENT_ID: "cloudflare-client-id",
    KROSA_MAJA_CLOUDFLARE_CLIENT_SECRET: secret("cloudflare-secret"),
    KROSA_MAJA_CLOUDFLARE_SCOPES: "offline_access",
  };
}

test("runtime resolves the two existing OAuth client secrets independently", async () => {
  const env = testEnv();
  const runtimeSecrets = await resolveRuntimeSecrets(env);

  assert.equal(runtimeSecrets.githubClientSecret, "github-secret");
  assert.equal(runtimeSecrets.allowedGitHubIds, "123");
  assert.equal(runtimeSecrets.adminGitHubIds, "123");
  assert.equal(runtimeSecrets.cloudflareClientSecret, "cloudflare-secret");

  const config = readRuntimeConfig(env, runtimeSecrets);
  assert.equal(config.cloudflare.enabled, true);
  if (config.cloudflare.enabled) {
    assert.equal(config.cloudflare.clientSecret, "cloudflare-secret");
  }
});

test("Cloudflare OAuth client ID requires its own client secret", async () => {
  const env = testEnv();
  env.KROSA_MAJA_CLOUDFLARE_CLIENT_SECRET = secret("");
  const runtimeSecrets = await resolveRuntimeSecrets(env);

  assert.throws(
    () => readRuntimeConfig(env, runtimeSecrets),
    /KROSA_MAJA_CLOUDFLARE_CLIENT_SECRET/,
  );
});

test("Better Auth core and internal admin secrets resolve independently from Secrets Store", async () => {
  const env = testEnv();

  env.KROSA_MAJA_AUTH_SECRET = secret("");
  let resolved = await resolveRuntimeSecrets(env);
  assert.throws(() => readRuntimeConfig(env, resolved), /KROSA_MAJA_AUTH_SECRET/);

  env.KROSA_MAJA_AUTH_SECRET = secret("a".repeat(32));
  env.KROSA_MAJA_INTERNAL_ADMIN_SECRET = secret("");
  resolved = await resolveRuntimeSecrets(env);
  assert.throws(
    () => readRuntimeConfig(env, resolved),
    /KROSA_MAJA_INTERNAL_ADMIN_SECRET/,
  );
});


test("GitHub authorization ID policy resolves from Secrets Store and fails closed", async () => {
  const env = testEnv();

  env.KROSA_MAJA_ALLOWED_GITHUB_IDS = secret("");
  let resolved = await resolveRuntimeSecrets(env);
  assert.throws(
    () => readRuntimeConfig(env, resolved),
    /KROSA_MAJA_ALLOWED_GITHUB_IDS/,
  );

  env.KROSA_MAJA_ALLOWED_GITHUB_IDS = secret("123");
  env.KROSA_MAJA_ADMIN_GITHUB_IDS = secret("");
  resolved = await resolveRuntimeSecrets(env);
  assert.throws(
    () => readRuntimeConfig(env, resolved),
    /KROSA_MAJA_ADMIN_GITHUB_IDS/,
  );
});
