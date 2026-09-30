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
  assert.ok(worker.includes("public_project_catalog_intersect_public_docs_catalog_with_bounded_issues"));
  assert.ok(worker.includes('url.pathname === "/api/search"'));
});

test("search API is not a Portal shell route", () => {
  assert.ok(worker.includes('url.pathname === "/api/search"'));
});


test("search index is not persisted in Cache API and collapses concurrent builds per isolate", () => {
  assert.ok(worker.includes("let pendingSearchIndex = null;"));
  assert.ok(worker.includes("pendingSearchIndex = loadSearchIndex(env, ctx).finally"));
  assert.ok(worker.includes("pendingSearchIndex = null;"));
  assert.equal(worker.includes("public-search-index-v1"), false);
  assert.equal(worker.includes("SEARCH_INDEX_CACHE_SECONDS"), false);
});

test("public repository discovery prefers Skvallerbyttans authenticated read-only RPC", () => {
  assert.ok(worker.includes("async function loadServicePublicRepositories(env)"));
  assert.ok(worker.includes("service.getPublicRepositories()"));
  assert.ok(worker.includes("snapshot.schemaVersion !== 1"));
  assert.ok(worker.includes("snapshot.status !== \"available\""));
  assert.ok(worker.includes("const observed = await loadServicePublicRepositories(env)"));
  assert.ok(worker.includes("if (observed !== null) return observed"));
  assert.ok(worker.includes("const github = await fetchGitHubJson(GITHUB_API, env)"));
  assert.ok(worker.includes("const endpoint = githubRepositoryApiBase(repo.name) +"));
  assert.equal(worker.includes("repo.owner.login"), false);
});

test("search reuses public gates and bounds GitHub provider reads", () => {
  assert.ok(worker.includes("const GITHUB_CATALOG_CONCURRENCY = 2;"));
  assert.ok(worker.includes('const DOCS_CACHE_KEY = new Request("https://avkroken-cache.invalid/github-docs-v3")'));
  assert.ok(worker.includes("await cache.match(DOCS_CACHE_KEY)"));
  assert.ok(worker.includes("ctx.waitUntil(cache.put(DOCS_CACHE_KEY, cachedResponse))"));
  assert.ok(worker.includes("getDocsCatalog(env, ctx, projects)"));
  assert.ok(worker.includes('projectCatalog?.source?.appDiscovery || "unknown"'));
  assert.ok(worker.includes("githubRawContentUrl(location.repository, location.ref, location.path)"));
  assert.ok(worker.includes("githubRawContentUrl(repo.name, repo.default_branch, manifestPath)"));
  assert.ok(worker.includes('"/git/trees/" + encodeURIComponent(repo.default_branch) + "?recursive=1"'));
  assert.ok(worker.includes("service.getPublicDocumentationPages("));
  assert.ok(worker.includes("repositoryTreeLoader(env)"));
  assert.ok(worker.includes("const SEARCH_ISSUE_REPOSITORY_LIMIT = 8;"));
  assert.ok(worker.includes("const SEARCH_ISSUES_PER_REPOSITORY = 8;"));
  assert.ok(worker.includes("const SEARCH_ISSUE_FETCH_CONCURRENCY = 2;"));
  assert.ok(worker.includes("fetchSearchIssues(projects, env)"));
  assert.ok(worker.includes("fetchProjectIssuesWithLimit(project, env, SEARCH_ISSUES_PER_REPOSITORY)"));
  assert.ok(worker.includes("await discardResponse(response);"));
  assert.equal(worker.includes("scanMarkdownDocs("), false);
  assert.equal(worker.includes('"/readme?ref="'), false);
  assert.equal(worker.includes("Promise.all(publicRepositories.map"), false);
});
