import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function read(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

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
