import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function readWranglerConfig() {
  return JSON.parse(await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8"));
}

test("Jobb tracked production config cannot be sanitized into a preview-only config", async () => {
  const config = await readWranglerConfig();
  assert.equal(config.name, "jobb");
  assert.equal(config.observability?.enabled, true);
  assert.ok(config.d1_databases?.some(binding => binding.binding === "DB"));
  assert.ok(config.r2_buckets?.some(binding => binding.binding === "EVIDENCE"));
  assert.ok(config.routes?.some(route => route.pattern === "jobb.denied.se"));
  assert.ok(config.triggers?.crons?.length > 0);
});

test("Jobb reuses the existing shared GitHub OAuth secret through a neutral binding", async () => {
  const config = await readWranglerConfig();
  const binding = config.secrets_store_secrets?.find(
    item => item.binding === "GITHUB_OAUTH_CLIENT_SECRET"
  );

  assert.deepEqual(binding && {
    binding: binding.binding,
    secret_name: binding.secret_name
  }, {
    binding: "GITHUB_OAUTH_CLIENT_SECRET",
    secret_name: "KROSA_MAJA_CLIENT_SECRET"
  });

  assert.equal(
    config.secrets_store_secrets?.some(item => item.binding === "KROSA_MAJA_CLIENT_SECRET"),
    false
  );
});
