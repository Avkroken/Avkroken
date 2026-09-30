import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function read(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("tracked production config cannot be sanitized into a preview-only config", async () => {
  const wrangler = JSON.parse(await read("wrangler.jsonc"));
  assert.equal(wrangler.name, "skvallerbyttan");
  assert.equal(wrangler.observability?.enabled, true);
  assert.ok(wrangler.d1_databases?.some(binding => binding.binding === "STATS_DB"));
  assert.ok(wrangler.services?.some(binding => binding.binding === "AVKROKEN_PORTAL_DOCS"));
  assert.ok(wrangler.services?.some(binding => binding.binding === "AVKROKEN_OPERATIONS"));
  assert.ok(wrangler.routes?.some(route => route.pattern === "skvallerbyttan.denied.se"));
  assert.ok(wrangler.triggers?.crons?.length > 0);
});

test("observability stays Cloudflare-only", async () => {
  const wranglerText = await read("wrangler.jsonc");
  const wrangler = JSON.parse(wranglerText);

  assert.equal(
    wrangler.observability?.redact_query_string,
    true,
    "OAuth and other query credentials must be redacted before telemetry persistence",
  );

  assert.equal(
    wrangler.observability?.logs?.head_sampling_rate,
    0.1,
    "log sampling must stay at the 10% organization cap",
  );
  assert.equal(
    wrangler.observability?.traces?.head_sampling_rate,
    0.01,
    "trace sampling must stay at the 1% organization cap",
  );

  assert.deepEqual(
    wrangler.observability?.traces?.destinations ?? [],
    [],
    "external trace destinations are forbidden in the free-first production contract",
  );
  assert.deepEqual(
    wrangler.observability?.logs?.destinations ?? [],
    [],
    "external log destinations are forbidden in the free-first production contract",
  );
});
