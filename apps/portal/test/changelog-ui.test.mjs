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

test("Changelog backend derives release eligibility from live public projects", () => {
  const load = section(
    worker,
    "async function loadPublicChangelog(env)",
    "let pendingPublicChangelog = null;"
  );

  assert.ok(load.includes("loadPublicProjects(env)"));
  assert.ok(load.includes("eligibleReleaseProjects(projectCatalog.projects"));
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
