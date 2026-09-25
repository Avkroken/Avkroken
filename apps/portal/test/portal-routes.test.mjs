import test from "node:test";
import assert from "node:assert/strict";
import {
  documentationPath,
  isPortalDocumentRoute,
  normalizePortalPath,
  protectedRedirectForPath
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
    "/api/projects",
    "/api/sites",
    "/api/docs",
    "/styles.css",
    "/portal-v2.css",
    "/app.js",
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
