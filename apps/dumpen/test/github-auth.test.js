import assert from "node:assert/strict";
import test from "node:test";
import { authenticatedGitHubUserId, githubAuthConfigurationState, handleGitHubCallback, sanitizeReturnTo, startGitHubLogin } from "../src/github-auth.js";

const baseEnv = { GITHUB_OAUTH_CLIENT_ID: "github-client", GITHUB_OAUTH_CLIENT_SECRET: "github-client-secret", DUMPEN_ALLOWED_GITHUB_IDS: "123" };

function cookiePair(setCookie, name) {
  const match = setCookie.match(new RegExp(`${name}=([^;,\\s]+)`));
  if (!match) throw new Error(`cookie ${name} missing`);
  return `${name}=${match[1]}`;
}

test("GitHub OAuth config fails closed unless client, secret and allowlist exist", () => {
  assert.equal(githubAuthConfigurationState({}), "inactive");
  assert.equal(githubAuthConfigurationState({ GITHUB_OAUTH_CLIENT_ID: "id" }), "misconfigured");
  assert.equal(githubAuthConfigurationState(baseEnv), "ready");
});

test("return target is restricted to Dumpen admin paths", () => {
  assert.equal(sanitizeReturnTo("/admin?view=objects"), "/admin?view=objects");
  assert.equal(sanitizeReturnTo("/admin/api/objects"), "/admin/api/objects");
  assert.equal(sanitizeReturnTo("/"), "/admin");
  assert.equal(sanitizeReturnTo("https://evil.example/admin"), "/admin");
});

test("OAuth uses state and PKCE, allowlists numeric GitHub ID and creates a local session", async () => {
  const start = await startGitHubLogin(new Request("https://dumpen.denied.se/auth/start?return_to=%2Fadmin"), baseEnv);
  assert.equal(start.status, 303);
  const authorize = new URL(start.headers.get("location"));
  assert.equal(authorize.origin, "https://github.com");
  assert.equal(authorize.pathname, "/login/oauth/authorize");
  assert.equal(authorize.searchParams.get("redirect_uri"), "https://dumpen.denied.se/auth/callback");
  assert.equal(authorize.searchParams.get("scope"), "read:user");
  assert.equal(authorize.searchParams.get("code_challenge_method"), "S256");
  assert.ok(authorize.searchParams.get("code_challenge"));
  const state = authorize.searchParams.get("state");
  const oauthCookie = cookiePair(start.headers.get("set-cookie"), "__Host-dumpen_oauth");
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (input, init = {}) => {
    calls += 1;
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (url === "https://github.com/login/oauth/access_token") {
      assert.equal(init.method, "POST");
      assert.match(String(init.body), /code_verifier=/);
      return Response.json({ access_token: "gho_test" });
    }
    if (url === "https://api.github.com/user") {
      assert.equal(new Headers(init.headers).get("authorization"), "Bearer gho_test");
      return Response.json({ id: 123, login: "operator" });
    }
    if (url.includes("/applications/github-client/token")) return new Response(null, { status: 204 });
    throw new Error(`unexpected fetch ${url}`);
  };
  try {
    const callback = await handleGitHubCallback(new Request(`https://dumpen.denied.se/auth/callback?code=abc&state=${encodeURIComponent(state)}`, { headers: { Cookie: oauthCookie } }), baseEnv);
    assert.equal(callback.status, 303);
    assert.equal(callback.headers.get("location"), "/admin");
    const sessionCookie = cookiePair(callback.headers.get("set-cookie"), "__Host-dumpen_session");
    assert.equal(await authenticatedGitHubUserId(new Request("https://dumpen.denied.se/admin", { headers: { Cookie: sessionCookie } }), baseEnv), 123);
    assert.equal(calls, 3);
  } finally { globalThis.fetch = originalFetch; }
});

test("OAuth rejects mismatched state before any GitHub request", async () => {
  const start = await startGitHubLogin(new Request("https://dumpen.denied.se/auth/start"), baseEnv);
  const oauthCookie = cookiePair(start.headers.get("set-cookie"), "__Host-dumpen_oauth");
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; return new Response(null, { status: 500 }); };
  try {
    const callback = await handleGitHubCallback(new Request("https://dumpen.denied.se/auth/callback?code=abc&state=wrong", { headers: { Cookie: oauthCookie } }), baseEnv);
    assert.equal(callback.status, 303);
    assert.equal(callback.headers.get("location"), "/login?error=state");
    assert.equal(calls, 0);
  } finally { globalThis.fetch = originalFetch; }
});

test("OAuth rejects a GitHub account outside the allowlist", async () => {
  const start = await startGitHubLogin(new Request("https://dumpen.denied.se/auth/start"), baseEnv);
  const authorize = new URL(start.headers.get("location"));
  const state = authorize.searchParams.get("state");
  const oauthCookie = cookiePair(start.headers.get("set-cookie"), "__Host-dumpen_oauth");
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (url === "https://github.com/login/oauth/access_token") return Response.json({ access_token: "gho_test" });
    if (url === "https://api.github.com/user") return Response.json({ id: 999 });
    return new Response(null, { status: 204 });
  };
  try {
    const callback = await handleGitHubCallback(new Request(`https://dumpen.denied.se/auth/callback?code=abc&state=${encodeURIComponent(state)}`, { headers: { Cookie: oauthCookie } }), baseEnv);
    assert.equal(callback.status, 303);
    assert.equal(callback.headers.get("location"), "/login?error=forbidden");
  } finally { globalThis.fetch = originalFetch; }
});
