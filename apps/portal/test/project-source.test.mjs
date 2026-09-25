import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizePublicRepository,
  normalizePublicRepositories
} from "../src/project-source.mjs";

function repo(overrides = {}) {
  return {
    name: "Bastion",
    full_name: "Avkroken/Bastion",
    visibility: "public",
    archived: false,
    topics: ["portal-project", "portal-blue"],
    homepage: "https://bastion.denied.se",
    html_url: "https://github.com/Avkroken/Bastion",
    default_branch: "main",
    has_pages: true,
    has_discussions: true,
    has_wiki: true,
    language: "Swift",
    size: 2048,
    pushed_at: "2026-09-25T10:00:00Z",
    stargazers_count: 2,
    description: "Bastion",
    ...overrides
  };
}

test("normalizes active public repositories even without a published endpoint", () => {
  const project = normalizePublicRepository(repo({ homepage: null, topics: [] }));
  assert.equal(project.name, "Bastion");
  assert.equal(project.url, null);
  assert.equal(project.portalPublished, false);
  assert.equal(project.portalUrl, "/projekt/Bastion");
  assert.equal(project.documentation, "/projekt/Bastion/dokumentation");
  assert.equal(project.source.repository, "Avkroken/Bastion");
  assert.equal(project.wiki, "https://github.com/Avkroken/Bastion/wiki");
  assert.equal(project.wikiPortalUrl, "/projekt/Bastion/wiki");
  assert.equal(project.releases, "https://github.com/Avkroken/Bastion/releases");
  assert.equal(project.releasesPortalUrl, "/projekt/Bastion/releases");
  assert.equal(project.issues, "https://github.com/Avkroken/Bastion/issues");
  assert.equal(project.issuesPortalUrl, "/projekt/Bastion/issues");
});

test("filters organization infrastructure, retired repositories, archived, and non-public repositories", () => {
  for (const fixture of [
    repo({ name: ".github" }),
    repo({ name: "Skvallerbyttan" }),
    repo({ archived: true }),
    repo({ visibility: "private" })
  ]) {
    assert.equal(normalizePublicRepository(fixture), null);
  }
});

test("accepts only https homepages as public endpoints", () => {
  assert.equal(normalizePublicRepository(repo({ homepage: "http://example.test" })).url, null);
  assert.equal(normalizePublicRepository(repo({ homepage: "javascript:alert(1)" })).url, null);
  assert.equal(
    normalizePublicRepository(repo({ homepage: "https://example.test/path" })).host,
    "example.test"
  );
});

test("preserves the old published-site contract as an explicit derived flag", () => {
  assert.equal(normalizePublicRepository(repo()).portalPublished, true);
  assert.equal(normalizePublicRepository(repo({ topics: [] })).portalPublished, false);
  assert.equal(normalizePublicRepository(repo({ homepage: null })).portalPublished, false);
});

test("marks independent products without changing their runtime identity", () => {
  for (const name of ["Politiker", "Klarsprak", "Produkter"]) {
    assert.equal(
      normalizePublicRepository(repo({ name, full_name: "Avkroken/" + name })).independentProduct,
      true
    );
  }
  assert.equal(normalizePublicRepository(repo()).independentProduct, false);
});

test("returns a stable sorted public project catalog", () => {
  const projects = normalizePublicRepositories([
    repo({ name: "Produkter", full_name: "Avkroken/Produkter" }),
    repo({ name: ".github" }),
    repo({ name: "Bastion", full_name: "Avkroken/Bastion" })
  ]);
  assert.deepEqual(projects.map(project => project.name), ["Bastion", "Produkter"]);
});


test("does not expose a Portal Wiki route when repository Wiki is disabled", () => {
  const project = normalizePublicRepository(repo({ has_wiki: false }));
  assert.equal(project.wiki, null);
  assert.equal(project.wikiPortalUrl, null);
});
