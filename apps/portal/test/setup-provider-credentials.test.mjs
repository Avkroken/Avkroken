import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

const launcherUrl = new URL("../scripts/setup-provider-credentials.sh", import.meta.url);
const wizardUrl = new URL("../scripts/setup-provider-credentials.wizard.sh", import.meta.url);
const canonicalUrl = new URL("../../skvallerbyttan/scripts/setup-provider-credentials.wizard.sh", import.meta.url);
const launcherPath = fileURLToPath(launcherUrl);
const wizardPath = fileURLToPath(wizardUrl);
const launcher = await readFile(launcherUrl, "utf8");
const wizard = await readFile(wizardUrl, "utf8");
const canonical = await readFile(canonicalUrl, "utf8");
const marker = "# STAGES: author this section.";
const stageOffset = wizard.indexOf(marker);
const canonicalStageOffset = canonical.indexOf(marker);
assert.notEqual(stageOffset, -1);
assert.notEqual(canonicalStageOffset, -1);
const stages = wizard.slice(stageOffset);
const helper = wizard.slice(0, stageOffset);
const canonicalHelper = canonical.slice(0, canonicalStageOffset);

test("Portal credential scripts have valid bash syntax", () => {
  for (const path of [launcherPath, wizardPath]) {
    const result = spawnSync("bash", ["-n", path], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
  }
});

test("Portal keeps the curated helper and hardened launcher contract", () => {
  assert.equal(helper, canonicalHelper);
  assert.match(launcher, /tput\(\)/);
  assert.match(launcher, /export -f tput/);
  assert.match(launcher, /exec bash "\$WIZARD"/);
  assert.doesNotMatch(launcher, /export TERM=dumb/);
});

test("Portal credential stages are verification-only", () => {
  assert.doesNotMatch(stages, /^\s*(?:ask|ask_secret|write_env|set_secret|set_var)\s+/m);
  assert.doesNotMatch(stages, /\bgh\s+(?:secret|variable)\s+set\b/);
  assert.doesNotMatch(stages, /\bwrangler\s+secret\s+(?:put|bulk|delete)\b/);
  assert.doesNotMatch(stages, /\bwrangler\s+deploy\b/);
});

test("Portal wizard covers its provider contract", () => {
  assert.match(stages, /ACCESS_LOGO_ADMIN_AUD/);
  assert.match(stages, /avkroken-portal-logos/);
  assert.match(stages, /Kör verifiering/);
  assert.match(stages, /SKVALLERBYTTAN_OBSERVATIONS/);
  assert.match(stages, /PortalObservationsService/);
  assert.match(stages, /apps\/portal/);
  assert.match(stages, /npm run deploy:workers-builds/);
});
