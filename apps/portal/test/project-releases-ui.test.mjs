import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const client = await readFile(new URL("../public/project-releases.js", import.meta.url), "utf8");
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

test("project Releases DOM contract is unique and wired", () => {
  for (const id of [
    "project-releases-view",
    "project-releases-project-link",
    "project-releases-title",
    "project-releases-description",
    "project-releases-status",
    "project-releases-generated",
    "project-releases-original",
    "project-releases-list",
    "project-releases-error"
  ]) {
    assert.equal(occurrences(html, `id="${id}"`), 1, id);
  }

  for (const id of [
    "project-releases-project-link",
    "project-releases-title",
    "project-releases-description",
    "project-releases-status",
    "project-releases-generated",
    "project-releases-original",
    "project-releases-list",
    "project-releases-error"
  ]) {
    assert.ok(client.includes(`#${id}`), id);
  }
});

test("project Releases client reads only the Portal API and renders untrusted strings as text", () => {
  assert.ok(client.includes('"/api/releases?project="'));
  assert.equal(client.includes("api.github.com"), false);
  assert.equal(client.includes("innerHTML"), false);
  assert.ok(client.includes("textContent"));
  assert.ok(client.includes('rel = "noopener noreferrer"'));
});

test("shell maps repository release deep links to the dedicated view", () => {
  assert.ok(shell.includes('/^\\/projekt\\/[^/]+\\/releases'));
  assert.ok(shell.includes('return "project-releases"'));
});

test("project Releases backend derives eligibility from the live public project catalog", () => {
  const load = section(
    worker,
    "async function loadPublicProjectReleases(projectSlug, env)",
    "async function getPublicProjectReleases(requestUrl, env)"
  );

  assert.ok(load.includes("loadPublicProjects(env)"));
  assert.ok(load.includes("eligibleReleaseProjects(projectCatalog.projects"));
  assert.ok(load.includes("fetchProjectReleases(project, env)"));
  assert.ok(load.includes("sortPublicReleases"));
  assert.equal(load.includes("getPublicChangelog"), false);
});

test("project Releases API is no-store and has explicit invalid/not-found/upstream states", () => {
  const handler = section(
    worker,
    "async function getPublicProjectReleases(requestUrl, env)",
    "async function fetchChangelogReleases(projects, env)"
  );

  assert.ok(handler.includes('"invalid_project"'));
  assert.ok(handler.includes('"project_releases_not_found"'));
  assert.ok(handler.includes('"project_releases_unavailable"'));
  assert.ok(handler.includes('"Cache-Control": "no-store"'));
  assert.ok(worker.includes('url.pathname === "/api/releases"'));
});
