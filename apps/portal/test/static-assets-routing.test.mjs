import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const configUrl = new URL("../wrangler.jsonc", import.meta.url);

function matches(pattern, path) {
  const escaped = pattern
    .replace(/[.+?^$\\{\\}()|[\\]\\\\]/g, "\\$&")
    .replaceAll("*", ".*");
  return new RegExp("^" + escaped + "$").test(path);
}

test("browser navigation routes run the Worker before static 404 handling", async () => {
  const config = JSON.parse(await readFile(configUrl, "utf8"));
  const patterns = config.assets?.run_worker_first;

  assert.ok(Array.isArray(patterns), "run_worker_first must use selective route patterns");
  assert.equal(config.assets.not_found_handling, "404-page");

  for (const path of [
    "/dokumentation",
    "/dokumentation/docs/architecture.md",
    "/projekt",
    "/projekt/Avkroken/dokumentation",
    "/tjanster",
    "/auth/jobb",
    "/drift/github",
    "/changelog",
    "/aktivitet",
    "/om",
    "/sok",
    "/api/docs",
    "/admin/logos",
    "/media/logos/logo.svg"
  ]) {
    assert.ok(patterns.some(pattern => matches(pattern, path)), path);
  }

  assert.equal(patterns.some(pattern => matches(pattern, "/missing.css")), false);
  assert.equal(patterns.some(pattern => matches(pattern, "/not-a-portal-route")), false);
});