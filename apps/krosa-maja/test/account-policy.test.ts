import assert from "node:assert/strict";
import test from "node:test";
import { scrubRootIdentityTokens } from "../src/account-policy.ts";

test("GitHub root identity tokens are removed before persistence", () => {
  const result = scrubRootIdentityTokens({
    providerId: "github",
    accountId: "123",
    accessToken: "github-access",
    refreshToken: "github-refresh",
    idToken: "github-id",
  });
  assert.equal(result.accountId, "123");
  assert.equal(result.accessToken, null);
  assert.equal(result.refreshToken, null);
  assert.equal(result.idToken, null);
});

test("Cloudflare delegated API tokens are retained for encrypted persistence", () => {
  const result = scrubRootIdentityTokens({
    providerId: "cloudflare",
    accessToken: "cf-access",
    refreshToken: "cf-refresh",
  });
  assert.equal(result.accessToken, "cf-access");
  assert.equal(result.refreshToken, "cf-refresh");
});
