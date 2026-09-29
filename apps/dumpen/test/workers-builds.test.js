import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Dumpen production deploy is owned by Cloudflare Workers Builds", async () => {
  assert.equal(existsSync(new URL("../../../.github/workflows/deploy-dumpen.yml", import.meta.url)), false);

  const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(pkg.scripts["deploy:workers-builds"], "node scripts/workers-build-production.mjs");

  const script = await readFile(new URL("../scripts/workers-build-production.mjs", import.meta.url), "utf8");
  assert.match(script, /WORKERS_CI !== "1"/);
  assert.match(script, /WORKERS_CI_BRANCH !== "main"/);
  assert.doesNotMatch(script, /CLOUDFLARE_API_TOKEN|secrets\./);

  const check = script.indexOf('run("npm", ["run", "check"])');
  const deploy = script.indexOf('run("npm", ["run", "deploy"])');
  const verify = script.indexOf('run("npm", ["run", "verify:production"])');
  assert.ok(check >= 0 && deploy > check && verify > deploy);
});
