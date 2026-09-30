import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(
  new URL("../src/portal-observations.ts", import.meta.url),
  "utf8",
);

test("Portal release deployment RPC verifies public inventory before provider deployment reads", () => {
  const start = source.indexOf("export async function getPortalReleaseDeploymentsSnapshot");
  const end = source.indexOf("export async function getPortalRepositoryCiSnapshot", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const section = source.slice(start, end);

  assert.match(section, /githubInstallationRepositories<PortalInventoryRepository>\(env, 10\)/);
  assert.match(section, /repository\.visibility !== "public"/);
  assert.match(section, /repository\.private === true/);
  assert.match(section, /repository\.archived === true/);
  assert.match(section, /githubListAll<PortalRawDeployment>/);
  assert.match(section, /deployments\?per_page=100/);
  assert.match(section, /PORTAL_RELEASE_DEPLOYMENT_PAGE_LIMIT/);
  assert.match(section, /sanitizeReleaseDeployments/);
});

test("Portal release deployment RPC remains bounded and public-safe", () => {
  assert.match(source, /repositoryLimit: 8 as const/);
  assert.match(source, /shaLimitPerRepository: 20 as const/);
  assert.match(source, /deploymentPageLimit: 2 as const/);
  assert.match(source, /async getPublicReleaseDeployments/);
  assert.doesNotMatch(source, /getPublicReleaseDeployments[\s\S]*?deployment_statuses/);
});
