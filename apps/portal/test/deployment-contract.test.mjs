import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function readWranglerConfig() {
  const raw = await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8");
  return JSON.parse(raw);
}

test("portal deploy targets the canonical avkroken Worker", async () => {
  const config = await readWranglerConfig();
  assert.equal(config.name, "avkroken");
});
