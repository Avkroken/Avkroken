import test from "node:test";
import assert from "node:assert/strict";
import {
  attachReleaseDeployments,
  eligibleReleaseProjects,
  normalizePublicRelease,
  releaseCorrelation,
  releaseDeploymentRequests,
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
    categories: ["releases"],
    prerelease: false
  });

  const serialized = JSON.stringify(item);
  for (const forbidden of ["body", "author", "assets", "target_commitish", "must-not-be-copied"]) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
});

test("derives changelog categories only from recognized release section headings", () => {
  const item = normalizePublicRelease(project(), release({
    body: [
      "## 0.25.0",
      "### Features",
      "* add a feature",
      "### Bug Fixes",
      "* fix a bug",
      "### Security",
      "* harden a boundary",
      "### Documentation",
      "* update docs",
      "## Dependency updates",
      "* chore(deps): update dependency"
    ].join("\n")
  }));

  assert.deepEqual(
    item.categories,
    ["releases", "features", "fixes", "security", "documentation"]
  );
  assert.equal(JSON.stringify(item).includes("add a feature"), false);
  assert.equal(JSON.stringify(item).includes("Dependency updates"), false);
});

test("does not infer categories from arbitrary release prose", () => {
  const item = normalizePublicRelease(project(), release({
    body: "This release mentions a feature and a security fix without canonical section headings."
  }));

  assert.deepEqual(item.categories, ["releases"]);
});

test("derives bounded commit and PR correlation only from canonical release metadata", () => {
  const sha = "6d9fdaf46c61304cf68614f85ebb0c0ae4061928";
  const target = "401752ce5c3920cdc7cb39a8e4ad51362ea20f7d";
  const correlation = releaseCorrelation(
    "Avkroken/Bastion",
    [
      "Changes since v0.24.2.",
      "",
      "## Fixes",
      "- fix(ci): harden gate (#535) ([6d9fdaf](https://github.com/Avkroken/Bastion/commit/" + sha + "))",
      "- ignore external (#999) ([other](https://github.com/Other/Bastion/commit/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa))"
    ].join("\n"),
    target
  );

  assert.equal(correlation.source, "release_metadata");
  assert.equal(correlation.derived, true);
  assert.equal(correlation.previousTag, "v0.24.2");
  assert.deepEqual(correlation.pullRequests, [{
    number: 535,
    url: "https://github.com/Avkroken/Bastion/pull/535",
    source: "release_note_reference",
    derived: true
  }]);
  assert.deepEqual(correlation.commits, [
    {
      sha,
      shortSha: "6d9fdaf",
      url: "https://github.com/Avkroken/Bastion/commit/" + sha,
      releaseTarget: false,
      source: "release_note_commit_url",
      derived: true
    },
    {
      sha: target,
      shortSha: "401752c",
      url: "https://github.com/Avkroken/Bastion/commit/" + target,
      releaseTarget: true,
      source: "target_commitish",
      derived: true
    }
  ]);
});

test("release correlation does not expose arbitrary release prose or branch target names", () => {
  const item = normalizePublicRelease(project(), release({
    body: [
      "Changes since v0.24.0.",
      "- fix: public change (#42) ([abc](https://github.com/Avkroken/Bastion/commit/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa))",
      "SECRET_RELEASE_PROSE"
    ].join("\n"),
    target_commitish: "main"
  }));

  assert.equal(item.correlation.previousTag, "v0.24.0");
  assert.equal(item.correlation.commits.length, 1);
  assert.equal(item.correlation.pullRequests[0].number, 42);
  const serialized = JSON.stringify(item);
  assert.equal(serialized.includes("SECRET_RELEASE_PROSE"), false);
  assert.equal(serialized.includes('"target_commitish"'), false);
});

test("accepts sanitized pre-derived categories from the read-only observations RPC", () => {
  const item = normalizePublicRelease(project(), release({
    body: undefined,
    categories: ["security", "features", "unknown", "security"]
  }));

  assert.deepEqual(item.categories, ["releases", "security", "features"]);
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

test("builds bounded deployment requests from release commit correlation", () => {
  const shaA = "a".repeat(40);
  const shaB = "b".repeat(40);
  const releases = [
    {
      repository: "Avkroken/Bastion",
      correlation: { commits: [{ sha: shaA }, { sha: shaB }] }
    },
    {
      repository: "Avkroken/Bastion",
      correlation: { commits: [{ sha: shaA }] }
    },
    {
      repository: "Other/Private",
      correlation: { commits: [{ sha: shaA }] }
    }
  ];

  assert.deepEqual(releaseDeploymentRequests(releases), [{
    repository: "Bastion",
    commitShas: [shaA, shaB]
  }]);

  const many = Array.from({ length: 25 }, (_, index) => ({
    repository: "Avkroken/Bastion",
    correlation: {
      commits: [{
        sha: index.toString(16).padStart(40, "0")
      }]
    }
  }));
  assert.equal(releaseDeploymentRequests(many)[0].commitShas.length, 20);
});

test("attaches deployments only to exact release commit SHAs", () => {
  const sha = "a".repeat(40);
  const other = "b".repeat(40);
  const releases = [{
    repository: "Avkroken/Bastion",
    correlation: {
      source: "release_metadata",
      previousTag: "v1.0.0",
      commits: [{ sha, shortSha: "aaaaaaa", url: "https://github.com/Avkroken/Bastion/commit/" + sha }],
      pullRequests: []
    }
  }];

  const [item] = attachReleaseDeployments(releases, {
    schemaVersion: 1,
    repositories: [{
      repository: "Avkroken/Bastion",
      status: "available",
      truncated: false,
      matches: [
        {
          sha,
          environment: "produktion",
          createdAt: "2026-09-30T10:00:00Z",
          updatedAt: null,
          secret: "MUST_NOT_LEAK"
        },
        { sha: other, environment: "produktion", createdAt: "2026-09-30T11:00:00Z", updatedAt: null }
      ]
    }]
  });

  assert.equal(item.correlation.deployments.status, "available");
  assert.equal(item.correlation.deployments.matches.length, 1);
  assert.deepEqual(item.correlation.deployments.matches[0], {
    sha,
    environment: "produktion",
    createdAt: "2026-09-30T10:00:00Z",
    updatedAt: null
  });
  assert.equal(JSON.stringify(item).includes("MUST_NOT_LEAK"), false);
});

test("deployment correlation distinguishes complete absence from truncated uncertainty", () => {
  const sha = "c".repeat(40);
  const releaseItem = {
    repository: "Avkroken/Bastion",
    correlation: { commits: [{ sha }] }
  };

  const [complete] = attachReleaseDeployments([releaseItem], {
    schemaVersion: 1,
    repositories: [{
      repository: "Avkroken/Bastion",
      status: "available",
      truncated: false,
      matches: []
    }]
  });
  assert.equal(complete.correlation.deployments.status, "not_observed");

  const [truncated] = attachReleaseDeployments([releaseItem], {
    schemaVersion: 1,
    repositories: [{
      repository: "Avkroken/Bastion",
      status: "available",
      truncated: true,
      matches: []
    }]
  });
  assert.equal(truncated.correlation.deployments.status, "unknown");

  const [unavailable] = attachReleaseDeployments([releaseItem], null);
  assert.equal(unavailable.correlation.deployments.status, "unavailable");
});
