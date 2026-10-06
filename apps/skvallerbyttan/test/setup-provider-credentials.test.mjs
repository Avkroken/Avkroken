import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

const launcherUrl = new URL("../scripts/setup-provider-credentials.sh", import.meta.url);
const wizardUrl = new URL("../scripts/setup-provider-credentials.wizard.sh", import.meta.url);
const launcherPath = fileURLToPath(launcherUrl);
const wizardPath = fileURLToPath(wizardUrl);
const launcher = await readFile(launcherUrl, "utf8");
const wizard = await readFile(wizardUrl, "utf8");
const stagesMarker = "# STAGES: author this section.";
const stagesOffset = wizard.indexOf(stagesMarker);
assert.notEqual(stagesOffset, -1, "wizard must retain the curated STAGES marker");
const stages = wizard.slice(stagesOffset);

test("credential launcher and generated wizard have valid bash syntax", () => {
  for (const path of [launcherPath, wizardPath]) {
    const result = spawnSync("bash", ["-n", path], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
  }
});

test("launcher makes optional terminal capabilities non-fatal without editing the curated helper", () => {
  assert.match(launcher, /tput\(\)/);
  assert.match(launcher, /bold\|dim\|sgr0\|setaf/);
  assert.match(launcher, /clear\)/);
  assert.match(launcher, /printf '\\033\[2J\\033\[3J\\033\[H'/);
  assert.match(launcher, /export -f tput/);
  assert.match(launcher, /exec bash "\$WIZARD"/);
  assert.doesNotMatch(launcher, /export TERM=dumb/);
  assert.doesNotMatch(launcher, /\bgh\s+(?:secret|variable)\s+set\b/);
  assert.doesNotMatch(launcher, /\bwrangler\b/);
});

test("credential stages remain verification-only", () => {
  assert.doesNotMatch(stages, /^\s*(?:ask|ask_secret|write_env|set_secret|set_var)\s+/m);
  assert.doesNotMatch(stages, /\bgh\s+(?:secret|variable)\s+set\b/);
  assert.doesNotMatch(stages, /\bwrangler\s+secret\s+(?:put|bulk|delete)\b/);
  assert.doesNotMatch(stages, /\bwrangler\s+deploy\b/);
  assert.doesNotMatch(stages, /\bwrangler\s+d1\s+migrations\s+apply\b/);
});

test("GitHub webhook stage distinguishes retired App ingress from processed provider webhook", () => {
  assert.match(stages, /Gamnackens GitHub App-webhook är pensionerad ingress/);
  assert.match(stages, /target type integration/);
  assert.match(stages, /ignored: retired github app webhook/);
  assert.match(stages, /processat svar/);
  assert.match(stages, /Activity\/cache/);
});

test("Cloudflare webhook stages verify route, auth header, and processed delivery", () => {
  assert.match(stages, /\/webhooks\/cloudflare\/notifications/);
  assert.match(stages, /\/webhooks\/cloudflare\/issues/);
  assert.match(stages, /\/webhooks\/cloudflare\/casb/);
  assert.match(stages, /cf-webhook-auth/);
  assert.match(stages, /x-skvallerbyttan-casb-auth/);
  assert.match(stages, /HTTP 202/);
  assert.match(stages, /generic_webhook_test/);
  assert.match(stages, /Aktivitet\/Insyn/);
});

test("Workers Builds stage requires successful current main deployment evidence", () => {
  assert.match(stages, /senaste production-builden från main/);
  assert.match(stages, /npm run check/);
  assert.match(stages, /remote D1 migrations/);
  assert.match(stages, /Worker deploy/);
  assert.match(stages, /verify:production/);
  assert.match(stages, /lyckad main production-build/);
});

test("OAuth verification requires a fresh complete login round trip", () => {
  assert.match(stages, /\/auth\/logout/);
  assert.match(stages, /\/login/);
  assert.match(stages, /Logga in med GitHub/);
  assert.match(stages, /hela OAuth-rundan/);
  assert.match(stages, /KROSA_MAJA_CLIENT_SECRET\/GITHUB_OAUTH_CLIENT_SECRET/);
  assert.match(stages, /login\?error=oauth\/config\/state/);
});

test("machine read token is verified end to end from the real consumer", () => {
  assert.match(stages, /faktiska maskinkonsumenten/);
  assert.match(stages, /GET https:\/\/skvallerbyttan\.denied\.se\/api\/v1\/capabilities/);
  assert.match(stages, /Bearer-token/);
  assert.match(stages, /HTTP 200/);
  assert.match(stages, /consumer=chatgpt/);
  assert.match(stages, /Presence av Worker-secret ensam räcker inte/);
});

test("capability verification requires fresh available provider reads", () => {
  assert.match(stages, /färska status=available-resultat/);
  assert.match(stages, /last success ska vara från den aktuella refreshen/);
  assert.match(stages, /freshness ska vara fresh/);
  assert.match(stages, /error, unknown, not_observed, stale, unavailable eller permission_denied/);
  assert.match(stages, /not_supported/);
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
