import test from "node:test";
import assert from "node:assert/strict";
import {
  documentationPath,
  isPortalDocumentRoute,
  normalizePortalPath,
  projectIssuesPath,
  projectPath,
  projectReleasesPath,
  protectedRedirectForPath,
  wikiPath
} from "../src/portal-routes.mjs";

test("normalizes trailing slashes without changing root", () => {
  assert.equal(normalizePortalPath("/"), "/");
  assert.equal(normalizePortalPath("/projekt/"), "/projekt");
  assert.equal(normalizePortalPath("/drift/github///"), "/drift/github");
});

test("recognizes stable public portal document routes", () => {
  for (const path of [
    "/",
    "/projekt",
    "/projekt/Bastion",
    "/projekt/Bastion/dokumentation",
    "/projekt/Bastion/dokumentation/docs/architecture.md",
    "/projekt/Bastion/wiki",
    "/projekt/Bastion/releases",
    "/projekt/Bastion/issues",
    "/dokumentation",
    "/dokumentation/arkitektur",
    "/tjanster",
    "/auth",
    "/drift",
    "/drift/github",
    "/changelog",
    "/aktivitet",
    "/om",
    "/sok"
  ]) {
    assert.equal(isPortalDocumentRoute(path), true, path);
  }
});

test("does not rewrite API, assets, unknown routes, or protected Jobb paths", () => {
  for (const path of [
    "/api/sites",
    "/api/docs",
    "/api/search",
    "/api/operations",
    "/api/changelog",
    "/api/releases",
    "/api/issues",
    "/styles.css",
    "/portal-v2.css",
    "/app.js",
    "/wiki.js",
    "/search.js",
    "/operations.js",
    "/changelog.js",
    "/project-releases.js",
    "/project-issues.js",
    "/favicon.ico",
    "/not-a-portal-route",
    "/auth/jobb",
    "/auth/jobb/dashboard"
  ]) {
    assert.equal(isPortalDocumentRoute(path), false, path);
  }
});

test("protected Jobb paths resolve only to the existing protected origin", () => {
  assert.equal(protectedRedirectForPath("/auth/jobb"), "https://jobb.denied.se/");
  assert.equal(protectedRedirectForPath("/auth/jobb/dashboard"), "https://jobb.denied.se/");
  assert.equal(protectedRedirectForPath("/auth"), null);
  assert.equal(protectedRedirectForPath("/projekt/jobb"), null);
});

test("builds stable documentation URLs with encoded repository and source path", () => {
  assert.equal(documentationPath(), "/dokumentation");
  assert.equal(documentationPath("Bastion"), "/projekt/Bastion/dokumentation");
  assert.equal(
    documentationPath("Repo med mellanslag", "docs/API guide.md"),
    "/projekt/Repo%20med%20mellanslag/dokumentation/docs/API%20guide.md"
  );
});


test("builds stable project detail URLs", () => {
  assert.equal(projectPath(), "/projekt");
  assert.equal(projectPath("Bastion"), "/projekt/Bastion");
  assert.equal(projectPath("Repo med mellanslag"), "/projekt/Repo%20med%20mellanslag");
});


test("builds stable Wiki presentation URLs", () => {
  assert.equal(wikiPath(), "/projekt");
  assert.equal(wikiPath("Bastion"), "/projekt/Bastion/wiki");
  assert.equal(wikiPath("Repo med mellanslag"), "/projekt/Repo%20med%20mellanslag/wiki");
});


test("builds stable project release URLs", () => {
  assert.equal(projectReleasesPath(), "/projekt");
  assert.equal(projectReleasesPath("Bastion"), "/projekt/Bastion/releases");
  assert.equal(
    projectReleasesPath("Repo med mellanslag"),
    "/projekt/Repo%20med%20mellanslag/releases"
  );
});


test("builds stable project Issues URLs", () => {
  assert.equal(projectIssuesPath(), "/projekt");
  assert.equal(projectIssuesPath("Bastion"), "/projekt/Bastion/issues");
  assert.equal(
    projectIssuesPath("Repo med mellanslag"),
    "/projekt/Repo%20med%20mellanslag/issues"
  );
});
