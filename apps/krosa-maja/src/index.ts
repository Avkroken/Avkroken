import {
  oauthProviderAuthServerMetadata,
  oauthProviderOpenIdConfigMetadata,
} from "@better-auth/oauth-provider";
import { requireAdmin, splitUris } from "./admin.ts";
import {
  runAuthPostForJsonRedirect,
  runAuthPostForRedirect,
} from "./auth-actions.ts";
import { createAuth } from "./auth.ts";
import { verifyCloudflareApiAccess } from "./cloudflare.ts";
import { readRuntimeConfig, requestUsesConfiguredOrigin, sameOriginPost } from "./config.ts";
import { resolveRuntimeSecrets, type Env } from "./env.ts";
import {
  adminPage,
  clientCreatedPage,
  cloudflareVerifiedPage,
  consentPage,
  consentScript,
  signInPage,
} from "./pages.ts";
import { jsonResponse, securityHeaders } from "./security.ts";

function formString(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}

function methodNotAllowed(allow: string): Response {
  const response = jsonResponse({ error: "method not allowed" }, 405);
  response.headers.set("Allow", allow);
  return response;
}

function redirect(location: string): Response {
  const headers = securityHeaders();
  headers.set("Location", location);
  return new Response(null, { status: 303, headers });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);


    let config;
    let runtimeSecrets;
    try {
      runtimeSecrets = await resolveRuntimeSecrets(env);
      config = readRuntimeConfig(env, runtimeSecrets);
    } catch (error) {
      console.error("Krösa-Maja configuration error", {
        error: error instanceof Error ? error.message : String(error),
      });
      return jsonResponse({ ok: false, error: "service misconfigured" }, 503);
    }

    if (!requestUsesConfiguredOrigin(request, config.baseUrl)) {
      return jsonResponse({ error: "misdirected request" }, 421);
    }


    const auth = createAuth(env, config, runtimeSecrets);

    if (url.pathname === "/.well-known/openid-configuration") {
      if (request.method !== "GET") return methodNotAllowed("GET");
      return oauthProviderOpenIdConfigMetadata(auth)(request);
    }
    if (url.pathname === "/.well-known/oauth-authorization-server") {
      if (request.method !== "GET") return methodNotAllowed("GET");
      return oauthProviderAuthServerMetadata(auth)(request);
    }

    if (url.pathname === "/sign-in") {
      if (request.method !== "GET") return methodNotAllowed("GET");
      return signInPage(url.searchParams.toString());
    }
    if (url.pathname === "/sign-in/github") {
      if (request.method === "GET") {
        const fetchSite = request.headers.get("sec-fetch-site");
        if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
          return jsonResponse({ error: "invalid navigation" }, 403);
        }
        return runAuthPostForRedirect(auth, request, config.baseUrl, "/sign-in/social", {
          provider: "github",
          callbackURL: `${config.baseUrl}/admin`,
        });
      }
      if (request.method !== "POST") return methodNotAllowed("GET, POST");
      if (!sameOriginPost(request, config.baseUrl)) return jsonResponse({ error: "invalid origin" }, 403);
      const form = await request.formData();
      const oauthQuery = formString(form, "oauth_query");
      return runAuthPostForRedirect(auth, request, config.baseUrl, "/sign-in/social", {
        provider: "github",
        callbackURL: `${config.baseUrl}/admin`,
        ...(oauthQuery ? { oauth_query: oauthQuery } : {}),
      });
    }

    if (url.pathname === "/consent.js") {
      if (request.method !== "GET") return methodNotAllowed("GET");
      return consentScript();
    }
    if (url.pathname === "/consent") {
      if (request.method !== "GET") return methodNotAllowed("GET");
      return consentPage(url.searchParams);
    }
    if (url.pathname === "/consent/decision") {
      if (request.method !== "POST") return methodNotAllowed("POST");
      if (!sameOriginPost(request, config.baseUrl)) return jsonResponse({ error: "invalid origin" }, 403);
      const form = await request.formData();
      const oauthQuery = formString(form, "oauth_query");
      const accept = formString(form, "accept") === "true";
      if (!oauthQuery) return jsonResponse({ error: "missing oauth query" }, 400);
      const body = {
        accept,
        oauth_query: oauthQuery,
      };
      if (request.headers.get("accept")?.includes("application/json")) {
        return runAuthPostForJsonRedirect(
          auth,
          request,
          config.baseUrl,
          "/oauth2/consent",
          body,
        );
      }
      return runAuthPostForRedirect(
        auth,
        request,
        config.baseUrl,
        "/oauth2/consent",
        body,
      );
    }

    if (url.pathname === "/admin") {
      if (request.method !== "GET") return methodNotAllowed("GET");
      const admin = await requireAdmin(auth, request, config);
      if (!admin) return redirect(`/sign-in?return_to=${encodeURIComponent("/admin")}`);
      return adminPage({
        cloudflareConfigured: config.cloudflare.enabled,
        cloudflareLinked: admin.accounts.some((account) => account.providerId === "cloudflare"),
        accounts: admin.accounts,
      });
    }

    if (url.pathname === "/admin/connect-cloudflare") {
      if (request.method !== "POST") return methodNotAllowed("POST");
      if (!sameOriginPost(request, config.baseUrl)) return jsonResponse({ error: "invalid origin" }, 403);
      const admin = await requireAdmin(auth, request, config);
      if (!admin) return jsonResponse({ error: "authentication required" }, 401);
      if (!config.cloudflare.enabled) return jsonResponse({ error: "Cloudflare OAuth client not configured" }, 503);
      return runAuthPostForRedirect(auth, request, config.baseUrl, "/link-social", {
        provider: "cloudflare",
        callbackURL: `${config.baseUrl}/admin`,
        scopes: [...config.cloudflare.scopes],
      });
    }

    if (url.pathname === "/admin/verify-cloudflare") {
      if (request.method !== "POST") return methodNotAllowed("POST");
      if (!sameOriginPost(request, config.baseUrl)) return jsonResponse({ error: "invalid origin" }, 403);
      const admin = await requireAdmin(auth, request, config);
      if (!admin) return jsonResponse({ error: "authentication required" }, 401);
      if (!config.cloudflare.enabled) return jsonResponse({ error: "Cloudflare OAuth client not configured" }, 503);
      try {
        const user = await verifyCloudflareApiAccess(auth, request, admin.accounts);
        return cloudflareVerifiedPage(user);
      } catch (error) {
        console.error("Cloudflare delegated API verification failed", {
          error: error instanceof Error ? error.message : String(error),
        });
        return jsonResponse({ error: "Cloudflare API verification failed" }, 502);
      }
    }

    if (url.pathname === "/admin/clients") {
      if (request.method !== "POST") return methodNotAllowed("POST");
      if (!sameOriginPost(request, config.baseUrl)) return jsonResponse({ error: "invalid origin" }, 403);
      const admin = await requireAdmin(auth, request, config);
      if (!admin) return jsonResponse({ error: "authentication required" }, 401);
      const form = await request.formData();
      const applicationType = formString(form, "client_type") === "native" ? "native" : "web";
      const redirectUris = splitUris(form.get("redirect_uris"));
      if (redirectUris.length === 0) return jsonResponse({ error: "at least one redirect URI is required" }, 400);
      const postLogoutRedirectUris = splitUris(form.get("post_logout_redirect_uris"));
      const confidential = applicationType === "web";
      const adminHeaders = new Headers(request.headers);
      adminHeaders.set("x-krosa-maja-internal-admin", runtimeSecrets.internalAdminSecret);
      const created = await auth.api.adminCreateOAuthClient({
        headers: adminHeaders,
        body: {
          client_name: formString(form, "client_name").trim() || undefined,
          redirect_uris: redirectUris,
          ...(postLogoutRedirectUris.length ? { post_logout_redirect_uris: postLogoutRedirectUris } : {}),
          application_type: applicationType,
          token_endpoint_auth_method: confidential ? "client_secret_basic" : "none",
          grant_types: ["authorization_code", "refresh_token"],
          response_types: ["code"],
          require_pkce: true,
          skip_consent: formString(form, "skip_consent") === "true",
          enable_end_session: true,
          client_secret_expires_at: confidential ? 0 : undefined,
          scope: "openid profile email offline_access",
        },
      });
      return clientCreatedPage(created);
    }

    if (url.pathname === "/") {
      if (request.method !== "GET") return methodNotAllowed("GET");
      return redirect("/admin");
    }

    if (url.pathname.startsWith("/api/auth/")) {
      return auth.handler(request);
    }

    return jsonResponse({ error: "not found" }, 404);
  },
} satisfies ExportedHandler<Env>;
