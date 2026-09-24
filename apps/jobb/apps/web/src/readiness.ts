import { dashboardAuthMode, type DashboardAuthEnv } from "./auth";
import { resolveGitHubClientSecret } from "./github-auth";

export interface ReadinessResult {
  status: "ready" | "degraded";
  checks: {
    database: boolean;
    dashboardAuth: boolean;
  };
}

export async function getReadiness(
  db: D1Database,
  env: DashboardAuthEnv,
): Promise<ReadinessResult> {
  let database = false;
  try {
    const result = await db.prepare("SELECT 1 AS ok").first<{ ok: number }>();
    database = Number(result?.ok ?? 0) === 1;
  } catch {
    database = false;
  }

  const authMode = dashboardAuthMode(env);
  let dashboardAuth = false;
  if (authMode === "github") {
    try {
      await resolveGitHubClientSecret(env);
      dashboardAuth = true;
    } catch {
      dashboardAuth = false;
    }
  }

  return {
    status: database && dashboardAuth ? "ready" : "degraded",
    checks: {
      database,
      dashboardAuth,
    },
  };
}

export async function readinessResponse(
  db: D1Database,
  env: DashboardAuthEnv,
): Promise<Response> {
  const result = await getReadiness(db, env);
  return Response.json(result, {
    status: result.status === "ready" ? 200 : 503,
    headers: { "cache-control": "no-store" },
  });
}
