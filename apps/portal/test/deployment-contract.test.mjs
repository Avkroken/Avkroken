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


test("portal Preview isolates Durable Object and does not bind production services", async () => {
  const config = await readWranglerConfig();
  assert.deepEqual(config.previews?.durable_objects?.bindings, [
    { name: "OPS_WATCHDOG", class_name: "OperationalWatchdog" }
  ]);
  assert.equal(config.previews?.services, undefined);
  assert.equal(config.previews?.send_email, undefined);
  assert.equal(config.previews?.vars, undefined);
});
