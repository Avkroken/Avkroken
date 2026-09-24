import { renderErrorPage } from "./auth-ui";
import {
  authenticatedGitHubUserId,
  githubAuthConfigurationState,
  type GitHubAuthEnv,
} from "./github-auth";

export type DashboardAuthEnv = GitHubAuthEnv;

export type DashboardAuthMode =
  | "github"
  | "misconfigured"
  | "unconfigured";

export function dashboardAuthMode(env: DashboardAuthEnv): DashboardAuthMode {
  const state = githubAuthConfigurationState(env);
  if (state === "ready") return "github";
  if (state === "misconfigured") return "misconfigured";
  return "unconfigured";
}

export function dashboardAuthConfigured(env: DashboardAuthEnv): boolean {
  return dashboardAuthMode(env) === "github";
}

export async function authorizeDashboardRequest(
  request: Request,
  env: DashboardAuthEnv,
): Promise<Response | null> {
  const mode = dashboardAuthMode(env);
  if (mode !== "github") {
    const acceptsHtml =
      request.headers.get("accept")?.includes("text/html") ?? false;
    if (request.method === "GET" && acceptsHtml) {
      return renderErrorPage({
        status: 503,
        eyebrow: "Säker inloggning",
        title: "Autentisering är inte redo",
        message:
          "Jobbs GitHub OAuth-konfiguration är inte komplett. Tjänsten är låst tills klienten, allowlisten och klienthemligheten är verifierade.",
        code: "auth_unavailable",
        primaryHref: "/login",
        primaryLabel: "Till inloggningen",
      });
    }
    return Response.json(
      { error: "dashboard authentication is not configured" },
      {
        status: 503,
        headers: { "cache-control": "no-store" },
      },
    );
  }

  try {
    const userId = await authenticatedGitHubUserId(request, env);
    if (userId) return null;
  } catch (error) {
    console.error("GitHub dashboard session validation failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const url = new URL(request.url);
  const acceptsHtml =
    request.headers.get("accept")?.includes("text/html") ?? false;
  if (
    request.method === "GET" &&
    (url.pathname === "/" || acceptsHtml)
  ) {
    const returnTo = encodeURIComponent(`${url.pathname}${url.search}`);
    return redirect(`/login?return_to=${returnTo}`);
  }

  return Response.json(
    { error: "authentication required" },
    {
      status: 401,
      headers: { "cache-control": "no-store" },
    },
  );
}

function redirect(location: string): Response {
  return new Response(null, {
    status: 303,
    headers: {
      Location: location,
      "cache-control": "no-store",
      "referrer-policy": "no-referrer",
    },
  });
}
