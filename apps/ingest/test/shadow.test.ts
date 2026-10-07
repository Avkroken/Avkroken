import assert from "node:assert/strict";
import test from "node:test";
import type { IngressMessageV1 } from "../../../packages/observability-contracts/src/index.ts";
import {
  MAX_VERIFIED_SHADOW_BODY_BYTES,
  InvalidVerifiedShadowDeliveryError,
  acceptVerifiedShadowDelivery,
  normalizeVerifiedShadowDelivery,
} from "../src/shadow.ts";
import type { IngestEnv, QueueProducerLike } from "../src/types.ts";

class QueueCapture implements QueueProducerLike<IngressMessageV1> {
  readonly messages: IngressMessageV1[] = [];
  async send(message: IngressMessageV1): Promise<void> {
    this.messages.push(message);
  }
}

test("preverified GitHub shadow preserves identity and receivedAt without provider secrets", async () => {
  const queue = new QueueCapture();
  const env: IngestEnv = {
    EVENTS_QUEUE: queue,
    SKVALLERBYTTAN_GITHUB_OWNER: "Avkroken",
  };
  const body = JSON.stringify({
    action: "created",
    organization: { login: "Avkroken" },
    repository: { name: "Avkroken", owner: { login: "Avkroken" } },
    sender: { id: 7, login: "octocat", type: "User" },
    alert: {
      number: 9,
      secret_type: "github_personal_access_token",
      secret: "raw-secret-must-not-be-queued",
    },
  });

  const result = await acceptVerifiedShadowDelivery(env, {
    schemaVersion: 1,
    kind: "github",
    deliveryId: "delivery-shadow-1",
    event: "secret_scanning_alert",
    receivedAt: "2026-10-07T12:00:00.000Z",
    body,
  });

  assert.equal(result.accepted, true);
  assert.equal(result.idempotencyKey, "github:delivery-shadow-1");
  assert.equal(queue.messages.length, 1);
  const message = queue.messages[0];
  assert.equal(message.receivedAt, "2026-10-07T12:00:00.000Z");
  assert.equal(message.idempotencyKey, "github:delivery-shadow-1");
  assert.equal(message.metadata.securitySubject, "github_personal_access_token");
  assert.equal(JSON.stringify(message).includes("raw-secret-must-not-be-queued"), false);
});

test("preverified Cloudflare shadow preserves canonical delivery ID and strips diagnostic body", async () => {
  const queue = new QueueCapture();
  const body = JSON.stringify({
    account_id: "account",
    policy_id: "policy",
    alert_type: "workers_issue",
    alert_correlation_id: "correlation",
    alert_event: "ALERT_STATE_EVENT_START",
    ts: 1_700_000_000,
    text: "sensitive diagnostic text",
    data: { stack: "secret stack", request: { authorization: "Bearer secret" } },
  });

  const result = await acceptVerifiedShadowDelivery({ EVENTS_QUEUE: queue }, {
    schemaVersion: 1,
    kind: "cloudflare",
    source: "issues",
    deliveryId: "cloudflare-issues:canonical-delivery",
    receivedAt: "2026-10-07T12:01:00.000Z",
    body,
  });

  assert.equal(result.idempotencyKey, "cloudflare-issues:canonical-delivery");
  const message = queue.messages[0];
  assert.equal(message.receivedAt, "2026-10-07T12:01:00.000Z");
  assert.equal(message.idempotencyKey, "cloudflare-issues:canonical-delivery");
  const serialized = JSON.stringify(message);
  for (const forbidden of ["sensitive diagnostic text", "secret stack", "Bearer secret"]) {
    assert.equal(serialized.includes(forbidden), false);
  }
});

test("verified shadow validation fails closed before queue handoff", async () => {
  const queue = new QueueCapture();
  const base = {
    schemaVersion: 1,
    kind: "github",
    deliveryId: "delivery",
    event: "push",
    receivedAt: "2026-10-07T12:00:00.000Z",
    body: JSON.stringify({
      organization: { login: "Avkroken" },
      repository: { name: "Avkroken", owner: { login: "Avkroken" } },
    }),
  } as const;

  await assert.rejects(
    () => acceptVerifiedShadowDelivery({ EVENTS_QUEUE: queue }, { ...base, receivedAt: "not-a-time" }),
    InvalidVerifiedShadowDeliveryError,
  );
  await assert.rejects(
    () => acceptVerifiedShadowDelivery(
      { EVENTS_QUEUE: queue, SKVALLERBYTTAN_GITHUB_OWNER: "Avkroken" },
      { ...base, body: JSON.stringify({ organization: { login: "SomeoneElse" } }) },
    ),
    InvalidVerifiedShadowDeliveryError,
  );
  assert.throws(
    () => normalizeVerifiedShadowDelivery({ ...base, body: "x".repeat(MAX_VERIFIED_SHADOW_BODY_BYTES + 1) }),
    (error: unknown) => error instanceof InvalidVerifiedShadowDeliveryError && error.field === "body.size",
  );
  assert.throws(
    () => normalizeVerifiedShadowDelivery({
      schemaVersion: 1,
      kind: "cloudflare",
      source: "issues",
      deliveryId: "cloudflare-notifications:wrong-source",
      receivedAt: "2026-10-07T12:00:00.000Z",
      body: JSON.stringify({
        alert_correlation_id: "id",
        alert_event: "START",
      }),
    }),
    (error: unknown) => error instanceof InvalidVerifiedShadowDeliveryError && error.field === "deliveryId.source",
  );
  assert.throws(
    () => normalizeVerifiedShadowDelivery({
      ...base,
      authorization: "Bearer must-not-cross-shadow-boundary",
    }),
    (error: unknown) => error instanceof InvalidVerifiedShadowDeliveryError && error.field === "delivery.authorization",
  );
  assert.equal(queue.messages.length, 0);
});

test("verified shadow requires durable Queue handoff but no provider credential", async () => {
  const delivery = {
    schemaVersion: 1,
    kind: "cloudflare",
    source: "notifications",
    deliveryId: "cloudflare-notifications:id",
    receivedAt: "2026-10-07T12:00:00.000Z",
    body: JSON.stringify({
      alert_type: "test",
      alert_correlation_id: "id",
      alert_event: "START",
    }),
  } as const;

  await assert.rejects(
    () => acceptVerifiedShadowDelivery({}, delivery),
    /event handoff unavailable/,
  );
});
