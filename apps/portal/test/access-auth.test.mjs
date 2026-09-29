import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPair, SignJWT } from "jose";
import {
  accessJwtConfig,
  authorizeLogoAdmin,
  verifyAccessToken
} from "../src/access-auth.mjs";

const TEAM_DOMAIN = "https://avkroken.cloudflareaccess.com";
const AUDIENCE = "aud-123";

test("Access config accepts only an HTTPS team origin and a non-empty audience", () => {
  assert.deepEqual(
    accessJwtConfig({
      ACCESS_TEAM_DOMAIN: TEAM_DOMAIN + "/",
      ACCESS_LOGO_ADMIN_AUD: "  " + AUDIENCE + "  "
    }),
    { teamDomain: TEAM_DOMAIN, audience: AUDIENCE }
  );

  for (const value of [
    "",
    "http://avkroken.cloudflareaccess.com",
    TEAM_DOMAIN + "/path",
    TEAM_DOMAIN + "?query=1",
    "not-a-url"
  ]) {
    assert.equal(
      accessJwtConfig({ ACCESS_TEAM_DOMAIN: value, ACCESS_LOGO_ADMIN_AUD: AUDIENCE }),
      null,
      value
    );
  }

  assert.equal(accessJwtConfig({ ACCESS_TEAM_DOMAIN: TEAM_DOMAIN }), null);
});

test("JWT verification pins issuer and application audience", async () => {
  const jwks = { kind: "synthetic-jwks" };
  let observed = null;
  const result = await verifyAccessToken(
    "signed-access-token",
    { teamDomain: TEAM_DOMAIN, audience: AUDIENCE },
    {
      jwks,
      jwtVerify: async (token, keySet, options) => {
        observed = { token, keySet, options };
        return { payload: { sub: "member-1" } };
      }
    }
  );

  assert.deepEqual(result.payload, { sub: "member-1" });
  assert.deepEqual(observed, {
    token: "signed-access-token",
    keySet: jwks,
    options: { issuer: TEAM_DOMAIN, audience: AUDIENCE }
  });
});

test("logo admin authorization fails closed before JWT verification", async () => {
  const request = new Request("https://avkroken.denied.se/api/admin/logos");

  assert.deepEqual(
    await authorizeLogoAdmin(request, {}),
    { ok: false, status: 503, error: "access_not_configured" }
  );

  assert.deepEqual(
    await authorizeLogoAdmin(request, {
      ACCESS_TEAM_DOMAIN: TEAM_DOMAIN,
      ACCESS_LOGO_ADMIN_AUD: AUDIENCE
    }),
    { ok: false, status: 401, error: "access_token_missing" }
  );
});

test("logo admin authorization accepts verified Access JWTs and rejects invalid ones", async () => {
  const env = {
    ACCESS_TEAM_DOMAIN: TEAM_DOMAIN,
    ACCESS_LOGO_ADMIN_AUD: AUDIENCE
  };
  const request = new Request("https://avkroken.denied.se/api/admin/logos", {
    headers: { "Cf-Access-Jwt-Assertion": "token-value" }
  });

  const allowed = await authorizeLogoAdmin(request, env, {
    jwks: {},
    jwtVerify: async () => ({ payload: { email: "member@example.test" } })
  });
  assert.equal(allowed.ok, true);
  assert.deepEqual(allowed.payload, { email: "member@example.test" });

  const denied = await authorizeLogoAdmin(request, env, {
    jwks: {},
    jwtVerify: async () => {
      throw new Error("invalid signature");
    }
  });
  assert.deepEqual(
    denied,
    { ok: false, status: 403, error: "access_token_invalid" }
  );
});


async function signAccessToken(privateKey, overrides = {}) {
  return new SignJWT({ sub: "member-1" })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(overrides.issuer || TEAM_DOMAIN)
    .setAudience(overrides.audience || AUDIENCE)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(privateKey);
}

test("real signed Access JWT verification denies malformed, signature, issuer and audience failures", async () => {
  const primary = await generateKeyPair("RS256");
  const other = await generateKeyPair("RS256");
  const env = {
    ACCESS_TEAM_DOMAIN: TEAM_DOMAIN,
    ACCESS_LOGO_ADMIN_AUD: AUDIENCE
  };

  const valid = await signAccessToken(primary.privateKey);
  const wrongIssuer = await signAccessToken(primary.privateKey, {
    issuer: "https://other.cloudflareaccess.com"
  });
  const wrongAudience = await signAccessToken(primary.privateKey, {
    audience: "other-audience"
  });
  const wrongSignature = await signAccessToken(other.privateKey);

  const cases = [
    ["malformed", "not-a-jwt"],
    ["invalid signature", wrongSignature],
    ["wrong issuer", wrongIssuer],
    ["wrong audience", wrongAudience]
  ];

  for (const [label, token] of cases) {
    const denied = await authorizeLogoAdmin(
      new Request("https://avkroken.denied.se/api/admin/logos", {
        headers: { "Cf-Access-Jwt-Assertion": token }
      }),
      env,
      { jwks: primary.publicKey }
    );
    assert.deepEqual(
      denied,
      { ok: false, status: 403, error: "access_token_invalid" },
      label
    );
  }

  const allowed = await authorizeLogoAdmin(
    new Request("https://avkroken.denied.se/api/admin/logos", {
      headers: { "Cf-Access-Jwt-Assertion": valid }
    }),
    env,
    { jwks: primary.publicKey }
  );
  assert.equal(allowed.ok, true);
  assert.equal(allowed.payload.sub, "member-1");
});
