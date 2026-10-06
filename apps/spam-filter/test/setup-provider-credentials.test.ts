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

test("Spam Filter credential scripts have valid bash syntax", () => {
  for (const path of [launcherPath, wizardPath]) {
    const result = spawnSync("bash", ["-n", path], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
  }
});

test("Spam Filter keeps curated helper and verification-only stages", () => {
  assert.equal(wizard.slice(0, stageOffset), canonical.slice(0, canonicalStageOffset));
  assert.match(launcher, /tput\(\)/);
  assert.doesNotMatch(stages, /^\s*(?:ask|ask_secret|write_env|set_secret|set_var)\s+/m);
  assert.doesNotMatch(stages, /\bwrangler\s+(?:secret|deploy)\b/);
});

test("Spam Filter wizard verifies its real provider boundaries", () => {
  assert.match(stages, /MAIL_FORWARD_TO/);
  assert.match(stages, /Email Routing/);
  assert.match(stages, /catch-all/);
  assert.match(stages, /syntetiskt rent testmail/);
  assert.match(stages, /spam-filter-reputation-eu/);
  assert.match(stages, /Workers AI-binding AI/);
  assert.match(stages, /apps\/spam-filter/);
  assert.match(stages, /npm run deploy:workers-builds/);
});
