import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const shell = await readFile(new URL("../public/shell.js", import.meta.url), "utf8");
const wiki = await readFile(new URL("../public/wiki.js", import.meta.url), "utf8");

function occurrences(source, value) {
  return source.split(value).length - 1;
}

test("Wiki presentation DOM contract is unique and wired", () => {
  for (const id of [
    "wiki-view",
    "wiki-title",
    "wiki-description",
    "wiki-project-link",
    "wiki-navigation-links",
    "wiki-original-link",
    "wiki-doc-list",
    "wiki-collaboration-links",
    "wiki-error"
  ]) {
    assert.equal(occurrences(html, `id="${id}"`), 1, id);
  }

  for (const id of [
    "wiki-title",
    "wiki-description",
    "wiki-project-link",
    "wiki-navigation-links",
    "wiki-original-link",
    "wiki-doc-list",
    "wiki-collaboration-links",
    "wiki-error"
  ]) {
    assert.ok(wiki.includes(`#${id}`), id);
  }
});

test("project Wiki routes use the dedicated Portal Wiki surface", () => {
  assert.ok(shell.includes('return "wiki"'));
  assert.ok(shell.includes('/^\\/projekt\\/[^/]+\\/wiki'));
});

test("project detail links to Portal Wiki instead of opening GitHub Wiki directly", () => {
  assert.ok(app.includes('project.wikiPortalUrl'));
  assert.ok(app.includes('detailAction("Wiki"'));
});

test("Wiki presentation reads only existing public Portal catalogs", () => {
  assert.ok(wiki.includes('fetch("/api/projects"'));
  assert.ok(wiki.includes('fetch("/api/docs"'));
  assert.equal(wiki.includes("api.github.com"), false);
  assert.equal(wiki.includes("/auth/jobb"), false);
});
