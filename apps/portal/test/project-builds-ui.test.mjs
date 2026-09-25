import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const client = await readFile(new URL("../public/project-builds.js", import.meta.url), "utf8");
const shell = await readFile(new URL("../public/shell.js", import.meta.url), "utf8");
const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
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

test("project Builds DOM contract is unique and wired", () => {
  for (const id of [
    "project-builds-view",
    "project-builds-project-link",
    "project-builds-title",
    "project-builds-description",
    "project-builds-status",
    "project-builds-generated",
    "project-builds-original",
    "project-builds-summary",
    "project-builds-pass-rate",
    "project-builds-failures",
    "project-builds-duration",
    "project-builds-mttr",
    "project-builds-detail",
    "project-builds-coverage",
    "project-builds-unavailable",
    "project-builds-error"
  ]) {
    assert.equal(occurrences(html, `id="${id}"`), 1, id);
  }

  for (const id of [
    "project-builds-project-link",
    "project-builds-title",
    "project-builds-description",
    "project-builds-status",
    "project-builds-generated",
    "project-builds-original",
    "project-builds-summary",
    "project-builds-detail",
    "project-builds-unavailable",
    "project-builds-error"
  ]) {
    assert.ok(client.includes(`#${id}`), id);
  }
});

test("project Builds client reads only the Portal API and renders through textContent", () => {
  assert.ok(client.includes('"/api/builds?project="'));
  assert.equal(client.includes("api.github.com"), false);
  assert.equal(client.includes("Bearer "), false);
  assert.equal(client.includes("innerHTML"), false);
  assert.ok(client.includes("textContent"));
  assert.ok(client.includes('rel = "noopener noreferrer"'));
});

test("shell maps repository Builds deep links to the dedicated view", () => {
  assert.ok(shell.includes('/^\\/projekt\\/[^/]+\\/builds'));
  assert.ok(shell.includes('return "project-builds"'));
});

test("project Builds backend validates public project before using the Skvallerbyttan RPC", () => {
  const handler = section(
    worker,
    "async function getPublicProjectBuilds(requestUrl, env)",
    "async function fetchProjectIssues(project, env)"
  );

  assert.ok(handler.includes("loadPublicProjects(env)"));
  assert.ok(handler.includes("publicBuildProject(projectCatalog.projects"));
  assert.ok(handler.includes("SKVALLERBYTTAN_OBSERVATIONS"));
  assert.ok(handler.includes("getPublicRepositoryCi"));
  assert.equal(handler.includes("api.github.com"), false);
  assert.equal(handler.includes("/actions/runs"), false);
  assert.ok(handler.includes('"Cache-Control": "no-store"'));
});

test("project Builds API has explicit invalid/not-found/config/upstream states", () => {
  const handler = section(
    worker,
    "async function getPublicProjectBuilds(requestUrl, env)",
    "async function fetchProjectIssues(project, env)"
  );

  assert.ok(handler.includes('"invalid_project"'));
  assert.ok(handler.includes('"project_builds_not_found"'));
  assert.ok(handler.includes('"builds_not_configured"'));
  assert.ok(handler.includes('"project_builds_unavailable"'));
  assert.ok(worker.includes('url.pathname === "/api/builds"'));
});

test("project detail exposes Builds only through repository project metadata", () => {
  assert.ok(app.includes('detailAction("Builds / CI", project.buildsPortalUrl, { internal: true })'));
});
