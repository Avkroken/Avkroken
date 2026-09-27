import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Skvallerbyttan production deploy is owned by Workers Builds", async () => {
  assert.equal(existsSync(new URL("../../../.github/workflows/deploy-skvallerbyttan.yml", import.meta.url)), false);
  const script = await readFile(new URL("../scripts/workers-build-production.mjs", import.meta.url), "utf8");
  assert.match(script, /WORKERS_CI !== "1"/);
  assert.match(script, /WORKERS_CI_BRANCH !== "main"/);
  assert.doesNotMatch(script, /CLOUDFLARE_API_TOKEN_W1|secrets\./);
  const check = script.indexOf('run("npm", ["run", "check"])');
  const migrate = script.indexOf('"d1", "migrations", "apply", "STATS_DB", "--remote"');
  const deploy = script.indexOf('run("npm", ["run", "deploy"])');
  const verify = script.indexOf('run("npm", ["run", "verify:production"])');
  assert.ok(check >= 0 && migrate > check && deploy > migrate && verify > deploy);
});
