import assert from "node:assert/strict";
import test from "node:test";
import type { IngressMessageV1 } from "../../../packages/observability-contracts/src/index.ts";
import { reduceGitHubWebhook } from "../src/reducers.ts";
import { handleIngestRequest } from "../src/worker.ts";
import type { IngestEnv, QueueProducerLike } from "../src/types.ts";
import { verifyGitHubSignature } from "../src/crypto.ts";

class QueueCapture implements QueueProducerLike<IngressMessageV1> {
  readonly messages: IngressMessageV1[] = [];
  fail = false;
  async send(message: IngressMessageV1): Promise<void> {
    if (this.fail) throw new Error("queue unavailable");
    this.messages.push(message);
  }
}

function env(queue = new QueueCapture()): IngestEnv & { EVENTS_QUEUE: QueueCapture } {
  return {
    EVENTS_QUEUE: queue,
    SKVALLERBYTTAN_WEBHOOK_SECRET: "It's a Secret to Everybody",
    CLOUDFLARE_NOTIFICATIONS_WEBHOOK_SECRET: "cf-secret",
    CLOUDFLARE_CASB_WEBHOOK_SECRET: "casb-secret",
    SKVALLERBYTTAN_GITHUB_OWNER: "Avkroken",
  };
}

async function githubSignature(body: string, secret = "It's a Secret to Everybody"): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)));
  return `sha256=${[...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

test("preserves GitHub's documented HMAC test vector", async () => {
  assert.equal(await verifyGitHubSignature(
    "Hello, World!",
    "sha256=757107ea0eb2509fc211221cce984b8a37570b6d7586c22c46f4379c8b043e17",
    "It's a Secret to Everybody",
  ), true);
});

test("valid GitHub webhook is reduced and handed off without raw payload", async () => {
  const body = JSON.stringify({
    action: "created",
    repository: { id: 11, name: "Avkroken", owner: { login: "Avkroken" } },
    organization: { login: "Avkroken" },
    sender: { id: 42, login: "octocat", type: "User" },
    alert: {
      number: 7,
      secret_type: "github_personal_access_token",
      secret: "must-never-leave-ingest",
      resolution: null,
    },
  });
  const current = env();
  const response = await handleIngestRequest(new Request("https://ingest.invalid/github", {
    method: "POST",
    headers: {
      "x-github-event": "secret_scanning_alert",
      "x-github-delivery": "delivery-1",
      "x-hub-signature-256": await githubSignature(body),
    },
    body,
  }), current);

  assert.equal(response.status, 202);
  assert.equal(current.EVENTS_QUEUE.messages.length, 1);
  const message = current.EVENTS_QUEUE.messages[0];
  assert.equal(message.idempotencyKey, "github:delivery-1");
  assert.equal(message.capability, "github.avkroken.security");
  assert.equal(message.action, "created");
  assert.equal(message.resource?.repository, "Avkroken");
  assert.equal(message.actor?.slug, "octocat");
  assert.equal(message.metadata.alertNumber, 7);
  assert.equal(message.metadata.securitySubject, "github_personal_access_token");
  const serialized = JSON.stringify(message);
  assert.equal(serialized.includes("must-never-leave-ingest"), false);
  assert.equal(serialized.includes('"secret"'), false);
});

test("GitHub capability families preserve the canonical Skvallerbyttan mapper", () => {
  for (const event of [
    "pull_request",
    "pull_request_review",
    "pull_request_review_comment",
    "pull_request_review_thread",
    "issues",
    "issue_comment",
    "issue_dependencies",
    "related_issues",
  ]) {
    assert.equal(reduceGitHubWebhook({
      deliveryId: `delivery-${event}`,
      event,
      payload: { repository: { name: "Avkroken", owner: { login: "Avkroken" } } },
      receivedAt: "2026-10-07T09:00:00.000Z",
      messageId: `message-${event}`,
    }).capability, "github.avkroken.pull_requests");
  }

  for (const event of ["workflow_run", "workflow_job", "check_run", "check_suite", "status"]) {
    assert.equal(reduceGitHubWebhook({
      deliveryId: `delivery-${event}`,
      event,
      payload: { repository: { name: "Avkroken", owner: { login: "Avkroken" } } },
      receivedAt: "2026-10-07T09:00:00.000Z",
      messageId: `message-${event}`,
    }).capability, "github.avkroken.actions");
  }
});

test("GitHub rejects invalid signature and ignores a different owner", async () => {
  const invalid = env();
  const invalidResponse = await handleIngestRequest(new Request("https://ingest.invalid/github", {
    method: "POST",
    headers: {
      "x-github-event": "push",
      "x-github-delivery": "bad",
      "x-hub-signature-256": "sha256=00",
    },
    body: JSON.stringify({ repository: { name: "Avkroken", owner: { login: "Avkroken" } } }),
  }), invalid);
  assert.equal(invalidResponse.status, 401);
  assert.equal(invalid.EVENTS_QUEUE.messages.length, 0);

  const body = JSON.stringify({ repository: { name: "other", owner: { login: "SomeoneElse" } } });
  const different = env();
  const response = await handleIngestRequest(new Request("https://ingest.invalid/github", {
    method: "POST",
    headers: {
      "x-github-event": "push",
      "x-github-delivery": "other",
      "x-hub-signature-256": await githubSignature(body),
    },
    body,
  }), different);
  assert.equal(response.status, 202);
  assert.deepEqual(await response.json(), { ok: true, ignored: "different owner" });
  assert.equal(different.EVENTS_QUEUE.messages.length, 0);
});

test("Cloudflare Issues fails closed before parsing body when auth is missing", async () => {
  const current = env();
  const response = await handleIngestRequest(new Request("https://ingest.invalid/cloudflare/issues", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{ invalid-sensitive-json }",
  }), current);
  assert.equal(response.status, 401);
  assert.equal(current.EVENTS_QUEUE.messages.length, 0);
});

test("Cloudflare generic Issues destination test is acknowledged without handoff", async () => {
  const current = env();
  const response = await handleIngestRequest(new Request("https://ingest.invalid/cloudflare/issues", {
    method: "POST",
    headers: { "cf-webhook-auth": "cf-secret" },
    body: JSON.stringify({ text: "Cloudflare webhook test" }),
  }), current);
  assert.equal(response.status, 202);
  assert.deepEqual(await response.json(), { ok: true, ignored: true, reason: "generic_webhook_test" });
  assert.equal(current.EVENTS_QUEUE.messages.length, 0);
});

test("Cloudflare Issues strips diagnostic context before queue handoff", async () => {
  const current = env();
  const body = JSON.stringify({
    account_id: "account",
    policy_id: "policy",
    alert_type: "workers_issue",
    alert_correlation_id: "correlation",
    alert_event: "ALERT_STATE_EVENT_START",
    ts: 1_700_000_000,
    text: "secret-bearing error text",
    data: { stack: "sensitive stack", request: { authorization: "bearer secret" } },
  });
  const response = await handleIngestRequest(new Request("https://ingest.invalid/cloudflare/issues", {
    method: "POST",
    headers: { "cf-webhook-auth": "cf-secret" },
    body,
  }), current);
  assert.equal(response.status, 202);
  assert.equal(current.EVENTS_QUEUE.messages.length, 1);
  const message = current.EVENTS_QUEUE.messages[0];
  assert.equal(message.source, "cloudflare_issues");
  assert.equal(message.capability, "cloudflare.avkroken.workers");
  assert.equal(message.metadata.accountId, "account");
  assert.equal(message.metadata.policyId, "policy");
  const serialized = JSON.stringify(message);
  for (const forbidden of ["secret-bearing", "sensitive stack", "bearer secret"]) {
    assert.equal(serialized.includes(forbidden), false);
  }
});

test("Cloudflare Notifications and CASB use existing secret contracts", async () => {
  const notifications = env();
  const notificationBody = JSON.stringify({
    account_id: "account",
    policy_id: "policy",
    policy_name: "Origin errors",
    alert_type: "http_alert_origin_error",
    alert_correlation_id: "corr",
    alert_event: "ALERT_STATE_EVENT_START",
    ts: 1_700_000_000,
  });
  assert.equal((await handleIngestRequest(new Request("https://ingest.invalid/cloudflare/notifications", {
    method: "POST",
    headers: { "cf-webhook-auth": "cf-secret" },
    body: notificationBody,
  }), notifications)).status, 202);
  assert.equal(notifications.EVENTS_QUEUE.messages[0].source, "cloudflare_notifications");

  const casb = env();
  assert.equal((await handleIngestRequest(new Request("https://ingest.invalid/cloudflare/casb", {
    method: "POST",
    headers: { "x-skvallerbyttan-casb-auth": "casb-secret" },
    body: JSON.stringify({ id: "finding", type: "posture_finding", data: { sensitive: true } }),
  }), casb)).status, 202);
  assert.equal(casb.EVENTS_QUEUE.messages[0].source, "cloudflare_casb");
  assert.equal(JSON.stringify(casb.EVENTS_QUEUE.messages[0]).includes("sensitive"), false);
});

test("missing or failed durable handoff returns 503 for provider retry", async () => {
  const noQueue: IngestEnv = {
    SKVALLERBYTTAN_WEBHOOK_SECRET: "It's a Secret to Everybody",
    CLOUDFLARE_NOTIFICATIONS_WEBHOOK_SECRET: "cf-secret",
  };
  const body = JSON.stringify({ alert_type: "test", alert_correlation_id: "id", alert_event: "START" });
  const missing = await handleIngestRequest(new Request("https://ingest.invalid/cloudflare/notifications", {
    method: "POST",
    headers: { "cf-webhook-auth": "cf-secret" },
    body,
  }), noQueue);
  assert.equal(missing.status, 503);

  const queue = new QueueCapture();
  queue.fail = true;
  const failing = env(queue);
  const failed = await handleIngestRequest(new Request("https://ingest.invalid/cloudflare/notifications", {
    method: "POST",
    headers: { "cf-webhook-auth": "cf-secret" },
    body,
  }), failing);
  assert.equal(failed.status, 503);
});

test("non-POST and unknown routes fail without queue side effects", async () => {
  const current = env();
  assert.equal((await handleIngestRequest(new Request("https://ingest.invalid/github"), current)).status, 405);
  assert.equal((await handleIngestRequest(new Request("https://ingest.invalid/unknown", { method: "POST" }), current)).status, 404);
  assert.equal(current.EVENTS_QUEUE.messages.length, 0);
});
