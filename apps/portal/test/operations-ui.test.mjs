import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const client = await readFile(new URL("../public/operations.js", import.meta.url), "utf8");
const worker = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
const wrangler = JSON.parse(
  await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8")
);

function occurrences(source, value) {
  return source.split(value).length - 1;
}

test("Drift and insight DOM contract is unique and wired", () => {
  for (const id of [
    "operations-view",
    "operations-status",
    "operations-generated",
    "operations-provider-grid",
    "operations-capability-summary",
    "operations-capabilities",
    "operations-error"
  ]) {
    assert.equal(occurrences(html, `id="${id}"`), 1, id);
  }

  for (const id of [
    "operations-status",
    "operations-generated",
    "operations-provider-grid",
    "operations-capability-summary",
    "operations-capabilities",
    "operations-error"
  ]) {
    assert.ok(client.includes(`#${id}`), id);
  }
});

test("operations client reads only the Portal API", () => {
  assert.ok(client.includes('fetch("/api/operations"'));
  assert.equal(client.includes("skvallerbyttan.denied.se"), false);
  assert.equal(client.includes("authorization"), false);
  assert.equal(client.includes("Bearer "), false);
  assert.equal(client.includes("/api/v1/"), false);
});

test("Portal operations API uses the dedicated Skvallerbyttan RPC binding", () => {
  assert.ok(worker.includes("SKVALLERBYTTAN_OBSERVATIONS"));
  assert.ok(worker.includes("getPublicOperationsSummary"));
  assert.ok(worker.includes('url.pathname === "/api/operations"'));
  assert.ok(worker.includes('"Cache-Control": "no-store"'));

  const binding = (wrangler.services || []).find(
    item => item.binding === "SKVALLERBYTTAN_OBSERVATIONS"
  );
  assert.deepEqual(binding, {
    binding: "SKVALLERBYTTAN_OBSERVATIONS",
    service: "skvallerbyttan",
    entrypoint: "PortalObservationsService"
  });
});

test("operations API exposes explicit fail-closed degraded states", () => {
  const start = worker.indexOf("async function getPublicOperations(env)");
  const end = worker.indexOf("function operationalWatchdogStub", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);

  const handler = worker.slice(start, end);

  assert.ok(handler.includes('status: "not_configured"'));
  assert.ok(handler.includes('error: "operations_not_configured"'));
  assert.ok(handler.includes("status: 503"));

  assert.ok(handler.includes('status: "error"'));
  assert.ok(handler.includes('error: "operations_unavailable"'));
  assert.ok(handler.includes("status: 502"));

  assert.ok(handler.includes('available: false'));
  assert.ok(handler.includes('"Cache-Control": "no-store"'));
  assert.ok(handler.includes('"X-Content-Type-Options": "nosniff"'));
  assert.equal(handler.includes("SKVALLERBYTTAN_READ_API_TOKEN"), false);
  assert.equal(handler.includes("/api/v1"), false);
});

test("operations client clears previously rendered observations on failure", () => {
  assert.ok(client.includes('if (payload.available !== true) throw new Error("operations unavailable")'));
  assert.ok(client.includes('status.textContent = "Otillgänglig"'));
  assert.ok(client.includes("clear(providerGrid)"));
  assert.ok(client.includes("clear(capabilitiesTarget)"));
  assert.ok(client.includes('capabilitySummary.textContent = "—"'));
  assert.ok(client.includes("errorState.hidden = false"));
});

test("operations client exposes the full Del 3 status and freshness vocabulary", () => {
  for (const [statusValue, label] of [
    ["available", "Tillgänglig"],
    ["stale", "Inaktuell"],
    ["not_observed", "Ej observerad"],
    ["not_configured", "Ej konfigurerad"],
    ["permission_denied", "Behörighet saknas"],
    ["unavailable", "Otillgänglig"],
    ["error", "Fel"],
    ["unknown", "Okänd"],
    ["not_supported", "Stöds inte"],
    ["not_exposed_by_provider", "Exponeras inte av provider"]
  ]) {
    assert.ok(client.includes(`${statusValue}: "${label}"`), statusValue);
  }

  for (const [freshnessValue, label] of [
    ["fresh", "Aktuell"],
    ["stale", "Inaktuell"],
    ["unknown", "Okänd"]
  ]) {
    assert.ok(client.includes(`${freshnessValue}: "${label}"`), freshnessValue);
  }

  assert.ok(client.includes("statusBadge(provider.status)"));
  assert.ok(client.includes("statusBadge(item.status)"));
  assert.ok(client.includes("freshnessLabel(item.freshness)"));
  assert.ok(client.includes("formatDate(item.lastSuccessAt)"));
});

