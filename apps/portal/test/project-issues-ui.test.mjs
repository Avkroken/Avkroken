import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const client = await readFile(new URL("../public/project-issues.js", import.meta.url), "utf8");
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

test("project Issues DOM contract is unique and wired", () => {
  for (const id of [
    "project-issues-view",
    "project-issues-project-link",
    "project-issues-title",
    "project-issues-description",
    "project-issues-status",
    "project-issues-generated",
    "project-issues-original",
    "project-issues-list",
    "project-issues-error"
  ]) {
    assert.equal(occurrences(html, `id="${id}"`), 1, id);
  }

  for (const id of [
    "project-issues-project-link",
    "project-issues-title",
    "project-issues-description",
    "project-issues-status",
    "project-issues-generated",
    "project-issues-original",
    "project-issues-list",
    "project-issues-error"
  ]) {
    assert.ok(client.includes(`#${id}`), id);
  }
});

test("project Issues client reads only the Portal API and renders strings through textContent", () => {
  assert.ok(client.includes('"/api/issues?project="'));
  assert.equal(client.includes("api.github.com"), false);
  assert.equal(client.includes("innerHTML"), false);
  assert.equal(client.includes("Bearer "), false);
  assert.ok(client.includes("textContent"));
  assert.ok(client.includes('rel = "noopener noreferrer"'));
});

test("shell maps repository Issue deep links to the dedicated view", () => {
  assert.ok(shell.includes('/^\\/projekt\\/[^/]+\\/issues'));
  assert.ok(shell.includes('return "project-issues"'));
});

test("project Issues backend resolves only eligible live-public repository projects", () => {
  const load = section(
    worker,
    "async function loadPublicProjectIssues(projectSlug, env)",
    "async function getPublicProjectIssues(requestUrl, env)"
  );

  assert.ok(load.includes("loadPublicProjects(env)"));
  assert.ok(load.includes("eligibleIssueProjects(projectCatalog.projects"));
  assert.ok(load.includes("fetchProjectIssues(project, env)"));
  assert.equal(load.includes("project.source.repository +"), false);
});

test("project Issues provider read is bounded and sanitizes before response", () => {
  const fetcher = section(
    worker,
    "async function fetchProjectIssues(project, env)",
    "async function loadPublicProjectIssues(projectSlug, env)"
  );

  assert.ok(fetcher.includes("/issues?state=all&sort=updated&direction=desc&per_page="));
  assert.ok(fetcher.includes("normalizePublicIssues(project, result.data)"));
  assert.ok(fetcher.includes("sortPublicIssues"));
  assert.equal(fetcher.includes("result.data[0]"), false);
});

test("project Issues API is no-store and has explicit invalid/not-found/upstream states", () => {
  const handler = section(
    worker,
    "async function getPublicProjectIssues(requestUrl, env)",
    "async function fetchProjectReleases(project, env)"
  );

  assert.ok(handler.includes('"invalid_project"'));
  assert.ok(handler.includes('"project_issues_not_found"'));
  assert.ok(handler.includes('"project_issues_unavailable"'));
  assert.ok(handler.includes('"Cache-Control": "no-store"'));
  assert.ok(worker.includes('url.pathname === "/api/issues"'));
});
