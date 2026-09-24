import type { Env } from "./env";
import { GitHubApiError } from "./github";
import {
  handleObservationApi,
  reconcileAllCapabilitySources,
  reconcileObservationSources,
  refreshOverviewSource,
} from "./observations-api";
import { authorizeReadRequest } from "./read-access";
import type { ReadConsumer } from "./telemetry";
import { CloudflareApiError } from "./cloudflare";
import { pruneCloudflareEvents } from "./cloudflare-events";
import {
  handleCloudflareCasbWebhook,
  handleCloudflareNotificationsWebhook,
} from "./cloudflare-webhook";
import {
  pruneWebhookDeliveries,
  sourceCacheConfigured,
} from "./source-cache";
import { handleGitHubWebhook } from "./webhook";
import { reportRuntimeHeartbeat } from "./runtime-heartbeat";
import {
  authConfigured,
  authenticatedUserId,
  handleGitHubCallback,
  loginPage,
  logout,
  startGitHubLogin,
} from "./auth";

const WEBHOOK_DELIVERY_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const CLOUDFLARE_EVENT_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
function json(value: unknown, status = 200, extraHeaders?: HeadersInit): Response {
  const headers = new Headers(extraHeaders);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("x-content-type-options", "nosniff");
  return new Response(JSON.stringify(value), { status, headers });
}

function configured(env: Env): boolean {
  return authConfigured(env);
}

function redirectToLogin(): Response {
  return new Response(null, {
    status: 303,
    headers: {
      Location: "/login",
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}

async function scheduledCapabilityRefresh(env: Env): Promise<void> {
  if (!sourceCacheConfigured(env)) {
    console.error("scheduled capability refresh skipped: STATS_DB is not bound");
    return;
  }
  try {
    await reconcileAllCapabilitySources(env);
  } catch (error) {
    console.error("scheduled capability reconciliation failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function scheduledRefresh(env: Env, context: ExecutionContext): Promise<void> {
  if (!sourceCacheConfigured(env)) {
    console.error("scheduled source refresh skipped: STATS_DB is not bound");
    return;
  }

  try {
    await refreshOverviewSource(env, context);
  } catch (error) {
    console.error("scheduled reconciliation refresh failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  try {
    await reconcileObservationSources(env);
  } catch (error) {
    console.error("observation reconciliation failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  try {
    const cutoff = new Date(Date.now() - WEBHOOK_DELIVERY_RETENTION_MS).toISOString();
    await pruneWebhookDeliveries(env, cutoff);
  } catch (error) {
    console.error("webhook delivery pruning failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  try {
    const cutoff = new Date(Date.now() - CLOUDFLARE_EVENT_RETENTION_MS).toISOString();
    await pruneCloudflareEvents(env, cutoff);
  } catch (error) {
    console.error("cloudflare event pruning failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export default {
  async fetch(request: Request, env: Env, context: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/webhook") {
      return json(
        { error: "legacy webhook endpoint removed", endpoint: "/webhooks/github" },
        410,
        { "Cache-Control": "no-store" },
      );
    }

    if (url.pathname === "/webhooks/github") {
      try {
        return await handleGitHubWebhook(request, env);
      } catch (error) {
        console.error("github webhook failed", {
          error: error instanceof Error ? error.message : String(error),
        });
        return json({ error: "webhook processing failed" }, 500, { "Cache-Control": "no-store" });
      }
    }

    if (url.pathname === "/webhooks/cloudflare/notifications") {
      try {
        return await handleCloudflareNotificationsWebhook(request, env);
      } catch (error) {
        console.error("cloudflare notifications webhook failed", {
          error: error instanceof Error ? error.message : String(error),
        });
        return json({ error: "webhook processing failed" }, 500, { "Cache-Control": "no-store" });
      }
    }

    if (url.pathname === "/webhooks/cloudflare/casb") {
      try {
        return await handleCloudflareCasbWebhook(request, env);
      } catch (error) {
        console.error("cloudflare casb webhook failed", {
          error: error instanceof Error ? error.message : String(error),
        });
        return json({ error: "webhook processing failed" }, 500, { "Cache-Control": "no-store" });
      }
    }

    if (url.pathname === "/login") {
      return loginPage(request, authConfigured(env));
    }

    if (url.pathname === "/auth/github") {
      if (request.method !== "GET") return json({ error: "method not allowed" }, 405, { Allow: "GET" });
      return startGitHubLogin(env);
    }

    if (url.pathname === "/auth/github/callback") {
      if (request.method !== "GET") return json({ error: "method not allowed" }, 405, { Allow: "GET" });
      return handleGitHubCallback(request, env);
    }

    if (url.pathname === "/auth/logout") {
      if (request.method !== "GET") return json({ error: "method not allowed" }, 405, { Allow: "GET" });
      return logout();
    }

    const isApi = url.pathname.startsWith("/api/");
    let apiConsumer: ReadConsumer | null = null;

    if (isApi) {
      if (request.method !== "GET") {
        return json({ error: "method not allowed" }, 405, {
          Allow: "GET",
          "Cache-Control": "no-store",
        });
      }
      const access = await authorizeReadRequest(request, env);
      if (!access.authorized) {
        return json({ error: "authentication required" }, 401, { "Cache-Control": "no-store" });
      }
      apiConsumer = access.consumer;
    } else {
      if (!configured(env)) return redirectToLogin();
      const userId = await authenticatedUserId(request, env);
      if (!userId) return redirectToLogin();
    }

    try {
      if (isApi && apiConsumer) {
        const observationResponse = await handleObservationApi(
          request,
          env,
          context,
          apiConsumer,
        );
        if (observationResponse) return observationResponse;

        return json({ error: "not found" }, 404, { "Cache-Control": "no-store" });
      }
      const assetResponse = await env.ASSETS.fetch(request);
      const headers = new Headers(assetResponse.headers);
      headers.set("Cache-Control", "private, no-store");
      headers.set("Referrer-Policy", "no-referrer");
      headers.set("X-Content-Type-Options", "nosniff");
      headers.set("X-Frame-Options", "DENY");
      headers.set(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
      );
      return new Response(assetResponse.body, {
        status: assetResponse.status,
        statusText: assetResponse.statusText,
        headers,
      });
    } catch (error) {
      if (error instanceof CloudflareApiError) {
        console.error("cloudflare api request failed", {
          status: error.status,
          error: error.message,
        });
        const status = error.status === 503 ? 503 : 502;
        return json(
          { error: status === 503 ? "cloudflare integration not configured" : "cloudflare upstream request failed" },
          status,
          { "Cache-Control": "no-store" },
        );
      }
      if (error instanceof GitHubApiError && (error.status === 404 || error.status === 403)) {
        return json(
          { error: error.status === 404 ? "repository not found" : "repository access denied" },
          error.status,
          { "Cache-Control": "no-store" },
        );
      }
      console.error("dashboard request failed", {
        path: url.pathname,
        error: error instanceof Error ? error.message : String(error),
      });
      return json({ error: "upstream data fetch failed" }, 502, { "Cache-Control": "no-store" });
    }
  },

  async scheduled(controller: ScheduledController, env: Env, context: ExecutionContext): Promise<void> {
    context.waitUntil(reportRuntimeHeartbeat(env));

    if (controller.cron === "*/15 * * * *") {
      context.waitUntil(scheduledCapabilityRefresh(env));
    }

    if (controller.cron === "0 */6 * * *") {
      context.waitUntil(scheduledRefresh(env, context));
    }
  },
};
