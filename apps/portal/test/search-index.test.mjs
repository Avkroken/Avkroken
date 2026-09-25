import test from "node:test";
import assert from "node:assert/strict";
import {
  buildDocumentSearchEntry,
  buildProjectSearchEntries,
  filterSearchableDocs,
  searchableMarkdown,
  searchEntries,
  selectSearchDocumentTasks
} from "../src/search-index.mjs";

test("normalizes Markdown into searchable public text without hidden comments or link URLs", () => {
  const text = searchableMarkdown(`---
secret: metadata
---
# Arkitektur
<!-- hidden note -->
Läs [driftdokumentet](https://example.test/private?q=x) och \`API_NAME\`.
`);

  assert.equal(text.includes("secret: metadata"), false);
  assert.equal(text.includes("hidden note"), false);
  assert.equal(text.includes("https://"), false);
  assert.match(text, /Arkitektur/);
  assert.match(text, /driftdokumentet/);
  assert.match(text, /API NAME/);
});

test("indexes public project and Wiki presentation metadata separately", () => {
  const entries = buildProjectSearchEntries([{
    id: "repository:bastion",
    slug: "Bastion",
    name: "Bastion",
    category: "Projekt",
    description: "SSH-kärna",
    portalUrl: "/projekt/Bastion",
    repository: "https://github.com/Avkroken/Bastion",
    wiki: "https://github.com/Avkroken/Bastion/wiki",
    wikiPortalUrl: "/projekt/Bastion/wiki",
    source: {
      provider: "github",
      kind: "repository",
      repository: "Avkroken/Bastion",
      ref: "main"
    }
  }]);

  assert.deepEqual(entries.map(entry => entry.kind), ["project", "wiki"]);
  assert.equal(entries[1].url, "/projekt/Bastion/wiki");
  assert.equal(entries[1].canonicalUrl, "https://github.com/Avkroken/Bastion/wiki");
});

test("does not invent a Wiki search entry for an app without Wiki publication", () => {
  const entries = buildProjectSearchEntries([{
    id: "app:avkroken/avkroken:skvallerbyttan",
    slug: "skvallerbyttan",
    name: "Skvallerbyttan",
    portalUrl: "/projekt/skvallerbyttan",
    repository: "https://github.com/Avkroken/Avkroken",
    wiki: null,
    wikiPortalUrl: null,
    source: {
      provider: "github",
      kind: "monorepo_app",
      repository: "Avkroken/Avkroken",
      ref: "main",
      path: "apps/skvallerbyttan"
    }
  }]);

  assert.deepEqual(entries.map(entry => entry.kind), ["project"]);
});

test("searchable docs are the intersection of public project and docs catalogs", () => {
  const projects = [
    { slug: "Bastion" },
    { slug: "skvallerbyttan" }
  ];
  const docs = [
    { key: "Bastion" },
    { key: "skvallerbyttan" },
    { key: ".github" },
    { key: "jobb" }
  ];

  assert.deepEqual(
    filterSearchableDocs(projects, docs).map(entry => entry.key),
    ["Bastion", "skvallerbyttan"]
  );
});

test("builds document results with Portal and canonical source URLs", () => {
  const entry = {
    key: "Bastion",
    name: "Bastion",
    sourceKind: "repository",
    sourceRepository: "Bastion",
    defaultBranch: "main",
    description: "SSH"
  };
  const page = { path: "docs/architecture.md", label: "Arkitektur" };
  const result = buildDocumentSearchEntry(
    entry,
    page,
    "# Arkitektur\nSSH transport och nyckelhantering.",
    "https://github.com/Avkroken/Bastion/blob/main/docs/architecture.md"
  );

  assert.equal(result.kind, "document");
  assert.equal(result.url, "/projekt/Bastion/dokumentation/docs/architecture.md");
  assert.equal(result.source.path, "docs/architecture.md");
  assert.match(result.snippet, /SSH transport/);
});

test("ranks exact title and title matches ahead of body-only matches", () => {
  const results = searchEntries([
    {
      id: "1",
      kind: "project",
      title: "Bastion",
      subtitle: "Projekt",
      snippet: "SSH",
      url: "/projekt/Bastion",
      searchText: "bastion ssh"
    },
    {
      id: "2",
      kind: "document",
      title: "Annat · Drift",
      subtitle: "docs/operations.md",
      snippet: "Bastion omnämns här.",
      url: "/projekt/annat/dokumentation/docs/operations.md",
      searchText: "bastion omnämns här"
    }
  ], "Bastion");

  assert.deepEqual(results.map(result => result.id), ["1", "2"]);
  assert.equal("searchText" in results[0], false);
});

test("requires a meaningful query and caps result count", () => {
  const entries = Array.from({ length: 80 }, (_, index) => ({
    id: String(index),
    kind: "document",
    title: "Dokument " + index,
    subtitle: "",
    snippet: "",
    url: "/d/" + index,
    searchText: "portal dokument"
  }));

  assert.deepEqual(searchEntries(entries, "x"), []);
  assert.equal(searchEntries(entries, "portal", 100).length, 50);
});


test("selects search documents fairly across public sources", () => {
  const entries = [
    { key: "A", pages: [{ path: "a1" }, { path: "a2" }, { path: "a3" }] },
    { key: "B", pages: [{ path: "b1" }, { path: "b2" }, { path: "b3" }] },
    { key: "C", pages: [{ path: "c1" }] }
  ];

  assert.deepEqual(
    selectSearchDocumentTasks(entries, 5).map(task => task.entry.key + ":" + task.page.path),
    ["A:a1", "B:b1", "C:c1", "A:a2", "B:b2"]
  );
});
