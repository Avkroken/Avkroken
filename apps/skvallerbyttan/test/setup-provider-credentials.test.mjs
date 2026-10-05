import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

const wizardUrl = new URL("../scripts/setup-provider-credentials.sh", import.meta.url);
const wizardPath = fileURLToPath(wizardUrl);
const wizard = await readFile(wizardUrl, "utf8");
const stagesMarker = "# STAGES: author this section.";
const stagesOffset = wizard.indexOf(stagesMarker);
assert.notEqual(stagesOffset, -1, "wizard must retain the curated STAGES marker");
const stages = wizard.slice(stagesOffset);

test("credential wizard has valid bash syntax", () => {
  const result = spawnSync("bash", ["-n", wizardPath], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
});

test("credential stages remain verification-only", () => {
  assert.doesNotMatch(stages, /^\s*(?:ask|ask_secret|write_env|set_secret|set_var)\s+/m);
  assert.doesNotMatch(stages, /\bgh\s+(?:secret|variable)\s+set\b/);
  assert.doesNotMatch(stages, /\bwrangler\s+secret\s+(?:put|bulk|delete)\b/);
  assert.doesNotMatch(stages, /\bwrangler\s+deploy\b/);
  assert.doesNotMatch(stages, /\bwrangler\s+d1\s+migrations\s+apply\b/);
});

test("credential wizard covers the canonical runtime credential contract", () => {
  for (const name of [
    "GAMNACKEN_GITHUB_APP_CLIENT_ID",
    "GAMNACKEN_GITHUB_APP_PRIVATE_KEY",
    "SKVALLERBYTTAN_SESSION_SECRET",
    "SKVALLERBYTTAN_WEBHOOK_SECRET",
    "CLOUDFLARE_API_TOKEN_R1",
    "CLOUDFLARE_API_TOKEN_R2",
    "CLOUDFLARE_API_TOKEN_R3",
    "GITHUB_OAUTH_CLIENT_SECRET",
    "KROSA_MAJA_CLIENT_SECRET",
    "CLOUDFLARE_NOTIFICATIONS_WEBHOOK_SECRET",
    "CLOUDFLARE_CASB_WEBHOOK_SECRET",
    "SKVALLERBYTTAN_READ_API_TOKEN",
  ]) {
    assert.match(stages, new RegExp(name));
  }
});

test("credential wizard preserves the Workers Builds deployment boundary", () => {
  assert.match(stages, /Avkroken\/Avkroken/);
  assert.match(stages, /apps\/skvallerbyttan/);
  assert.match(stages, /npm run deploy:workers-builds/);
  assert.match(stages, /GitHub Actions ska inte synka dessa värden/);
});
