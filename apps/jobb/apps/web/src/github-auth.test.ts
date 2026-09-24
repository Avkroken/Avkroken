import { afterEach, describe, expect, it, vi } from "vitest";
import {
  authenticatedGitHubUserId,
  handleGitHubCallback,
  startGitHubLogin,
} from "./github-auth";

const baseEnv = {
  GITHUB_OAUTH_CLIENT_ID: "github-client",
  GITHUB_OAUTH_CLIENT_SECRET: "client-secret-placeholder",
  GITHUB_OAUTH_ALLOWED_IDS: {
    get: async () => "123",
  },
};

function cookiePair(setCookie: string, name: string): string {
  const match = setCookie.match(new RegExp(`${name}=([^;,\\s]+)`));
  if (!match) throw new Error(`cookie ${name} missing`);
  return `${name}=${match[1]}`;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GitHub OAuth", () => {
  it("uses state and PKCE, allowlists numeric GitHub id and creates a local session", async () => {
    const start = await startGitHubLogin(
      new Request("https://jobb.denied.se/auth/start?return_to=%2Fapi%2Fdashboard"),
      baseEnv,
    );
    expect(start.status).toBe(303);

    const authorize = new URL(start.headers.get("location") ?? "");
    expect(authorize.origin).toBe("https://github.com");
    expect(authorize.pathname).toBe("/login/oauth/authorize");
    expect(authorize.searchParams.get("client_id")).toBe("github-client");
    expect(authorize.searchParams.get("redirect_uri")).toBe(
      "https://jobb.denied.se/auth/callback",
    );
    expect(authorize.searchParams.get("scope")).toBe("read:user");
    expect(authorize.searchParams.get("code_challenge_method")).toBe("S256");
    expect(authorize.searchParams.get("code_challenge")).toBeTruthy();

    const state = authorize.searchParams.get("state") ?? "";
    const oauthCookie = cookiePair(
      start.headers.get("set-cookie") ?? "",
      "__Host-jobb_oauth",
    );

    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;
        if (url === "https://github.com/login/oauth/access_token") {
          expect(init?.method).toBe("POST");
          const body = String(init?.body ?? "");
          expect(body).toContain("code_verifier=");
          expect(body).toContain(
            "redirect_uri=https%3A%2F%2Fjobb.denied.se%2Fauth%2Fcallback",
          );
          return Response.json({ access_token: "gho_test" });
        }
        if (url === "https://api.github.com/user") {
          expect(new Headers(init?.headers).get("authorization")).toBe(
            "Bearer gho_test",
          );
          return Response.json({ id: 123, login: "operator" });
        }
        if (url.includes("/applications/github-client/token")) {
          expect(init?.method).toBe("DELETE");
          return new Response(null, { status: 204 });
        }
        throw new Error(`unexpected fetch ${url}`);
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    const callback = await handleGitHubCallback(
      new Request(
        `https://jobb.denied.se/auth/callback?code=abc&state=${encodeURIComponent(state)}`,
        { headers: { Cookie: oauthCookie } },
      ),
      baseEnv,
    );
    expect(callback.status).toBe(303);
    expect(callback.headers.get("location")).toBe("/api/dashboard");

    const sessionCookie = cookiePair(
      callback.headers.get("set-cookie") ?? "",
      "__Host-jobb_session",
    );
    await expect(
      authenticatedGitHubUserId(
        new Request("https://jobb.denied.se/", {
          headers: { Cookie: sessionCookie },
        }),
        baseEnv,
      ),
    ).resolves.toBe(123);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("rejects mismatched state before any GitHub request", async () => {
    const start = await startGitHubLogin(
      new Request("https://jobb.denied.se/auth/start"),
      baseEnv,
    );
    const oauthCookie = cookiePair(
      start.headers.get("set-cookie") ?? "",
      "__Host-jobb_oauth",
    );
    const fetchMock = vi.fn(async () => new Response(null, { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);

    const callback = await handleGitHubCallback(
      new Request(
        "https://jobb.denied.se/auth/callback?code=abc&state=wrong",
        { headers: { Cookie: oauthCookie } },
      ),
      baseEnv,
    );

    expect(callback.status).toBe(303);
    expect(callback.headers.get("location")).toBe("/login?error=state");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails closed for a GitHub account outside the allowlist", async () => {
    const start = await startGitHubLogin(
      new Request("https://jobb.denied.se/auth/start"),
      baseEnv,
    );
    const authorize = new URL(start.headers.get("location") ?? "");
    const state = authorize.searchParams.get("state") ?? "";
    const oauthCookie = cookiePair(
      start.headers.get("set-cookie") ?? "",
      "__Host-jobb_oauth",
    );

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;
        if (url === "https://github.com/login/oauth/access_token") {
          return Response.json({ access_token: "gho_test" });
        }
        if (url === "https://api.github.com/user") {
          return Response.json({ id: 999 });
        }
        return new Response(null, { status: 204 });
      }),
    );

    const callback = await handleGitHubCallback(
      new Request(
        `https://jobb.denied.se/auth/callback?code=abc&state=${encodeURIComponent(state)}`,
        { headers: { Cookie: oauthCookie } },
      ),
      baseEnv,
    );

    expect(callback.status).toBe(303);
    expect(callback.headers.get("location")).toBe("/login?error=forbidden");
  });

  it("rechecks an existing session against the current allowlist", async () => {
    const start = await startGitHubLogin(
      new Request("https://jobb.denied.se/auth/start"),
      baseEnv,
    );
    const authorize = new URL(start.headers.get("location") ?? "");
    const state = authorize.searchParams.get("state") ?? "";
    const oauthCookie = cookiePair(
      start.headers.get("set-cookie") ?? "",
      "__Host-jobb_oauth",
    );

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;
        if (url === "https://github.com/login/oauth/access_token") {
          return Response.json({ access_token: "gho_test" });
        }
        if (url === "https://api.github.com/user") {
          return Response.json({ id: 123 });
        }
        return new Response(null, { status: 204 });
      }),
    );

    const callback = await handleGitHubCallback(
      new Request(
        `https://jobb.denied.se/auth/callback?code=abc&state=${encodeURIComponent(state)}`,
        { headers: { Cookie: oauthCookie } },
      ),
      baseEnv,
    );
    const sessionCookie = cookiePair(
      callback.headers.get("set-cookie") ?? "",
      "__Host-jobb_session",
    );

    await expect(
      authenticatedGitHubUserId(
        new Request("https://jobb.denied.se/", {
          headers: { Cookie: sessionCookie },
        }),
        { ...baseEnv, GITHUB_OAUTH_ALLOWED_IDS: "456" },
      ),
    ).resolves.toBeNull();
  });
});
