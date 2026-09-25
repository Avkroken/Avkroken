import test from "node:test";
import assert from "node:assert/strict";
import {
  eligibleReleaseProjects,
  findEligibleReleaseProject,
  normalizePublicRelease,
  normalizePublicReleases,
  sortPublicReleases
} from "../src/release-source.mjs";

function project(overrides = {}) {
  return {
    id: "repository:bastion",
    type: "repository",
    slug: "Bastion",
    name: "Bastion",
    portalUrl: "/projekt/Bastion",
    repository: "https://github.com/Avkroken/Bastion",
    source: {
      provider: "github",
      kind: "repository",
      repository: "Avkroken/Bastion",
      ref: "main"
    },
    ...overrides
  };
}

function release(overrides = {}) {
  return {
    id: 383829912,
    tag_name: "v0.24.1",
    name: "v0.24.1",
    draft: false,
    prerelease: false,
    published_at: "2026-09-07T04:33:03Z",
    html_url: "https://github.com/Avkroken/Bastion/releases/tag/v0.24.1",
    body: "must not be copied",
    author: { login: "must-not-be-copied" },
    assets: [{ name: "must-not-be-copied" }],
    target_commitish: "must-not-be-copied",
    ...overrides
  };
}

test("normalizes a published release to the minimal public Changelog contract", () => {
  const item = normalizePublicRelease(project(), release());

  assert.deepEqual(item, {
    id: "release:bastion:383829912",
    projectSlug: "Bastion",
    projectName: "Bastion",
    projectUrl: "/projekt/Bastion",
    repository: "Avkroken/Bastion",
    tag: "v0.24.1",
    name: "v0.24.1",
    publishedAt: "2026-09-07T04:33:03Z",
    url: "https://github.com/Avkroken/Bastion/releases/tag/v0.24.1",
    prerelease: false
  });

  const serialized = JSON.stringify(item);
  for (const forbidden of ["body", "author", "assets", "target_commitish", "must-not-be-copied"]) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
});

test("rejects drafts, malformed source projects and non-canonical release URLs", () => {
  assert.equal(normalizePublicRelease(project(), release({ draft: true })), null);
  assert.equal(
    normalizePublicRelease(
      project({ type: "app", source: { provider: "github", kind: "monorepo_app", repository: "Avkroken/Avkroken" } }),
      release()
    ),
    null
  );
  assert.equal(
    normalizePublicRelease(
      project({ source: { provider: "github", kind: "repository", repository: "Other/Bastion" } }),
      release()
    ),
    null
  );
  assert.equal(
    normalizePublicRelease(project(), release({ html_url: "https://example.test/release/v0.24.1" })),
    null
  );
  assert.equal(
    normalizePublicRelease(project(), release({ html_url: "https://github.com/Avkroken/Other/releases/tag/v0.24.1" })),
    null
  );
});

test("requires an official published timestamp and tag", () => {
  assert.equal(normalizePublicRelease(project(), release({ published_at: null })), null);
  assert.equal(normalizePublicRelease(project(), release({ published_at: "not-a-date" })), null);
  assert.equal(normalizePublicRelease(project(), release({ tag_name: "" })), null);
});

test("repository projects are the only eligible release sources", () => {
  const projects = [
    project(),
    project({
      id: "repository:produkter",
      slug: "Produkter",
      name: "Produkter",
      portalUrl: "/projekt/Produkter",
      source: {
        provider: "github",
        kind: "repository",
        repository: "Avkroken/Produkter",
        ref: "main"
      }
    }),
    project({
      id: "app:avkroken/avkroken:skvallerbyttan",
      type: "app",
      slug: "skvallerbyttan",
      name: "Skvallerbyttan",
      source: {
        provider: "github",
        kind: "monorepo_app",
        repository: "Avkroken/Avkroken",
        path: "apps/skvallerbyttan"
      }
    }),
    project({
      id: "repository:external",
      slug: "External",
      name: "External",
      source: {
        provider: "github",
        kind: "repository",
        repository: "Other/External",
        ref: "main"
      }
    })
  ];

  assert.deepEqual(
    eligibleReleaseProjects(projects).map(item => item.slug),
    ["Bastion", "Produkter"]
  );
});

test("sorts releases newest first with a hard result cap", () => {
  const items = normalizePublicReleases(project(), [
    release({ id: 1, tag_name: "v1", name: "v1", published_at: "2026-09-01T00:00:00Z", html_url: "https://github.com/Avkroken/Bastion/releases/tag/v1" }),
    release({ id: 2, tag_name: "v2", name: "v2", published_at: "2026-09-03T00:00:00Z", html_url: "https://github.com/Avkroken/Bastion/releases/tag/v2" }),
    release({ id: 3, tag_name: "v3", name: "v3", published_at: "2026-09-02T00:00:00Z", html_url: "https://github.com/Avkroken/Bastion/releases/tag/v3" })
  ]);

  assert.deepEqual(sortPublicReleases(items, 2).map(item => item.tag), ["v2", "v3"]);
});


test("finds only an eligible repository project by stable slug", () => {
  const repositories = [
    project(),
    project({
      id: "repository:produkter",
      slug: "Produkter",
      name: "Produkter",
      portalUrl: "/projekt/Produkter",
      source: {
        provider: "github",
        kind: "repository",
        repository: "Avkroken/Produkter",
        ref: "main"
      }
    }),
    project({
      id: "app:avkroken/avkroken:skvallerbyttan",
      type: "app",
      slug: "skvallerbyttan",
      name: "Skvallerbyttan",
      portalUrl: "/projekt/skvallerbyttan",
      source: {
        provider: "github",
        kind: "monorepo_app",
        repository: "Avkroken/Avkroken"
      }
    })
  ];

  assert.equal(findEligibleReleaseProject(repositories, "Bastion")?.slug, "Bastion");
  assert.equal(findEligibleReleaseProject(repositories, "Produkter")?.slug, "Produkter");
  assert.equal(findEligibleReleaseProject(repositories, "skvallerbyttan"), null);
  assert.equal(findEligibleReleaseProject(repositories, "missing"), null);
  assert.equal(findEligibleReleaseProject(repositories, ""), null);
});
