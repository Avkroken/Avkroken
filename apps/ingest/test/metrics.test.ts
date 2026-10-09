import assert from "node:assert/strict";
import test from "node:test";
import type { IngressMessageV1 } from "../../../packages/observability-contracts/src/index.ts";
import { EventHandoffUnavailableError } from "../src/handoff.ts";
import { acceptVerifiedShadowDelivery, InvalidVerifiedShadowDeliveryError } from "../src/shadow.ts";
import type { IngestEnv } from "../src/types.ts";
import { handleIngestRequest } from "../src/worker.ts";

type MetricPoint = Parameters<NonNullable<IngestEnv["INGEST_METRICS"]>["writeDataPoint"]>[0];

function capture() {
  const points: MetricPoint[] = [];
  const messages: IngressMessageV1[] = [];
  const env: IngestEnv = {
    EVENTS_QUEUE: { async send(message) { messages.push(message); } },
    INGEST_METRICS: { writeDataPoint(point) { points.push(point); } },
    SKVALLERBYTTAN_WEBHOOK_SECRET: "github-test-secret",
    CLOUDFLARE_NOTIFICATIONS_WEBHOOK_SECRET: "cf-test-secret",
    CLOUDFLARE_CASB_WEBHOOK_SECRET: "casb-test-secret",
  };
  return { env, points, messages };
}

function assertPoint(points: MetricPoint[], blobs: string[]) {
  assert.equal(points.length, 1);
  assert.deepEqual(points[0].indexes, ["ingest-v1"]);
  assert.deepEqual(points[0].blobs, blobs);
  assert.equal(points[0].doubles.length, 2);
  assert.equal(points[0].doubles[0], 1);
  assert.ok(Number.isFinite(points[0].doubles[1]));
  assert.ok(points[0].doubles[1] >= 0);
}

const payload = {
  alert_type: "workers_issue",
  alert_correlation_id: "private-correlation",
  alert_event: "START",
  text: "private-diagnostic",
  data: { authorization: "private-credential" },
};

function request(path = "/cloudflare/issues", body = JSON.stringify(payload)) {
  return new Request(`https://ingest.invalid${path}?token=private-query`, {
    method: "POST",
    headers: { "cf-webhook-auth": "cf-test-secret", "x-skvallerbyttan-casb-auth": "casb-test-secret" },
    body,
  });
}

const shadow = {
  schemaVersion: 1,
  kind: "cloudflare",
  source: "issues",
  deliveryId: "cloudflare-issues:private-delivery",
  receivedAt: "2026-10-09T10:00:00.000Z",
  body: JSON.stringify(payload),
} as const;

test("all Cloudflare HTTP routes emit one bounded outcome without request data", async () => {
  for (const source of ["notifications", "issues", "casb"]) {
    const { env, points, messages } = capture();
    assert.equal((await handleIngestRequest(request(`/cloudflare/${source}`), env)).status, 202);
    assert.equal(messages.length, 1);
    assertPoint(points, ["http", source, "accepted"]);
    assert.equal(JSON.stringify(points).includes("private"), false);
    assert.equal(JSON.stringify(points).includes("test-secret"), false);
  }
});

test("HTTP metrics distinguish ignored callbacks from queued messages", async () => {
  const { env, points, messages } = capture();
  assert.equal((await handleIngestRequest(request("/cloudflare/issues", '{"text":"destination test"}'), env)).status, 202);
  assert.equal(messages.length, 0);
  assertPoint(points, ["http", "issues", "ignored"]);
});

test("HTTP rejections emit only fixed categories", async () => {
  const cases = [
    { request: new Request("https://ingest.invalid/github", { method: "POST", body: "private-body" }), source: "github", status: 401, outcome: "unauthorized" },
    { request: new Request("https://ingest.invalid/cloudflare/issues", { method: "POST", body: "private-body" }), source: "issues", status: 401, outcome: "unauthorized" },
    { request: request("/cloudflare/issues", "invalid private-json"), source: "issues", status: 400, outcome: "invalid" },
    { request: new Request("https://ingest.invalid/github"), source: "github", status: 405, outcome: "method_not_allowed" },
    { request: request("/private-path"), source: "unknown", status: 404, outcome: "not_found" },
  ];
  for (const item of cases) {
    const { env, points, messages } = capture();
    assert.equal((await handleIngestRequest(item.request, env)).status, item.status);
    assert.equal(messages.length, 0);
    assertPoint(points, ["http", item.source, item.outcome]);
  }
});

test("GitHub accepted metrics follow HMAC verification and Queue handoff", async () => {
  const { env, points, messages } = capture();
  const body = JSON.stringify({ repository: { name: "Avkroken", owner: { login: "Avkroken" } } });
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.SKVALLERBYTTAN_WEBHOOK_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)));
  const response = await handleIngestRequest(new Request("https://ingest.invalid/github", {
    method: "POST",
    headers: {
      "x-github-event": "push",
      "x-github-delivery": "private-delivery",
      "x-hub-signature-256": `sha256=${[...signature].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`,
    },
    body,
  }), env);
  assert.equal(response.status, 202);
  assert.equal(messages.length, 1);
  assertPoint(points, ["http", "github", "accepted"]);
});

