import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalBaseUrl,
  parseCloudflareScopes,
  parseGitHubIds,
} from "../src/config.ts";

test("canonical base URL requires a bare HTTPS origin", () => {
  assert.equal(canonicalBaseUrl("https://auth.example.test/"), "https://auth.example.test");
  assert.throws(() => canonicalBaseUrl("http://auth.example.test"), /https/);
  assert.throws(() => canonicalBaseUrl("https://auth.example.test/path"), /without a path/);
  assert.throws(() => canonicalBaseUrl("https://user:pass@auth.example.test"), /credentials/);
});

test("GitHub allowlists accept only positive numeric IDs", () => {
  assert.deepEqual([...parseGitHubIds("123, 456,123", "TEST")], ["123", "456"]);
  assert.throws(() => parseGitHubIds("user-name", "TEST"), /invalid GitHub numeric ID/);
  assert.throws(() => parseGitHubIds("", "TEST"), /at least one/);
});

test("Cloudflare API scopes always preserve offline_access", () => {
  assert.deepEqual(parseCloudflareScopes("zone.read, account.read zone.read"), [
    "offline_access",
    "zone.read",
    "account.read",
  ]);
});

test("Cloudflare OAuth scopes reject obsolete colon-delimited names", () => {
  assert.throws(() => parseCloudflareScopes("account:read"), /must not use colon/);
});
