import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const client = await readFile(new URL("../public/activity.js", import.meta.url), "utf8");
const shell = await readFile(new URL("../public/shell.js", import.meta.url), "utf8");
const worker = await readFile(new URL("../src/index.js", import.meta.url), "utf8");

function occurrences(source, value) {
  return source.split(value).length - 1;
}

function section(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.notEqual(from, -1, start);
  assert.notEqual(to, -1, end);
  return source.slice(from, to);
}

test("Activity DOM contract is unique and wired", () => {
  for (const id of [
    "activity-view",
    "activity-breadcrumbs",
    "activity-project-link",
    "activity-title",
    "activity-description",
    "activity-status",
    "activity-generated",
    "activity-list",
    "activity-error"
  ]) {
    assert.equal(occurrences(html, `id="${id}"`), 1, id);
  }

  for (const id of [
    "activity-breadcrumbs",
    "activity-project-link",
    "activity-title",
    "activity-description",
    "activity-status",
    "activity-generated",
    "activity-list",
    "activity-error"
  ]) {
    assert.ok(client.includes(`#${id}`), id);
  }
});

test("Activity client reads only the Portal API and renders values via DOM text", () => {
  assert.ok(client.includes('fetch("/api/activity" + suffix'));
  assert.equal(client.includes("api.github.com"), false);
  assert.equal(client.includes("skvallerbyttan"), false);
  assert.equal(client.includes("Bearer "), false);
  assert.equal(client.includes("innerHTML"), false);
  assert.ok(client.includes("textContent"));
  assert.ok(client.includes('rel = "noopener noreferrer"'));
});

test("shell maps global and project Activity routes to the same view", () => {
  assert.ok(shell.includes('path === "/aktivitet"'));
  assert.ok(shell.includes('/^\\/projekt\\/[^/]+\\/aktivitet'));
  assert.ok(shell.includes('return "activity"'));
});

test("Activity backend starts from live public repositories and public organization events", () => {
  const loader = section(
    worker,
    "async function loadPublicActivity(env)",
    "let pendingPublicActivity = null"
  );

  assert.ok(loader.includes("loadLivePublicRepositoryProjects(env)"));
  assert.ok(loader.includes("eligibleActivityProjects(repositoryProjects"));
  assert.ok(loader.includes("fetchGitHubJson(GITHUB_PUBLIC_ACTIVITY_API, env)"));
  assert.ok(loader.includes("normalizePublicActivity(eligible, eventsResult.data)"));
  assert.equal(loader.includes("loadPublicProjects(env)"), false);
  assert.equal(loader.includes("SKVALLERBYTTAN_OBSERVATIONS"), false);
});

test("Activity API is no-store, bounded and uses only an in-flight collapse", () => {
  const handler = section(
    worker,
    "async function getPublicActivity(requestUrl, env)",
    "async function fetchSearchDocument(task, env)"
  );

  assert.ok(worker.includes('const ACTIVITY_PROVIDER_EVENT_LIMIT = 100;'));
  assert.ok(worker.includes('const ACTIVITY_RESULT_LIMIT = 40;'));
  assert.ok(worker.includes('url.pathname === "/api/activity"'));
  assert.ok(handler.includes('"Cache-Control": "no-store"'));
  assert.ok(handler.includes("pendingPublicActivity = loadPublicActivity(env).finally"));
  assert.ok(handler.includes('"project_activity_not_found"'));
  assert.ok(handler.includes('"activity_unavailable"'));
  assert.equal(handler.includes("caches.default"), false);
});

test("Activity source explicitly identifies non-realtime bounded coverage", () => {
  assert.ok(worker.includes('coverage: "bounded"'));
  assert.ok(worker.includes("realtime: false"));
  assert.ok(worker.includes("mixedScopeExcluded"));
});
