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
  const oidcAuth = {
    KROSA_MAJA_OIDC_CLIENT_ID: "jobb-client",
    KROSA_MAJA_OIDC_CLIENT_SECRET: {
      get: async () => "generated-client-secret",
    },
  };

  it("is ready when D1 responds and Krösa-Maja OIDC is configured", async () => {
    await expect(getReadiness(fakeDb({ ok: 1 }), oidcAuth)).resolves.toEqual({
      status: "ready",
      checks: { database: true, dashboardAuth: true },
    });
  });

  it("fails closed when the OIDC Secrets Store value cannot be resolved", async () => {
    const result = await getReadiness(fakeDb({ ok: 1 }), {
      KROSA_MAJA_OIDC_CLIENT_ID: "jobb-client",
      KROSA_MAJA_OIDC_CLIENT_SECRET: {
        get: async () => {
          throw new Error("secret unavailable");
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
      oidcAuth,
    );
    expect(result.status).toBe("degraded");
    expect(result.checks.database).toBe(false);
  });

  it("fails closed for partial OIDC configuration", async () => {
    const response = await readinessResponse(fakeDb({ ok: 1 }), {
      KROSA_MAJA_OIDC_CLIENT_ID: "jobb-client",
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
