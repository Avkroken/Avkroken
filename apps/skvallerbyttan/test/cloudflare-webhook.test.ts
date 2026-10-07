import assert from "node:assert/strict";
import test from "node:test";
import type { VerifiedShadowDeliveryV1 } from "../../../packages/observability-contracts/src/index.ts";
import type { Env } from "../src/env";
import { recordCloudflareWebhookObservation } from "../src/cloudflare-events";
import {
  casbEventFromPayload,
  handleCloudflareIssuesWebhook,
  issuesEventFromPayload,
  notificationEventFromPayload,
  secureEqual,
} from "../src/cloudflare-webhook";

test("compares webhook secrets without accepting length or value mismatches", () => {
  assert.equal(secureEqual("same-secret", "same-secret"), true);
  assert.equal(secureEqual("same-secret", "same-secreu"), false);
  assert.equal(secureEqual("short", "longer"), false);
  assert.equal(secureEqual(null, "secret"), false);
});

test("normalizes Cloudflare Notifications without persisting alert body or arbitrary data", () => {
  const event = notificationEventFromPayload({
    account_id: "account",
    policy_id: "policy",
    policy_name: "Origin errors",
    alert_type: "http_alert_origin_error",
    alert_correlation_id: "correlation",
    alert_event: "ALERT_STATE_EVENT_START",
    ts: 1_700_000_000,
    text: "sensitive rendered description",
    data: { secret: "must-not-be-copied" },
  }, "delivery", "2026-09-19T05:00:00.000Z");

  assert.deepEqual(event, {
    deliveryId: "delivery",
    source: "notifications",
    eventType: "http_alert_origin_error",
    eventId: "correlation",
    state: "ALERT_STATE_EVENT_START",
    accountId: "account",
    policyId: "policy",
    summary: "Origin errors",
    occurredAt: "2023-11-14T22:13:20.000Z",
    receivedAt: "2026-09-19T05:00:00.000Z",
  });
  assert.equal("data" in event, false);
  assert.equal("text" in event, false);
});

test("normalizes Workers Issues without retaining diagnostic context", () => {
  const event = issuesEventFromPayload({
    account_id: "account",
    policy_id: "policy",
    policy_name: "must-not-be-copied",
    name: "must-not-be-copied",
    alert_type: "workers_issue",
    alert_correlation_id: "correlation",
    alert_event: "ALERT_STATE_EVENT_START",
    ts: 1_700_000_000,
    text: "secret-bearing error text",
    data: {
      error: "sensitive exception",
      stack: "sensitive stack",
      request: { authorization: "sensitive-request-header" },
      logs: ["sensitive log"],
      worker: { name: "spam-filter" },
    },
  }, "delivery", "2026-09-19T05:00:00.000Z");

  assert.deepEqual(event, {
    deliveryId: "delivery",
    source: "issues",
    eventType: "workers_issue",
    eventId: "correlation",
    state: "ALERT_STATE_EVENT_START",
    accountId: "account",
    policyId: "policy",
    summary: null,
    occurredAt: "2023-11-14T22:13:20.000Z",
    receivedAt: "2026-09-19T05:00:00.000Z",
  });
  const serialized = JSON.stringify(event);
  for (const forbidden of ["secret-bearing", "sensitive", "sensitive-request-header", "spam-filter"]) {
    assert.equal(serialized.includes(forbidden), false);
  }
});

test("Workers Issues webhook rejects unauthenticated requests before parsing diagnostic payloads", async () => {
  const response = await handleCloudflareIssuesWebhook(
    new Request("https://skvallerbyttan.denied.se/webhooks/cloudflare/issues", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{ not-json-but-sensitive }",
    }),
    {
      CLOUDFLARE_NOTIFICATIONS_WEBHOOK_SECRET: "expected-secret",
      STATS_DB: {} as D1Database,
    } as Env,
  );

  assert.equal(response.status, 401);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), { error: "invalid webhook authentication" });
});

