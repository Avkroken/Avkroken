import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const wizard = await readFile(
  new URL("../scripts/setup-provider-credentials.sh", import.meta.url),
  "utf8",
);

test("credential wizard is read-only and does not provision secrets or tokens", () => {
  assert.doesNotMatch(wizard, /\\bgh\\s+secret\\s+set\\b/);
  assert.doesNotMatch(wizard, /\\bgh\\s+variable\\s+set\\b/);
  assert.doesNotMatch(wizard, /\\bwrangler\\s+secret\\s+(?:put|bulk|delete)\\b/);
  assert.doesNotMatch(wizard, /\\bwrangler\\s+deploy\\b/);
  assert.doesNotMatch(wizard, /\\bwrangler\\s+d1\\s+migrations\\s+apply\\b/);
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
    assert.match(wizard, new RegExp(name));
  }
});

test("credential wizard preserves the Workers Builds deployment boundary", () => {
  assert.match(wizard, /Avkroken\\/Avkroken/);
  assert.match(wizard, /apps\\/skvallerbyttan/);
  assert.match(wizard, /npm run deploy:workers-builds/);
  assert.match(wizard, /GitHub Actions ska inte synka dessa värden/);
});
