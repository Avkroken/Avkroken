import { describe, expect, it } from "vitest";
import {
  classifyOidcStartFailure,
  oidcConfigurationState,
  renderOidcLoginPage,
  resolveOidcClientSecret,
  sanitizeReturnTo,
  verifyOidcIdToken,
} from "./oidc-auth";

const discovery = {
  issuer: "https://auth.denied.se",
  authorization_endpoint: "https://auth.denied.se/api/auth/oauth2/authorize",
  token_endpoint: "https://auth.denied.se/api/auth/oauth2/token",
  jwks_uri: "https://auth.denied.se/api/auth/jwks",
};

describe("Krösa-Maja OIDC configuration", () => {
  it("stays inactive until client credentials exist", () => {
    expect(oidcConfigurationState({})).toBe("inactive");
  });

  it("requires both client id and client secret", () => {
    expect(
      oidcConfigurationState({ KROSA_MAJA_OIDC_CLIENT_ID: "jobb" }),
    ).toBe("misconfigured");
    expect(
      oidcConfigurationState({
        KROSA_MAJA_OIDC_CLIENT_SECRET: "secret",
      }),
    ).toBe("misconfigured");
  });

  it("becomes ready only with a complete confidential client", () => {
    expect(
      oidcConfigurationState({
        KROSA_MAJA_OIDC_CLIENT_ID: "jobb",
        KROSA_MAJA_OIDC_CLIENT_SECRET: "secret",
      }),
    ).toBe("ready");
  });

  it("accepts a Cloudflare Secrets Store binding as configured", () => {
    expect(
      oidcConfigurationState({
        KROSA_MAJA_OIDC_CLIENT_ID: "jobb",
        KROSA_MAJA_OIDC_CLIENT_SECRET: {
          get: async () => "stored-secret",
        },
      }),
    ).toBe("ready");
  });

  it("resolves the OIDC client secret from Secrets Store and rejects an empty value", async () => {
    await expect(
      resolveOidcClientSecret({
        KROSA_MAJA_OIDC_CLIENT_SECRET: {
          get: async () => "  stored-secret  ",
        },
      }),
    ).resolves.toBe("stored-secret");

    await expect(
      resolveOidcClientSecret({
        KROSA_MAJA_OIDC_CLIENT_SECRET: {
          get: async () => " ",
        },
      }),
    ).rejects.toThrow("KROSA_MAJA_OIDC_CLIENT_SECRET");
  });


  it("classifies secret and provider startup failures without credential values", () => {
    expect(
      classifyOidcStartFailure(
        new Error("KROSA_MAJA_OIDC_CLIENT_SECRET could not be resolved"),
      ),
    ).toMatchObject({
      code: "secret_unavailable",
      status: 503,
    });

    expect(
      classifyOidcStartFailure(new Error("OIDC discovery failed with 403")),
    ).toMatchObject({
      code: "provider_unavailable",
      status: 502,
    });
  });

  it("sanitizes post-login return paths", () => {
    expect(sanitizeReturnTo("/runs?month=2026-09")).toBe(
      "/runs?month=2026-09",
    );
    expect(sanitizeReturnTo("https://evil.example/")).toBe("/");
    expect(sanitizeReturnTo("//evil.example/")).toBe("/");
    expect(sanitizeReturnTo("/\\\\evil.example/")).toBe("/");
    expect(sanitizeReturnTo("/safe/../runs?month=2026-09")).toBe(
      "/runs?month=2026-09",
    );
  });

  it("renders the login page without credential material", async () => {
    const response = renderOidcLoginPage(
      new Request("https://jobb.denied.se/login?return_to=%2F"),
      "oidc",
    );
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("Logga in med Krösa-Maja");
    expect(html).toContain("/assets/auth.css");
    expect(html).toContain("Privat operativ");
    expect(html).toContain("Välkommen tillbaka");
    expect(html).not.toContain("client_secret");
    expect(html).not.toContain("KROSA_MAJA_OIDC_CLIENT_SECRET");
  });
});

describe("Krösa-Maja ID token verification", () => {
  it("verifies RS256 signature, issuer, audience and nonce", async () => {
    const fixture = await signedToken({
      iss: "https://auth.denied.se",
      sub: "user-subject",
      aud: "jobb-client",
      nonce: "nonce-1",
    });

    await expect(
      verifyOidcIdToken(
        fixture.token,
        discovery,
        "jobb-client",
        "nonce-1",
        fixture.fetchJwks,
      ),
    ).resolves.toEqual({ sub: "user-subject" });
  });

  it("rejects a mismatched nonce", async () => {
    const fixture = await signedToken({
      iss: "https://auth.denied.se",
      sub: "user-subject",
      aud: "jobb-client",
      nonce: "nonce-1",
    });

    await expect(
      verifyOidcIdToken(
        fixture.token,
        discovery,
        "jobb-client",
        "nonce-2",
        fixture.fetchJwks,
      ),
    ).rejects.toThrow("nonce");
  });

  it("rejects a mismatched audience", async () => {
    const fixture = await signedToken({
      iss: "https://auth.denied.se",
      sub: "user-subject",
      aud: "other-client",
      nonce: "nonce-1",
    });

    await expect(
      verifyOidcIdToken(
        fixture.token,
        discovery,
        "jobb-client",
        "nonce-1",
        fixture.fetchJwks,
      ),
    ).rejects.toThrow("audience");
  });

  it("rejects tokens from another issuer", async () => {
    const fixture = await signedToken({
      iss: "https://other.example",
      sub: "user-subject",
      aud: "jobb-client",
      nonce: "nonce-1",
    });

    await expect(
      verifyOidcIdToken(
        fixture.token,
        discovery,
        "jobb-client",
        "nonce-1",
        fixture.fetchJwks,
      ),
    ).rejects.toThrow("issuer");
  });
});

async function signedToken(claims: {
  iss: string;
  sub: string;
  aud: string;
  nonce: string;
}) {
  const pair = (await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  )) as CryptoKeyPair;

  const exportedJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  const publicJwk = {
    ...exportedJwk,
    kid: "test-key",
    alg: "RS256",
    use: "sig",
  };

  const now = Math.floor(Date.now() / 1000);
  const header = encodeJson({ alg: "RS256", kid: "test-key", typ: "JWT" });
  const payload = encodeJson({
    ...claims,
    iat: now,
    exp: now + 300,
  });
  const signingInput = `${header}.${payload}`;
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    pair.privateKey,
    new TextEncoder().encode(signingInput),
  );
  const token = `${signingInput}.${base64url(new Uint8Array(signature))}`;

  return {
    token,
    fetchJwks: (async () =>
      Response.json({ keys: [publicJwk] })) as typeof fetch,
  };
}

function encodeJson(value: unknown): string {
  return base64url(
    new TextEncoder().encode(JSON.stringify(value)),
  );
}

function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}
