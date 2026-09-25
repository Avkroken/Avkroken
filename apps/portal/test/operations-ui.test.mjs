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
    "operations-activity-total",
    "operations-activity-copy",
    "operations-capabilities",
    "operations-activity-list",
    "operations-coverage",
    "operations-error"
  ]) {
    assert.equal(occurrences(html, `id="${id}"`), 1, id);
  }

  for (const id of [
    "operations-status",
    "operations-generated",
    "operations-provider-grid",
    "operations-capability-summary",
    "operations-activity-total",
    "operations-activity-copy",
    "operations-capabilities",
    "operations-activity-list",
    "operations-coverage",
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
