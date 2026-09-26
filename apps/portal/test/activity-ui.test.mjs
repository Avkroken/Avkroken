import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const client = await readFile(new URL("../public/activity.js", import.meta.url), "utf8");
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

test("Activity DOM contract is unique and wired", () => {
  for (const id of [
    "activity-view",
    "activity-breadcrumbs",
    "activity-project-link",
    "activity-title",
    "activity-description",
    "activity-status",
    "activity-generated",
    "activity-original",
    "activity-observed-count",
    "activity-repository-count",
    "activity-coverage-summary",
    "activity-coverage-note",
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
    "activity-original",
    "activity-observed-count",
    "activity-repository-count",
    "activity-coverage-summary",
    "activity-list",
    "activity-error"
  ]) {
    assert.ok(client.includes(`#${id}`), id);
  }

  assert.equal(occurrences(html, "data-activity-days="), 3);
});

test("Activity client reads only the Portal API and renders untrusted values through DOM text", () => {
  assert.ok(client.includes('fetch("/api/activity?"'));
  assert.equal(client.includes("api.github.com"), false);
  assert.equal(client.includes("SKVALLERBYTTAN"), false);
  assert.equal(client.includes("Bearer "), false);
  assert.equal(client.includes("innerHTML"), false);
  assert.ok(client.includes("textContent"));
  assert.ok(client.includes("URLSearchParams"));
});

test("shell maps both global and repository Activity routes to the Activity surface", () => {
  assert.ok(shell.includes('/^\\/projekt\\/[^/]+\\/aktivitet'));
  assert.ok(shell.includes('return "activity"'));
  assert.ok(shell.includes('path === "/aktivitet"'));
});

test("Activity backend validates live public projects before the Skvallerbyttan RPC", () => {
  const handler = section(
    worker,
    "async function getPublicActivity(requestUrl, env)",
    "async function fetchProjectIssues(project, env)"
  );

  assert.ok(handler.includes("loadLivePublicRepositoryProjects(env)"));
  assert.ok(handler.includes("publicActivityProjects(repositoryProjects)"));
  assert.ok(handler.includes("SKVALLERBYTTAN_OBSERVATIONS"));
  assert.ok(handler.includes("getPublicActivity(repositoryNames, days)"));
  assert.ok(handler.includes("projectActivityPayload(snapshot, selected"));
  assert.equal(handler.includes("api.github.com"), false);
  assert.equal(handler.includes("/events"), false);
  assert.equal(handler.includes("/actions/runs"), false);
  assert.ok(handler.includes('"Cache-Control": "no-store"'));
});

test("Activity API has explicit invalid/not-found/config/upstream states", () => {
  const handler = section(
    worker,
    "async function getPublicActivity(requestUrl, env)",
    "async function fetchProjectIssues(project, env)"
  );

  assert.ok(handler.includes('"invalid_project"'));
  assert.ok(handler.includes('"project_activity_not_found"'));
  assert.ok(handler.includes('"activity_not_configured"'));
  assert.ok(handler.includes('"activity_unavailable"'));
  assert.ok(worker.includes('url.pathname === "/api/activity"'));
});

test("Portal performs a second whitelist projection over the public Activity RPC", () => {
  const projector = section(
    worker,
    "function projectActivityPayload(snapshot, projects, metadata)",
    "async function getPublicActivity(requestUrl, env)"
  );

  assert.ok(projector.includes("byRepository"));
  assert.ok(projector.includes("project.source.repository"));
  assert.equal(projector.includes("resourceId"), false);
  assert.equal(projector.includes("actor"), false);
  assert.equal(projector.includes("providerError"), false);
});

test("project detail exposes Activity only through repository project metadata", () => {
  assert.ok(app.includes('detailAction("Aktivitet", project.activityPortalUrl, { internal: true })'));
});


test("Activity project metadata bumps the public project cache schema", () => {
  assert.ok(worker.includes("github-projects-v8"));
  assert.equal(worker.includes("github-projects-v7"), false);
});


test("Portal Activity second projection enforces capability, source and coverage allowlists", () => {
  assert.ok(worker.includes("PUBLIC_ACTIVITY_CAPABILITIES"));
  assert.ok(worker.includes('"github.avkroken.repositories"'));
  assert.ok(worker.includes('"github.avkroken.pull_requests"'));
  assert.ok(worker.includes('"github.avkroken.actions"'));
  assert.ok(worker.includes("PUBLIC_ACTIVITY_SOURCES"));
  assert.ok(worker.includes("PUBLIC_ACTIVITY_COVERAGE"));
  assert.ok(worker.includes("activityCapability(item?.capability)"));
  assert.ok(worker.includes("activitySource(item?.source)"));
  assert.ok(worker.includes("activityCoverage(item?.coverage)"));
});