test("Workers Issues webhook acknowledges Cloudflare generic destination tests without recording activity", async () => {
  const response = await handleCloudflareIssuesWebhook(
    new Request("https://skvallerbyttan.denied.se/webhooks/cloudflare/issues", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "cf-webhook-auth": "expected-secret",
      },
      body: JSON.stringify({ text: "Cloudflare webhook test" }),
    }),
    {
      CLOUDFLARE_NOTIFICATIONS_WEBHOOK_SECRET: "expected-secret",
      STATS_DB: {} as D1Database,
    } as Env,
  );

  assert.equal(response.status, 202);
  assert.deepEqual(await response.json(), {
    ok: true,
    ignored: true,
    reason: "generic_webhook_test",
  });
});

test("Workers Issues webhook rejects authenticated non-test payloads without issue identity", async () => {
  const response = await handleCloudflareIssuesWebhook(
    new Request("https://skvallerbyttan.denied.se/webhooks/cloudflare/issues", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "cf-webhook-auth": "expected-secret",
      },
      body: JSON.stringify({ alert_type: "workers_issue" }),
    }),
    {
      CLOUDFLARE_NOTIFICATIONS_WEBHOOK_SECRET: "expected-secret",
      STATS_DB: {} as D1Database,
    } as Env,
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "invalid issue webhook payload" });
});

test("Cloudflare webhook deduplication and canonical event writes share one D1 batch", async () => {
  class Statement {
    params: unknown[] = [];
    constructor(readonly sql: string) {}
    bind(...params: unknown[]) {
      this.params = params;
      return this;
    }
  }

  const batches: Statement[][] = [];
  const db = {
    prepare(sql: string) {
      return new Statement(sql);
    },
    async batch(statements: Statement[]) {
      batches.push(statements);
      return statements.map(() => ({ meta: { changes: 1 } }));
    },
  } as unknown as D1Database;

  const event = {
    deliveryId: "delivery",
    source: "issues" as const,
    eventType: "workers_issue",
    eventId: "issue",
    state: "ALERT_STATE_EVENT_START",
    accountId: "account",
    policyId: "policy",
    summary: null,
    occurredAt: "2026-10-03T16:00:00.000Z",
    receivedAt: "2026-10-03T16:00:01.000Z",
  };
  const activity = {
    eventKey: "cloudflare:delivery:cloudflare.avkroken.workers",
    provider: "cloudflare" as const,
    capability: "cloudflare.avkroken.workers",
    source: "webhook" as const,
    coverage: "since_first_observation" as const,
    event: "workers_issue",
    action: "ALERT_STATE_EVENT_START",
    resourceType: "issues",
    resourceId: "issue",
    repository: null,
    occurredAt: event.occurredAt,
    receivedAt: event.receivedAt,
  };

  assert.equal(
    await recordCloudflareWebhookObservation({ STATS_DB: db } as Env, event, activity),
    true,
  );
  assert.equal(batches.length, 1);
  assert.equal(batches[0].length, 3);
  assert.ok(/webhook_deliveries/.test(batches[0][0].sql));
  assert.ok(/cloudflare_events/.test(batches[0][1].sql));
  assert.ok(/observation_events/.test(batches[0][2].sql));
});

