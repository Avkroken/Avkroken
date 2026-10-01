import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const worker = await readFile(new URL("../src/index.js", import.meta.url), "utf8");

test("distribution API is project-gated and never accepts a caller supplied origin", () => {
  assert.ok(worker.includes('url.pathname === "/api/distribution"'));
  assert.ok(worker.includes("getPublicDistribution(url, env, ctx)"));
  assert.ok(worker.includes("getPublicProjects(env, ctx)"));
  assert.ok(worker.includes("distributionEndpoints(project)"));
  assert.ok(worker.includes('requestUrl.searchParams.get("project")'));
  assert.equal(worker.includes('requestUrl.searchParams.get("url")'), false);
});

test("distribution API validates both manifest and service worker with bounded reads", () => {
  assert.ok(worker.includes("DISTRIBUTION_MANIFEST_MAX_BYTES"));
  assert.ok(worker.includes("DISTRIBUTION_SERVICE_WORKER_MAX_BYTES"));
  assert.ok(worker.includes("DISTRIBUTION_MANIFEST_TYPES"));
  assert.ok(worker.includes("DISTRIBUTION_SERVICE_WORKER_TYPES"));
  assert.ok(worker.includes('["application/manifest+json", "application/json"]'));
  assert.ok(worker.includes('["application/javascript", "text/javascript", "application/x-javascript"]'));
  assert.ok(worker.includes("normalizeInstallableManifest(manifest, endpoints.origin)"));
  assert.ok(worker.includes('coverage: "live_manifest_and_service_worker"'));
  assert.ok(worker.includes('"Cloudflare-CDN-Cache-Control": "public, max-age=60"'));
});
