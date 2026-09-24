import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function read(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("dashboard uses only canonical v1 API routes", async () => {
  const app = await read("public/app.js");

  assert.match(app, /\/api\/v1\/overview/);
  assert.match(app, /\/api\/v1\/security-activity/);
  assert.match(app, /\/api\/v1\/repos\//);
  assert.match(app, /\/insights/);
  assert.doesNotMatch(app, /["'`]\/api\/(?!v1\/)/);
});

test("worker no longer carries the legacy dashboard API handler", async () => {
  const worker = await read("src/worker.ts");

  assert.doesNotMatch(worker, /function legacyApiCapability/);
  assert.doesNotMatch(worker, /recordLegacyApiRead/);
  assert.doesNotMatch(worker, /async function handleApi/);
  assert.doesNotMatch(worker, /\/api\/overview|\/api\/security-activity|\/api\/cloudflare\/activity|\/api\/history|\/api\/insights\/|\/api\/repos\//);
});

test("canonical observations API owns dashboard reads", async () => {
  const observations = await read("src/observations-api.ts");

  assert.match(observations, /"\/api\/v1\/overview"/);
  assert.match(observations, /"\/api\/v1\/security-activity"/);
  assert.match(observations, /const repositoryMatch = url\.pathname\.match/);
  assert.match(observations, /const repositoryInsightMatch = url\.pathname\.match/);
  assert.match(observations, /refreshOverviewSource/);
});