test("Cloudflare webhook newness follows canonical Activity insert, not side-table repair", async () => {
  class Statement {
    constructor(readonly sql: string) {}
    bind() { return this; }
  }
  const db = {
    prepare(sql: string) { return new Statement(sql); },
    async batch() {
      return [
        { meta: { changes: 1 } },
        { meta: { changes: 1 } },
        { meta: { changes: 0 } },
      ];
    },
  } as unknown as D1Database;
  const event = {
    deliveryId: "repair",
    source: "issues" as const,
    eventType: "workers_issue",
    eventId: "issue",
    state: "START",
    accountId: "account",
    policyId: "policy",
    summary: null,
    occurredAt: null,
    receivedAt: "2026-10-07T12:00:00.000Z",
  };
  const activity = {
    eventKey: "cloudflare:repair:cloudflare.avkroken.workers",
    provider: "cloudflare" as const,
    capability: "cloudflare.avkroken.workers",
    source: "webhook" as const,
    coverage: "since_first_observation" as const,
    event: "workers_issue",
    action: "START",
    resourceType: "issues",
    resourceId: "issue",
    repository: null,
    occurredAt: null,
    receivedAt: event.receivedAt,
  };
  assert.equal(
    await recordCloudflareWebhookObservation({ STATS_DB: db } as Env, event, activity),
    false,
  );
});

test("Cloudflare shadow failure remains fail-soft and does not log diagnostic body", async () => {
  class Statement {
    params: unknown[] = [];
    constructor(readonly sql: string) {}
    bind(...params: unknown[]) { this.params = params; return this; }
  }
  const batches: Statement[][] = [];
  const db = {
    prepare(sql: string) { return new Statement(sql); },
    async batch(statements: Statement[]) {
      batches.push(statements);
      return statements.map(() => ({ meta: { changes: 1 } }));
    },
  } as unknown as D1Database;
  const body = JSON.stringify({
    account_id: "account",
    policy_id: "policy",
    alert_type: "workers_issue",
    alert_correlation_id: "correlation",
    alert_event: "ALERT_STATE_EVENT_START",
    ts: 1_700_000_000,
    text: "raw-sensitive-cloudflare-body",
    data: { stack: "sensitive-stack" },
  });
  const deliveries: unknown[] = [];
  const tasks: Promise<unknown>[] = [];
  const context = {
    waitUntil(task: Promise<unknown>) { tasks.push(task); },
  } as unknown as ExecutionContext;
  const errors: unknown[][] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => { errors.push(args); };
  try {
    const response = await handleCloudflareIssuesWebhook(
      new Request("https://skvallerbyttan.denied.se/webhooks/cloudflare/issues", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "cf-webhook-auth": "expected-secret",
        },
        body,
      }),
      {
        CLOUDFLARE_NOTIFICATIONS_WEBHOOK_SECRET: "expected-secret",
        STATS_DB: db,
        AVKROKEN_INGEST_SHADOW: {
          async acceptVerifiedDelivery(delivery: VerifiedShadowDeliveryV1) {
            deliveries.push(delivery);
            throw new Error("raw-sensitive-cloudflare-body");
          },
        },
      } as unknown as Env,
      context,
    );
    assert.equal(response.status, 202);
    assert.deepEqual(await response.json(), {
      ok: true,
      source: "issues",
      eventType: "workers_issue",
    });
    await Promise.all(tasks);
  } finally {
    console.error = originalError;
  }
  assert.equal(deliveries.length, 1);
  const mirrored = deliveries[0] as { receivedAt: string; body: string; deliveryId: string };
  assert.equal(mirrored.body, body);
  assert.equal(/^cloudflare-issues:/.test(mirrored.deliveryId), true);
  const activityStatement = batches[0][2];
  assert.equal(activityStatement.params.at(-1), mirrored.receivedAt);
  assert.equal(JSON.stringify(errors).includes("raw-sensitive-cloudflare-body"), false);
});

test("normalizes CASB findings to top-level identifiers only", () => {
  const event = casbEventFromPayload({
    id: "finding-id",
    type: "posture_finding",
    metadata: { actor: "sensitive" },
    data: { asset: "sensitive" },
  }, "delivery", "2026-09-19T05:00:00.000Z");

  assert.deepEqual(event, {
    deliveryId: "delivery",
    source: "casb",
    eventType: "posture_finding",
    eventId: "finding-id",
    state: null,
    accountId: null,
    policyId: null,
    summary: null,
    occurredAt: null,
    receivedAt: "2026-09-19T05:00:00.000Z",
  });
});
