import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const shell = await readFile(new URL("../public/shell.js", import.meta.url), "utf8");
const wiki = await readFile(new URL("../public/wiki.js", import.meta.url), "utf8");
const worker = await readFile(new URL("../src/index.js", import.meta.url), "utf8");

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
    "wiki-page-title",
    "wiki-original-link",
    "wiki-page-content",
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
    "wiki-page-title",
    "wiki-original-link",
    "wiki-page-content",
    "wiki-collaboration-links",
    "wiki-error"
  ]) {
    assert.ok(wiki.includes(`#${id}`), id);
  }
});

test("project Wiki routes use the dedicated Portal Wiki surface", () => {
  assert.ok(shell.includes('return "wiki"'));
  assert.ok(shell.includes('/^\\/projekt\\/[^/]+\\/wiki'));
  assert.ok(wiki.includes('/^\\/projekt\\/([^/]+)\\/wiki(?:\\/([^/]+))?$/'));
});

test("project detail links to Portal Wiki instead of opening GitHub Wiki directly", () => {
  assert.ok(app.includes('project.wikiPortalUrl'));
  assert.ok(app.includes('detailAction("Wiki"'));
});

test("Wiki presentation reads only the bounded Portal Wiki API", () => {
  assert.ok(wiki.includes('fetch("/api/wiki?"'));
  assert.equal(wiki.includes('fetch("/api/projects"'), false);
  assert.equal(wiki.includes('fetch("/api/docs"'), false);
  assert.equal(wiki.includes("api.github.com"), false);
  assert.equal(wiki.includes("raw.githubusercontent.com"), false);
  assert.equal(wiki.includes("/auth/jobb"), false);
});

test("Wiki API is live-project gated and fetches only the public Wiki raw origin", () => {
  assert.ok(worker.includes('url.pathname === "/api/wiki"'));
  assert.ok(worker.includes("loadPublicationRepositoryProjects(env)"));
  assert.ok(worker.includes("wikiRawUrl(repository, page)"));
  assert.ok(worker.includes('wikiRawUrl(repository, "_Sidebar")'));
  assert.ok(worker.includes("WIKI_PAGE_MAX_BYTES = 150000"));
  assert.ok(worker.includes('"github_wiki_raw"'));
});

test("Wiki renderer is DOM-only and keeps relative Wiki links inside Portal routing", () => {
  assert.equal(wiki.includes("innerHTML"), false);
  assert.ok(wiki.includes("document.createElement"));
  assert.ok(wiki.includes("textContent"));
  assert.ok(wiki.includes("wikiPageUrl(slug, target.page)"));
  assert.ok(wiki.includes('rel = "noopener noreferrer"'));
});
