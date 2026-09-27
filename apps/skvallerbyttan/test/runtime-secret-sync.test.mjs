import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("GitHub no longer syncs Skvallerbyttan runtime secrets into Cloudflare", async () => {
  const workflow = new URL("../../../.github/workflows/sync-skvallerbyttan-runtime-secrets.yml", import.meta.url);
  assert.equal(existsSync(workflow), false);

  const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(pkg.scripts["deploy:workers-builds"], "node scripts/workers-build-production.mjs");

  const script = await readFile(new URL("../scripts/workers-build-production.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(script, /CLOUDFLARE_API_TOKEN_W1|GAMNACKEN_GITHUB_APP_PRIVATE_KEY|SKVALLERBYTTAN_READ_API_TOKEN|secrets\./);
});
