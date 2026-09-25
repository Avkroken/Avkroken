import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const search = await readFile(new URL("../public/search.js", import.meta.url), "utf8");
const worker = await readFile(new URL("../src/index.js", import.meta.url), "utf8");

function occurrences(source, value) {
  return source.split(value).length - 1;
}

test("global search DOM contract is unique and wired", () => {
  for (const id of [
    "search-view",
    "portal-search-form",
    "portal-search-input",
    "portal-search-status",
    "portal-search-freshness",
    "portal-search-results"
  ]) {
    assert.equal(occurrences(html, `id="${id}"`), 1, id);
  }

  for (const id of [
    "portal-search-form",
    "portal-search-input",
    "portal-search-status",
    "portal-search-freshness",
    "portal-search-results"
  ]) {
    assert.ok(search.includes(`#${id}`), id);
  }
});

test("search client receives ranked results only through the Portal search API", () => {
  assert.ok(search.includes('fetch("/api/search?q="'));
  assert.equal(search.includes("api.github.com"), false);
  assert.equal(search.includes("/auth/jobb"), false);
  assert.equal(search.includes("searchText"), false);
});

test("search worker intersects public projects and docs before indexing", () => {
  assert.ok(worker.includes("filterSearchableDocs(projects, docsCatalog)"));
  assert.ok(worker.includes("public_project_catalog_intersect_public_docs_catalog"));
  assert.ok(worker.includes('url.pathname === "/api/search"'));
});

test("search API is not a Portal shell route", () => {
  assert.ok(worker.includes('url.pathname === "/api/search"'));
});
