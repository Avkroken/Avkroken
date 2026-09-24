import assert from "node:assert/strict";
import test from "node:test";
import {
  AUTH_IP_ADDRESS_HEADERS,
  createProtocolPlugins,
} from "../src/auth-shared.ts";

test("OAuth provider contract remains explicit and deny-by-default", () => {
  const [jwtPlugin, provider] = createProtocolPlugins("https://auth.example.test");

  assert.equal(jwtPlugin.id, "jwt");
  assert.equal(jwtPlugin.options.jwt?.issuer, "https://auth.example.test");

  assert.equal(provider.id, "oauth-provider");
  assert.equal(provider.options.loginPage, "/sign-in");
  assert.equal(provider.options.consentPage, "/consent");

  assert.deepEqual(provider.options.scopes, [
    "openid",
    "profile",
    "email",
    "offline_access",
  ]);
  assert.deepEqual(provider.options.grantTypes, [
    "authorization_code",
    "refresh_token",
  ]);

  assert.equal(provider.options.allowDynamicClientRegistration, false);
  assert.equal(provider.options.allowUnauthenticatedClientRegistration, false);
  assert.equal(provider.options.allowPublicClientPrelogin, false);
  assert.equal(provider.options.clientRegistrationRequirePKCE, true);
});


test("Cloudflare auth traffic has explicit trusted client IP headers", () => {
  assert.deepEqual(AUTH_IP_ADDRESS_HEADERS, [
    "cf-connecting-ip",
    "x-real-ip",
  ]);
});
