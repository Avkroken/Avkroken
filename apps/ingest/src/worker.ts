import type { IngressMessageV1 } from "../../../packages/observability-contracts/src/index.ts";
import { secureEqual, verifyGitHubSignature } from "./crypto.ts";
import {
  githubOwner,
  hasCloudflareIssueIdentity,
  isGenericCloudflareWebhookTest,
  isRetiredGitHubAppWebhook,
  parseObjectJson,
  reduceCloudflareWebhook,
  reduceGitHubWebhook,
} from "./reducers.ts";
import { enqueueIngressMessage } from "./handoff.ts";
import { recordIngestOutcome, type IngestMetricOutcome, type IngestMetricSource } from "./metrics.ts";
import type { IngestEnv } from "./types.ts";

export const CASB_AUTH_HEADER = "x-skvallerbyttan-casb-auth";

type IngestResponse = { response: Response; outcome: IngestMetricOutcome };

function json(
  value: unknown,
  status: number,
  extraHeaders: HeadersInit = {},
  outcome?: IngestMetricOutcome,
): IngestResponse {
  const outcomes: Record<number, IngestMetricOutcome> = {
    202: "ignored",
    400: "invalid",
    401: "unauthorized",
    404: "not_found",
    405: "method_not_allowed",
    503: "unavailable",
  };
  const response = new Response(JSON.stringify(value), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...extraHeaders,
    },
  });
  return { response, outcome: outcome ?? outcomes[status] ?? "error" };
}

function methodNotAllowed(): IngestResponse {
  return json({ error: "method not allowed" }, 405, { Allow: "POST" });
}

async function handoff(env: IngestEnv, message: IngressMessageV1): Promise<IngestResponse> {
  if (!env.EVENTS_QUEUE) return json({ error: "event handoff not configured" }, 503);
  try {
    await enqueueIngressMessage(env, message);
    return json({ ok: true, accepted: true, messageId: message.messageId }, 202, {}, "accepted");
  } catch {
    return json({ error: "event handoff unavailable" }, 503);
  }
}

async function github(request: Request, env: IngestEnv): Promise<IngestResponse> {
  if (request.method !== "POST") return methodNotAllowed();
  const secret = env.SKVALLERBYTTAN_WEBHOOK_SECRET?.trim() || "";
  if (!secret) return json({ error: "webhook not configured" }, 503);

  const body = await request.text();
  const event = request.headers.get("x-github-event")?.trim() || "";
  const deliveryId = request.headers.get("x-github-delivery")?.trim() || "";
  const hookTargetType = request.headers.get("x-github-hook-installation-target-type")?.trim() || "";

  if (isRetiredGitHubAppWebhook(hookTargetType, body)) {
    return json({ ok: true, ignored: "retired github app webhook" }, 202);
  }
  if (!(await verifyGitHubSignature(body, request.headers.get("x-hub-signature-256"), secret))) {
    return json({ error: "invalid webhook signature" }, 401);
  }
  if (!event || !deliveryId) return json({ error: "missing webhook headers" }, 400);
  if (!env.EVENTS_QUEUE) return json({ error: "event handoff not configured" }, 503);

  const payload = parseObjectJson(body);
  if (!payload) return json({ error: "invalid webhook payload" }, 400);

  const owner = githubOwner(payload);
  const expectedOwner = env.SKVALLERBYTTAN_GITHUB_OWNER?.trim() || "Avkroken";
  if (owner && owner.toLowerCase() !== expectedOwner.toLowerCase()) {
    return json({ ok: true, ignored: "different owner" }, 202);
  }

  return handoff(env, reduceGitHubWebhook({ deliveryId, event, payload }));
}

async function cloudflare(
  request: Request,
  env: IngestEnv,
  source: "notifications" | "issues" | "casb",
): Promise<IngestResponse> {
  if (request.method !== "POST") return methodNotAllowed();
  const secret = source === "casb"
    ? env.CLOUDFLARE_CASB_WEBHOOK_SECRET?.trim() || ""
    : env.CLOUDFLARE_NOTIFICATIONS_WEBHOOK_SECRET?.trim() || "";
  if (!secret || !env.EVENTS_QUEUE) return json({ error: "webhook not configured" }, 503);
  const header = source === "casb" ? CASB_AUTH_HEADER : "cf-webhook-auth";
  if (!secureEqual(request.headers.get(header), secret)) {
    return json({ error: "invalid webhook authentication" }, 401);
  }

  const body = await request.text();
  const payload = parseObjectJson(body);
  if (!payload) return json({ error: "invalid webhook payload" }, 400);
  if (source === "issues" && isGenericCloudflareWebhookTest(payload)) {
    return json({ ok: true, ignored: true, reason: "generic_webhook_test" }, 202);
  }
  if (source === "issues" && !hasCloudflareIssueIdentity(payload)) {
    return json({ error: "invalid issue webhook payload" }, 400);
  }

  return handoff(env, await reduceCloudflareWebhook({ source, payload, body }));
}

export async function handleIngestRequest(request: Request, env: IngestEnv): Promise<Response> {
  const startedAt = performance.now();
  const path = new URL(request.url).pathname;
  const source: IngestMetricSource = path === "/github" ? "github"
    : path === "/cloudflare/notifications" ? "notifications"
    : path === "/cloudflare/issues" ? "issues"
    : path === "/cloudflare/casb" ? "casb"
    : "unknown";
  try {
    const result = source === "github" ? await github(request, env)
      : source === "unknown" ? json({ error: "not found" }, 404)
      : await cloudflare(request, env, source);
    recordIngestOutcome(env, "http", source, result.outcome, startedAt);
    return result.response;
  } catch (error) {
    recordIngestOutcome(env, "http", source, "error", startedAt);
    throw error;
  }
}

export default {
  fetch: handleIngestRequest,
};
