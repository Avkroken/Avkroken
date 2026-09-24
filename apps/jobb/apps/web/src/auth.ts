import { renderErrorPage } from "./auth-ui";
import {
  authenticatedOidcSubject,
  oidcConfigurationState,
  type OidcAuthEnv,
} from "./oidc-auth";

export type DashboardAuthEnv = OidcAuthEnv;

export type DashboardAuthMode =
  | "oidc"
  | "misconfigured"
  | "unconfigured";

export function dashboardAuthMode(env: DashboardAuthEnv): DashboardAuthMode {
  const oidcState = oidcConfigurationState(env);
  if (oidcState === "ready") return "oidc";
  if (oidcState === "misconfigured") return "misconfigured";
  return "unconfigured";
}

export function dashboardAuthConfigured(env: DashboardAuthEnv): boolean {
  return dashboardAuthMode(env) === "oidc";
}

export async function authorizeDashboardRequest(
  request: Request,
  env: DashboardAuthEnv,
): Promise<Response | null> {
  const mode = dashboardAuthMode(env);
  if (mode !== "oidc") {
    const acceptsHtml =
      request.headers.get("accept")?.includes("text/html") ?? false;
    if (request.method === "GET" && acceptsHtml) {
      return renderErrorPage({
        status: 503,
        eyebrow: "Säker inloggning",
        title: "Autentisering är inte redo",
        message:
          "Jobbs Krösa-Maja-konfiguration är inte komplett. Tjänsten är låst tills OIDC-konfigurationen är verifierad.",
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
    const subject = await authenticatedOidcSubject(request, env);
    if (subject) return null;
  } catch (error) {
    console.error("Krösa-Maja dashboard session validation failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const url = new URL(request.url);
  const acceptsHtml = request.headers.get("accept")?.includes("text/html") ?? false;
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
