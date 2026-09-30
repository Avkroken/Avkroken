import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";

async function readWranglerConfig() {
  const raw = await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8");
  return JSON.parse(raw);
}

test("portal tracked production config cannot be sanitized into a preview-only config", async () => {
  const config = await readWranglerConfig();
  assert.equal(config.name, "avkroken");
  assert.equal(config.observability?.enabled, true);
  assert.ok(config.services?.some(binding => binding.binding === "SKVALLERBYTTAN_OBSERVATIONS"));
  assert.ok(config.r2_buckets?.some(binding => binding.binding === "PORTAL_LOGOS"));
  assert.ok(config.triggers?.crons?.length > 0);
});


test("portal Preview isolates Durable Object and does not bind production services", async () => {
  const config = await readWranglerConfig();
  assert.deepEqual(config.previews?.durable_objects?.bindings, [
    { name: "OPS_WATCHDOG", class_name: "OperationalWatchdog" }
  ]);
  assert.equal(config.previews?.services, undefined);
  assert.equal(config.previews?.send_email, undefined);
  assert.equal(config.previews?.vars, undefined);
  assert.equal(config.previews?.r2_buckets, undefined);
});

test("Portal production binds the provider-verified logo store and Access audience", async () => {
  const config = await readWranglerConfig();
  assert.deepEqual(config.r2_buckets, [
    { binding: "PORTAL_LOGOS", bucket_name: "avkroken-portal-logos" }
  ]);
  assert.equal(config.vars?.ACCESS_TEAM_DOMAIN, "https://avkroken.cloudflareaccess.com");
  assert.equal(
    config.vars?.ACCESS_LOGO_ADMIN_AUD,
    "c10cb83e06238d41b2c85f8118f91e8be5f272791c96208541734ece509fb1f4"
  );
});

test("Portal production deploy is owned by Cloudflare Workers Builds", async () => {
  const workflow = new URL("../../../.github/workflows/deploy-portal.yml", import.meta.url);
  assert.equal(existsSync(workflow), false);
  const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(pkg.scripts["deploy:workers-builds"], "node scripts/workers-build-production.mjs");
  const script = await readFile(new URL("../scripts/workers-build-production.mjs", import.meta.url), "utf8");
  assert.match(script, /WORKERS_CI !== "1"/);
  assert.match(script, /WORKERS_CI_BRANCH !== "main"/);
  assert.doesNotMatch(script, /CLOUDFLARE_API_TOKEN_W1|secrets\./);
});
