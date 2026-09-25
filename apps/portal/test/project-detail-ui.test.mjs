import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const shell = await readFile(new URL("../public/shell.js", import.meta.url), "utf8");

function occurrences(source, value) {
  return source.split(value).length - 1;
}

test("project detail DOM contract is unique and wired", () => {
  for (const id of [
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
    "project-detail-error"
  ]) {
    assert.equal(occurrences(html, `id="${id}"`), 1, id);
    assert.ok(app.includes(`#${id}`), id);
  }
});

test("project slug routes use the dedicated detail surface", () => {
  assert.ok(shell.includes('return "project-detail"'));
  assert.ok(shell.includes('/^\\/projekt\\/[^/]+$/'));
});

test("project cards link to their stable Portal detail route", () => {
  assert.ok(app.includes("project.portalUrl"));
  assert.ok(app.includes(">Översikt</a>"));
});
