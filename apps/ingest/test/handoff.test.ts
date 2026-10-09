import assert from "node:assert/strict";
import test from "node:test";
import { enqueueIngressMessage, EventHandoffUnavailableError } from "../src/handoff.ts";
import { reduceGitHubWebhook } from "../src/reducers.ts";

/** Build an attempt containing identifiers that must never become log dimensions. */
function message() {
  return reduceGitHubWebhook({
    deliveryId: "private-delivery",
    messageId: "private-message",
    event: "private-event",
    payload: { sender: { login: "private-actor" }, action: "private-action" },
  });
}

test("handoff logs only bounded outcome, source and latency after send resolves", async (t) => {
  const log = t.mock.method(console, "info", () => {});
  const current = message();
  let release!: () => void;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  const sending = enqueueIngressMessage({ EVENTS_QUEUE: { send: async (value) => {
    assert.equal(value, current);
    await pending;
  } } }, current);
  assert.equal(log.mock.callCount(), 0);
  release();
  await sending;
  assert.equal(log.mock.callCount(), 1);
  const [name, fields] = log.mock.calls[0].arguments;
  assert.equal(name, "ingest_queue_handoff");
  assert.deepEqual(Object.keys(fields).sort(), ["durationMs", "outcome", "source"]);
  assert.equal(fields.source, "github");
  assert.equal(fields.outcome, "sent");
  assert.ok(Number.isFinite(fields.durationMs) && fields.durationMs >= 0);
  assert.equal(JSON.stringify(log.mock.calls[0].arguments).includes("private-"), false);
});

test("missing and failed queue attempts log sanitized outcomes and remain retryable", async (t) => {
  const log = t.mock.method(console, "info", () => {});
  await assert.rejects(enqueueIngressMessage({}, message()), EventHandoffUnavailableError);
  await assert.rejects(enqueueIngressMessage({ EVENTS_QUEUE: { send: async () => {
    throw new Error("private-provider-error");
  } } }, message()), EventHandoffUnavailableError);
  assert.deepEqual(log.mock.calls.map((call) => call.arguments[1].outcome), ["unconfigured", "failed"]);
  assert.equal(JSON.stringify(log.mock.calls.map((call) => call.arguments)).includes("private-"), false);
});

test("telemetry failures cannot turn successful sends into retries or hide queue failures", async (t) => {
  t.mock.method(console, "info", () => { throw new Error("logger unavailable"); });
  let sends = 0;
  await enqueueIngressMessage({ EVENTS_QUEUE: { send: async () => { sends += 1; } } }, message());
  assert.equal(sends, 1);
  await assert.rejects(enqueueIngressMessage({}, message()), EventHandoffUnavailableError);
  await assert.rejects(enqueueIngressMessage({ EVENTS_QUEUE: { send: async () => {
    throw new Error("queue unavailable");
  } } }, message()), EventHandoffUnavailableError);
});

test("handoff source labels are allowlisted even for malformed runtime input", async (t) => {
  const log = t.mock.method(console, "info", () => {});
  for (const source of ["github", "cloudflare_notifications", "cloudflare_issues", "cloudflare_casb", "private-source"]) {
    await enqueueIngressMessage({ EVENTS_QUEUE: { send: async () => {} } }, { ...message(), source });
  }
  assert.deepEqual(log.mock.calls.map((call) => call.arguments[1].source), [
    "github", "cloudflare_notifications", "cloudflare_issues", "cloudflare_casb", "unknown",
  ]);
});
