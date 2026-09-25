import test from "node:test";
import assert from "node:assert/strict";
import {
  documentationPath,
  isPortalDocumentRoute,
  normalizePortalPath
} from "../src/portal-routes.mjs";

test("normalizes trailing slashes without changing root", () => {
  assert.equal(normalizePortalPath("/"), "/");
  assert.equal(normalizePortalPath("/projekt/"), "/projekt");
  assert.equal(normalizePortalPath("/drift/github///"), "/drift/github");
});

test("recognizes stable portal document routes", () => {
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
    "/auth/jobb",
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

test("does not rewrite API or asset requests to the portal shell", () => {
  for (const path of [
    "/api/sites",
    "/api/docs",
    "/styles.css",
    "/portal-v2.css",
    "/app.js",
    "/favicon.ico",
    "/not-a-portal-route"
  ]) {
    assert.equal(isPortalDocumentRoute(path), false, path);
  }
});

test("builds stable documentation URLs with encoded repository and source path", () => {
  assert.equal(documentationPath(), "/dokumentation");
  assert.equal(documentationPath("Bastion"), "/projekt/Bastion/dokumentation");
  assert.equal(
    documentationPath("Repo med mellanslag", "docs/API guide.md"),
    "/projekt/Repo%20med%20mellanslag/dokumentation/docs/API%20guide.md"
  );
});
