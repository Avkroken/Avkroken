import { describe, expect, it } from "vitest";
import { getReadiness, readinessResponse } from "./readiness";

interface FakeDbOptions {
  databaseOk?: boolean;
  runtimeConfiguration?: boolean;
  error?: Error;
}

function fakeDb(options: FakeDbOptions = {}): D1Database {
  const {
    databaseOk = true,
    runtimeConfiguration = true,
    error,
  } = options;

  return {
    prepare(sql: string) {
      const statement = {
        bind() {
          return statement;
        },
        async first() {
          if (error) throw error;
          if (sql.includes("SELECT 1 AS ok")) {
            return { ok: databaseOk ? 1 : 0 };
          }
          if (sql.includes("runtime_configuration")) {
            return {
              schema_ready: runtimeConfiguration ? 1 : 0,
              migration_tracked: runtimeConfiguration ? 1 : 0,
            };
          }
          return null;
        },
      };
      return statement;
    },
  } as unknown as D1Database;
}

describe("readiness", () => {
  const githubAuth = {
    GITHUB_OAUTH_CLIENT_ID: "github-client",
    GITHUB_OAUTH_CLIENT_SECRET: {
      get: async () => "github-client-secret",
    },
    JOBB_ALLOWED_GITHUB_IDS: "123",
  };

  it("is ready when D1, runtime schema and GitHub OAuth are ready", async () => {
    await expect(getReadiness(fakeDb(), githubAuth)).resolves.toEqual({
      status: "ready",
      checks: {
        database: true,
        dashboardAuth: true,
        runtimeConfiguration: true,
      },
    });
  });

  it("fails closed while the runtime configuration migration is missing", async () => {
    const result = await getReadiness(
      fakeDb({ runtimeConfiguration: false }),
      githubAuth,
    );

    expect(result).toEqual({
      status: "degraded",
      checks: {
        database: true,
        dashboardAuth: true,
        runtimeConfiguration: false,
      },
    });
  });

  it("fails closed when the GitHub OAuth secret cannot be resolved", async () => {
    const result = await getReadiness(fakeDb(), {
      GITHUB_OAUTH_CLIENT_ID: "github-client",
      GITHUB_OAUTH_CLIENT_SECRET: {
        get: async () => {
          throw new Error("secret unavailable");
        },
      },
      JOBB_ALLOWED_GITHUB_IDS: "123",
    });

    expect(result).toEqual({
      status: "degraded",
      checks: {
        database: true,
        dashboardAuth: false,
        runtimeConfiguration: true,
      },
    });
  });

  it("fails closed when D1 cannot be read", async () => {
    const result = await getReadiness(
      fakeDb({ error: new Error("D1 unavailable") }),
      githubAuth,
    );
    expect(result.status).toBe("degraded");
    expect(result.checks.database).toBe(false);
    expect(result.checks.runtimeConfiguration).toBe(false);
  });

  it("fails closed for partial GitHub OAuth configuration", async () => {
    const response = await readinessResponse(fakeDb(), {
      GITHUB_OAUTH_CLIENT_ID: "github-client",
      JOBB_ALLOWED_GITHUB_IDS: "123",
    });
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      status: "degraded",
      checks: {
        database: true,
        dashboardAuth: false,
        runtimeConfiguration: true,
      },
    });
  });

  it("fails closed when dashboard auth is missing", async () => {
    const response = await readinessResponse(fakeDb(), {});
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      status: "degraded",
      checks: {
        database: true,
        dashboardAuth: false,
        runtimeConfiguration: true,
      },
    });
  });
});