test("acceptance metrics wait for successful durable handoff on HTTP and shadow", async () => {
  for (const surface of ["http", "shadow"] as const) {
    const { env, points } = capture();
    let release!: () => void;
    let entered!: () => void;
    const sent = new Promise<void>((resolve) => { entered = resolve; });
    const pending = new Promise<void>((resolve) => { release = resolve; });
    env.EVENTS_QUEUE = { async send() { entered(); await pending; } };
    const result = surface === "http" ? handleIngestRequest(request(), env) : acceptVerifiedShadowDelivery(env, shadow);
    await sent;
    assert.equal(points.length, 0);
    release();
    await result;
    assertPoint(points, [surface, "issues", "accepted"]);
  }
});

test("missing and failed queues record unavailability without leaking error details", async () => {
  for (const missing of [true, false]) {
    for (const surface of ["http", "shadow"] as const) {
      const { env, points } = capture();
      env.EVENTS_QUEUE = missing ? undefined : { async send() { throw new Error("private-queue-error"); } };
      if (surface === "http") {
        assert.equal((await handleIngestRequest(request(), env)).status, 503);
      } else {
        await assert.rejects(() => acceptVerifiedShadowDelivery(env, shadow), EventHandoffUnavailableError);
      }
      assertPoint(points, [surface, "issues", "unavailable"]);
    }
  }
});

test("shadow validation records fixed categories without caller-controlled error fields", async () => {
  const cases = [
    { delivery: { ...shadow, source: "private-source" }, source: "unknown" },
    { delivery: { ...shadow, "private-field": "private-value" }, source: "unknown" },
    { delivery: { ...shadow, body: "private-invalid-json" }, source: "issues" },
  ];
  for (const item of cases) {
    const { env, points, messages } = capture();
    await assert.rejects(() => acceptVerifiedShadowDelivery(env, item.delivery), InvalidVerifiedShadowDeliveryError);
    assert.equal(messages.length, 0);
    assertPoint(points, ["shadow", item.source, "invalid"]);
  }
});

test("shadow success records the validated provider source", async () => {
  const deliveries = [
    { source: "github", delivery: {
      schemaVersion: 1, kind: "github", event: "push", deliveryId: "private-delivery",
      receivedAt: shadow.receivedAt, body: shadow.body,
    } },
    ...["notifications", "issues", "casb"].map((source) => ({
      source, delivery: { ...shadow, source, deliveryId: `cloudflare-${source}:private-delivery` },
    })),
  ];
  for (const { source, delivery } of deliveries) {
    const { env, points, messages } = capture();
    assert.equal((await acceptVerifiedShadowDelivery(env, delivery)).accepted, true);
    assert.equal(messages.length, 1);
    assertPoint(points, ["shadow", source, "accepted"]);
  }
});

test("unexpected request read errors record an error outcome and preserve rejection", async () => {
  const { env, points } = capture();
  const incoming = request();
  const error = new Error("private-stream-error");
  incoming.text = async () => { throw error; };
  await assert.rejects(() => handleIngestRequest(incoming, env), (caught) => caught === error);
  assertPoint(points, ["http", "issues", "error"]);
});

test("throwing metrics cannot turn authentication or shadow validation failures into success", async () => {
  const { env, messages } = capture();
  env.INGEST_METRICS = { writeDataPoint() { throw new Error("private-metrics-error"); } };
  const response = await handleIngestRequest(new Request("https://ingest.invalid/cloudflare/issues", {
    method: "POST", body: "private-invalid-json",
  }), env);
  assert.equal(response.status, 401);
  await assert.rejects(() => acceptVerifiedShadowDelivery(env, { ...shadow, source: "private-source" }), InvalidVerifiedShadowDeliveryError);
  assert.equal(messages.length, 0);
});

test("missing or throwing metrics preserve HTTP and shadow acceptance and queue failures", async () => {
  for (const missing of [true, false]) {
    for (const failsQueue of [true, false]) {
      const { env, messages } = capture();
      env.INGEST_METRICS = missing ? undefined : { writeDataPoint() { throw new Error("private-metrics-error"); } };
      if (failsQueue) env.EVENTS_QUEUE = { async send() { throw new Error("private-queue-error"); } };
      const response = await handleIngestRequest(request(), env);
      assert.equal(response.status, failsQueue ? 503 : 202);
      if (failsQueue) {
        await assert.rejects(() => acceptVerifiedShadowDelivery(env, shadow), EventHandoffUnavailableError);
      } else {
        assert.equal((await acceptVerifiedShadowDelivery(env, shadow)).accepted, true);
      }
      assert.equal(messages.length, failsQueue ? 0 : 2);
    }
  }
});
