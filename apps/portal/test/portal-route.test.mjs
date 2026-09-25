import test from "node:test";
import assert from "node:assert/strict";
import {
  isPortalShellPath,
  normalizePortalPath,
  protectedRedirectForPath
} from "../src/portal-route.mjs";

test("normalizes trailing slashes without changing root", () => {
  assert.equal(normalizePortalPath("/"), "/");
  assert.equal(normalizePortalPath("projekt/"), "/projekt");
  assert.equal(normalizePortalPath("/projekt/bastion///"), "/projekt/bastion");
});

test("recognizes public portal shell routes", () => {
  for (const path of [
    "/", "/projekt", "/projekt/bastion", "/projekt/bastion/dokumentation",
    "/dokumentation", "/dokumentation/Bastion/docs/architecture.md",
    "/tjanster", "/auth", "/drift", "/drift/github", "/changelog",
    "/aktivitet", "/om", "/sok"
  ]) {
    assert.equal(isPortalShellPath(path), true, path);
  }
});

test("does not turn API, asset, or protected Jobb paths into public shell content", () => {
  for (const path of [
    "/api/sites", "/api/docs", "/styles.css", "/app.js", "/auth/jobb", "/auth/jobb/dashboard"
  ]) {
    assert.equal(isPortalShellPath(path), false, path);
  }
});

test("protected Jobb routes resolve only to the existing protected origin", () => {
  assert.equal(protectedRedirectForPath("/auth/jobb"), "https://jobb.denied.se/");
  assert.equal(protectedRedirectForPath("/auth/jobb/dashboard"), "https://jobb.denied.se/");
  assert.equal(protectedRedirectForPath("/auth"), null);
  assert.equal(protectedRedirectForPath("/projekt/jobb"), null);
});
