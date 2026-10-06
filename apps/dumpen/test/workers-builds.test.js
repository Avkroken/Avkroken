import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Dumpen production deploy is owned by Cloudflare Workers Builds", async () => {
  assert.equal(existsSync(new URL("../../../.github/workflows/deploy-dumpen.yml", import.meta.url)), false);

  const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(pkg.scripts["deploy:workers-builds"], "node scripts/workers-build-production.mjs");

  const wrangler = JSON.parse(await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8"));
  assert.equal(wrangler.name, "dumpen");
  assert.equal(wrangler.observability?.enabled, true);
  assert.ok(wrangler.r2_buckets?.some(
    binding => binding.binding === "DUMPEN" && binding.bucket_name === "dumpen"
  ));
  assert.ok(wrangler.r2_buckets?.some(
    binding => binding.binding === "ASSETS" && binding.bucket_name === "avkroken-assets"
  ));
  assert.ok(wrangler.routes?.some(route => route.pattern === "dumpen.denied.se"));
  assert.deepEqual(wrangler.previews, {});
  const oauthSecret = wrangler.secrets_store_secrets?.find(
    item => item.binding === "GITHUB_OAUTH_CLIENT_SECRET"
  );
  assert.equal(oauthSecret?.secret_name, "KROSA_MAJA_CLIENT_SECRET");

  const script = await readFile(new URL("../scripts/workers-build-production.mjs", import.meta.url), "utf8");
  assert.match(script, /WORKERS_CI !== "1"/);
  assert.match(script, /WORKERS_CI_BRANCH !== "main"/);
  assert.match(script, /Skipping Dumpen production deployment for non-main branch/);
  assert.match(script, /Skipping Dumpen production deployment for non-main branch/);
  assert.doesNotMatch(script, /CLOUDFLARE_API_TOKEN|secrets\./);

  const branchGuard = script.indexOf('WORKERS_CI_BRANCH !== "main"');
  const branchExit = script.indexOf("return;", branchGuard);
  const check = script.indexOf('run("npm", ["run", "check"]');
  const deploy = script.indexOf('run("npm", ["run", "deploy"]');
  const providerStatus = script.indexOf('"deployments", "status", "--json"');
  assert.ok(branchGuard >= 0 && branchExit > branchGuard && check > branchExit);
  assert.ok(deploy > check && providerStatus > deploy);
  assert.match(script, /WRANGLER_OUTPUT_FILE_PATH/);
  assert.match(script, /deploymentIsActive/);
  assert.doesNotMatch(script, /verify:production/);
  assert.doesNotMatch(script, /CLOUDFLARE_API_TOKEN|secrets\./);

  const productionCheck = await readFile(new URL("../scripts/verify-production.mjs", import.meta.url), "utf8");
  assert.match(productionCheck, /data-media-library-version="2"/);
  assert.match(productionCheck, /does not serve Media Library v2/);
  assert.equal(
    existsSync(new URL("../../../.github/workflows/dumpen-production-runtime.yml", import.meta.url)),
    false,
  );
});
