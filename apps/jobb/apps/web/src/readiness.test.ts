import { describe, expect, it } from "vitest";
import { getReadiness, readinessResponse } from "./readiness";

function fakeDb(result: { ok: number } | Error): D1Database {
  return {
    prepare() {
      return {
        async first() {
          if (result instanceof Error) throw result;
          return result;
        },
      };
    },
  } as unknown as D1Database;
}

describe("readiness", () => {
  const githubAuth = {
    GITHUB_OAUTH_CLIENT_ID: "github-client",
    GITHUB_OAUTH_CLIENT_SECRET: {
      get: async () => "github-client-secret",
    },
    GITHUB_OAUTH_ALLOWED_IDS: "123",
  };

  it("is ready when D1 responds and GitHub OAuth is configured", async () => {
    await expect(getReadiness(fakeDb({ ok: 1 }), githubAuth)).resolves.toEqual({
      status: "ready",
      checks: { database: true, dashboardAuth: true },
    });
  });

  it("fails closed when the GitHub OAuth secret cannot be resolved", async () => {
    const result = await getReadiness(fakeDb({ ok: 1 }), {
      GITHUB_OAUTH_CLIENT_ID: "github-client",
      GITHUB_OAUTH_CLIENT_SECRET: {
        get: async () => {
          throw new Error("secret unavailable");
        },
      },
      GITHUB_OAUTH_ALLOWED_IDS: "123",
    });

    expect(result).toEqual({
      status: "degraded",
      checks: { database: true, dashboardAuth: false },
    });
  });

  it("fails closed when the OAuth allowlist binding is unavailable", async () => {
    const result = await getReadiness(fakeDb({ ok: 1 }), {
      GITHUB_OAUTH_CLIENT_ID: "github-client",
      GITHUB_OAUTH_CLIENT_SECRET: "client-secret-placeholder",
      GITHUB_OAUTH_ALLOWED_IDS: {
        get: async () => {
          throw new Error("allowlist unavailable");
        },
      },
    });

    expect(result).toEqual({
      status: "degraded",
      checks: { database: true, dashboardAuth: false },
    });
  });

  it("fails closed when D1 cannot be read", async () => {
    const result = await getReadiness(
      fakeDb(new Error("D1 unavailable")),
      githubAuth,
    );
    expect(result.status).toBe("degraded");
    expect(result.checks.database).toBe(false);
  });

  it("fails closed for partial GitHub OAuth configuration", async () => {
    const response = await readinessResponse(fakeDb({ ok: 1 }), {
      GITHUB_OAUTH_CLIENT_ID: "github-client",
      GITHUB_OAUTH_ALLOWED_IDS: "123",
    });
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      status: "degraded",
      checks: { database: true, dashboardAuth: false },
    });
  });

  it("fails closed when dashboard auth is missing", async () => {
    const response = await readinessResponse(fakeDb({ ok: 1 }), {});
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      status: "degraded",
      checks: { database: true, dashboardAuth: false },
    });
  });
});
