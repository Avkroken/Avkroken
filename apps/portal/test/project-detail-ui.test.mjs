import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const shell = await readFile(new URL("../public/shell.js", import.meta.url), "utf8");

function occurrences(source, value) {
  return source.split(value).length - 1;
}

const detailIds = [
  "project-detail-view",
  "project-detail-title",
  "project-detail-description",
  "project-detail-category",
  "project-detail-breadcrumb",
  "project-detail-actions",
  "project-detail-source-kind",
  "project-detail-repository",
  "project-detail-ref",
  "project-detail-updated",
  "project-detail-source-path",
  "project-detail-release",
  "project-detail-release-status",
  "project-detail-release-link",
  "project-detail-stores",
  "project-detail-distribution-status",
  "project-detail-error"
];

test("project detail DOM contract uses unique ids", () => {
  for (const id of detailIds) {
    assert.equal(occurrences(html, `id="${id}"`), 1, id);
  }
});

test("project detail renderer references the DOM it owns", () => {
  for (const id of detailIds.filter(id => id !== "project-detail-view")) {
    assert.ok(app.includes(`#${id}`), id);
  }
});

test("project slug routes use the dedicated detail surface", () => {
  assert.ok(shell.includes('return "project-detail"'));
  assert.ok(shell.includes('/^\\/projekt\\/[^/]+$/'));
});

test("project cards make the full card an internal detail link while retaining explicit actions", () => {
  assert.ok(app.includes("project.portalUrl"));
  assert.ok(app.includes("card-hit-area"));
  assert.ok(app.includes("Öppna projektsidan för"));
  assert.ok(app.includes(">Översikt</a>"));
});

test("project detail shows latest release, live PWA status and verified store links", () => {
  assert.ok(app.includes('"/api/releases?project="'));
  assert.ok(app.includes('"/api/distribution?project="'));
  assert.ok(app.includes("project.releasesPortalUrl"));
  assert.ok(app.includes("payload?.webApp?.storeLinks"));
  assert.ok(app.includes("renderVerifiedStoreLinks"));
  assert.ok(app.includes('/^https:\\/\\//'));
  assert.ok(app.includes("Installerbar webbapp (PWA)"));
  assert.ok(app.includes("manifest och service worker verifierade live"));
});
