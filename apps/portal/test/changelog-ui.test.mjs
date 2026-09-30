import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const client = await readFile(new URL("../public/changelog.js", import.meta.url), "utf8");
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

test("Changelog DOM contract is unique and wired", () => {
  for (const id of [
    "changelog-view",
    "changelog-title",
    "changelog-status",
    "changelog-generated",
    "changelog-filter-controls",
    "changelog-list",
    "changelog-error"
  ]) {
    assert.equal(occurrences(html, `id="${id}"`), 1, id);
  }

  for (const id of [
    "changelog-status",
    "changelog-generated",
    "changelog-list",
    "changelog-error"
  ]) {
    assert.ok(client.includes(`#${id}`), id);
  }
});

test("Changelog exposes only verified release-section filters", () => {
  assert.match(html, /role="group"\s+aria-label="Filtrera Changelog"/);

  for (const filter of [
    "all",
    "features",
    "fixes",
    "security",
    "documentation",
    "releases"
  ]) {
    assert.match(html, new RegExp('data-changelog-filter="' + filter + '"'));
  }

  assert.equal(html.includes('data-changelog-filter="deployments"'), false);
  assert.ok(client.includes("release.categories"));
  assert.ok(client.includes("categories.includes(activeFilter)"));
  assert.ok(client.includes('"aria-pressed"'));
});

test("Changelog client reads only the Portal API and renders untrusted strings as text", () => {
  assert.ok(client.includes('fetch("/api/changelog"'));
  assert.equal(client.includes("api.github.com"), false);
  assert.equal(client.includes("innerHTML"), false);
  assert.ok(client.includes("textContent"));
  assert.ok(client.includes('rel = "noopener noreferrer"'));
});

test("public repository gate caches only credential-free publication checks", () => {
  const gate = section(
    worker,
    "async function loadPublicationRepositoryProjects(env)",
    "async function loadPublicProjects(env)"
  );

  assert.ok(gate.includes("githubCredentialConfigured(env)"));
  assert.ok(gate.includes("return loadLivePublicRepositoryProjects(env)"));
  assert.ok(gate.includes("cache.match(PUBLIC_REPOSITORY_GATE_CACHE_KEY)"));
  assert.ok(gate.includes("await cache.put("));
  assert.ok(gate.includes("PUBLIC_REPOSITORY_GATE_CACHE_SECONDS"));
});

test("Changelog backend derives release eligibility from the bounded public repository gate", () => {
  const load = section(
    worker,
    "async function loadPublicChangelog(env)",
    "let pendingPublicChangelog = null;"
  );

  assert.ok(load.includes("loadPublicationRepositoryProjects(env)"));
  assert.ok(load.includes("eligibleReleaseProjects(projects"));
  assert.ok(load.includes("sortPublicReleases"));
  assert.ok(load.includes('"bounded"'));
  assert.ok(load.includes('"partial"'));
});

test("Changelog response is not persisted in Cache API", () => {
  const handler = section(
    worker,
    "async function getPublicChangelog(env)",
    "async function getPublicOperations(env)"
  );

  assert.ok(handler.includes("pendingPublicChangelog"));
  assert.ok(handler.includes('"Cache-Control": "no-store"'));
  assert.equal(handler.includes("caches.default"), false);
  assert.equal(handler.includes("cache.put"), false);
});

test("Changelog has a dedicated API route", () => {
  assert.ok(worker.includes('url.pathname === "/api/changelog"'));
});

test("Changelog API fails closed with a bounded public error contract", () => {
  const handler = section(
    worker,
    "async function getPublicChangelog(env)",
    "async function getPublicOperations(env)"
  );

  assert.ok(handler.includes('status: "error"'));
  assert.ok(handler.includes('error: "changelog_unavailable"'));
  assert.ok(handler.includes("status: 502"));
  assert.ok(handler.includes('"Cache-Control": "no-store"'));
  assert.ok(handler.includes('"X-Content-Type-Options": "nosniff"'));
  assert.equal(handler.includes("error.stack"), false);
  assert.equal(handler.includes("providerError"), false);
});

test("Changelog client clears stale release state when upstream is unavailable", () => {
  assert.ok(client.includes('if (payload.status !== "available") throw new Error("changelog unavailable")'));
  assert.ok(client.includes('status.textContent = "Otillgänglig"'));
  assert.ok(client.includes("currentReleases = []"));
  assert.ok(client.includes("clear()"));
  assert.ok(client.includes("errorState.hidden = false"));
});

