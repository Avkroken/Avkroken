import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function read(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("Insyn operational GitHub capabilities use direct provider reads and scoped observations", async () => {
  const data = await read("src/data.ts");

  assert.match(data, /\/issues\?state=open&sort=updated/);
  assert.match(data, /filter\(\(item\) => !item\.pull_request\)/);
  assert.match(data, /github\.avkroken\.pull_requests/);
  assert.match(data, /github\.avkroken\.actions/);
  assert.match(data, /github\.avkroken\.security/);
  assert.match(data, /recordCapabilityScopeBatch/);
});

test("GitHub permission evidence is sanitized and retained", async () => {
  const github = await read("src/github.ts");
  const providerHealth = await read("src/provider-health.ts");

  assert.match(github, /x-accepted-github-permissions/);
  assert.match(github, /repositorySelection/);
  assert.match(github, /tokenPermissions/);
  assert.match(providerHealth, /getGitHubInstallationMetadata/);
  assert.match(providerHealth, /installation:/);
  assert.doesNotMatch(providerHealth, /privateKey|Authorization:\s*Bearer/);
});

test("effective rulesets and operational capabilities reconcile on the 15 minute cadence", async () => {
  const worker = await read("src/worker.ts");
  const observations = await read("src/observations-api.ts");

  assert.match(worker, /controller\.cron === "\*\/15 \* \* \* \*"/);
  assert.match(worker, /scheduledCapabilityRefresh/);
  assert.match(worker, /reconcileAllCapabilitySources\(env\)/);
  assert.match(observations, /reconcileGitHubCapabilitySources/);
  assert.match(observations, /loadGitHubRepositoryEffectivePolicy/);
  assert.match(observations, /github\.avkroken\.repositories\.effective_rulesets/);
  assert.match(observations, /recordCapabilityScopeBatch/);
});

test("scoped capability storage and coverage are versioned in D1", async () => {
  const migration = await read("migrations/0006_capability_scope_observations.sql");
  const capabilities = await read("src/capabilities.ts");

  assert.match(migration, /CREATE TABLE IF NOT EXISTS capability_scope_observations/);
  assert.match(migration, /accepted_permissions TEXT/);
  assert.match(migration, /scope_expected INTEGER/);
  assert.match(capabilities, /scopeCoverage/);
  assert.match(capabilities, /acceptedPermissions/);
});

test("Insyn manual refresh invokes global GitHub and Cloudflare capability reconciliation", async () => {
  const observations = await read("src/observations-api.ts");
  const ui = await read("public/observations.js");

  assert.match(observations, /if \(forceRefresh\) await reconcileAllCapabilitySources\(env\)/);
  assert.match(observations, /reconcileCloudflareNotifications/);
  assert.match(observations, /getCloudflareNotificationHistory/);
  assert.match(observations, /getCloudflareNotificationPolicies/);
  assert.match(observations, /getCloudflareNotificationWebhooks/);
  assert.match(observations, /reconcileCloudflareZeroTrust/);
  assert.match(observations, /getCloudflareCasbWebhooks/);
  assert.match(ui, /withRefresh\("\/api\/v1\/capabilities", true\)/);
  assert.match(ui, /"insight-capabilities-refresh"/);
  assert.match(ui, /Scope coverage/);
  assert.match(ui, /App permissions/);
});
