import test from "node:test";
import assert from "node:assert/strict";
import {
  buildProjectEntry,
  isProjectCatalogRepository,
  projectPresentation,
  sortProjectEntries
} from "../src/project-adapter.mjs";

function repo(overrides = {}) {
  return {
    id: 1,
    name: "Example",
    visibility: "public",
    archived: false,
    fork: false,
    description: "Example project",
    html_url: "https://github.com/Avkroken/Example",
    homepage: null,
    language: "TypeScript",
    default_branch: "main",
    topics: [],
    size: 42,
    pushed_at: "2026-09-25T12:00:00Z",
    updated_at: "2026-09-25T12:00:00Z",
    stargazers_count: 2,
    forks_count: 1,
    has_issues: true,
    has_discussions: true,
    has_wiki: true,
    has_pages: false,
    ...overrides
  };
}

test("catalog includes only active public non-retired project repositories", () => {
  assert.equal(isProjectCatalogRepository(repo()), true);
  assert.equal(isProjectCatalogRepository(repo({ name: ".github" })), false);
  assert.equal(isProjectCatalogRepository(repo({ name: "Jobb" })), false);
  assert.equal(isProjectCatalogRepository(repo({ archived: true })), false);
  assert.equal(isProjectCatalogRepository(repo({ visibility: "private" })), false);
  assert.equal(isProjectCatalogRepository(repo({ fork: true })), false);
});

test("explicit independent products override repository topic classification", () => {
  assert.deepEqual(projectPresentation(repo({ name: "Klarsprak", topics: ["tool", "cyan"] })), {
    kind: "product",
    kindLabel: "Produkt",
    kindSource: "portal_policy",
    independentProduct: true
  });
});

test("topic classification is used when no portal presentation override exists", () => {
  assert.deepEqual(projectPresentation(repo({ name: "Utility", topics: ["portal-tool"] })), {
    kind: "tool",
    kindLabel: "Verktyg",
    kindSource: "topic",
    independentProduct: false
  });
});

test("unclassified repositories remain visible with an explicit default source", () => {
  assert.deepEqual(projectPresentation(repo({ name: "Bastion", topics: [] })), {
    kind: "project",
    kindLabel: "Projekt",
    kindSource: "default",
    independentProduct: false
  });
});

test("project entry exposes portal and canonical links without inventing protected data", () => {
  const entry = buildProjectEntry(repo({
    name: "Bastion",
    homepage: "http://insecure.example",
    has_pages: true
  }));

  assert.equal(entry.links.overview, "/projekt/Bastion");
  assert.equal(entry.links.documentation, "/projekt/Bastion/dokumentation");
  assert.equal(entry.links.repository, "https://github.com/Avkroken/Example");
  assert.equal(entry.links.issues, "https://github.com/Avkroken/Example/issues");
  assert.equal(entry.links.discussions, "https://github.com/Avkroken/Example/discussions");
  assert.equal(entry.homepage, null);
  assert.equal(entry.features.pages, true);
  assert.equal(entry.links.pages, "https://avkroken.github.io/Bastion/");
});

test("project entries are sorted by portal presentation role then name", () => {
  const entries = [
    buildProjectEntry(repo({ id: 3, name: "Produkter" })),
    buildProjectEntry(repo({ id: 2, name: "Bastion" })),
    buildProjectEntry(repo({ id: 1, name: "Avkroken" }))
  ];

  assert.deepEqual(sortProjectEntries(entries).map(entry => entry.name), [
    "Avkroken",
    "Bastion",
    "Produkter"
  ]);
});
