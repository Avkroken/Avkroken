import test from "node:test";
import assert from "node:assert/strict";
import {
  eligibleIssueProjects,
  normalizePublicIssue,
  normalizePublicIssues,
  sortPublicIssues
} from "../src/issue-source.mjs";

function project(overrides = {}) {
  return {
    id: "repository:bastion",
    type: "repository",
    slug: "Bastion",
    name: "Bastion",
    portalUrl: "/projekt/Bastion",
    source: {
      provider: "github",
      kind: "repository",
      repository: "blixten85/Bastion",
      ref: "main"
    },
    ...overrides
  };
}

function issue(overrides = {}) {
  return {
    id: 123456,
    number: 42,
    title: "Fix portal route",
    state: "open",
    created_at: "2026-09-20T10:00:00Z",
    updated_at: "2026-09-25T10:30:00Z",
    html_url: "https://github.com/blixten85/Bastion/issues/42",
    comments: 3,
    labels: [
      { name: "bug", color: "ff0000", description: "must-not-be-copied" },
      { name: "portal" }
    ],
    body: "SECRET_BODY",
    user: { login: "SECRET_USER" },
    assignee: { login: "SECRET_ASSIGNEE" },
    milestone: { title: "SECRET_MILESTONE" },
    ...overrides
  };
}

test("normalizes a GitHub Issue to the minimal public Portal contract", () => {
  const item = normalizePublicIssue(project(), issue());

  assert.deepEqual(item, {
    id: "issue:bastion:42",
    projectSlug: "Bastion",
    projectName: "Bastion",
    projectUrl: "/projekt/Bastion",
    repository: "blixten85/Bastion",
    number: 42,
    title: "Fix portal route",
    state: "open",
    createdAt: "2026-09-20T10:00:00Z",
    updatedAt: "2026-09-25T10:30:00Z",
    comments: 3,
    labels: ["bug", "portal"],
    url: "https://github.com/blixten85/Bastion/issues/42"
  });

  const serialized = JSON.stringify(item);
  for (const forbidden of [
    "SECRET_BODY",
    "SECRET_USER",
    "SECRET_ASSIGNEE",
    "SECRET_MILESTONE",
    "must-not-be-copied",
    "color",
    "description"
  ]) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
});

test("filters pull requests returned by GitHub's Issues endpoint", () => {
  assert.equal(
    normalizePublicIssue(project(), issue({ pull_request: { url: "https://api.github.com/example" } })),
    null
  );
});

test("rejects malformed projects, issue states and non-canonical issue URLs", () => {
  assert.equal(
    normalizePublicIssue(
      project({ type: "app", source: { provider: "github", kind: "monorepo_app", repository: "blixten85/Avkroken" } }),
      issue()
    ),
    null
  );
  assert.equal(
    normalizePublicIssue(
      project({ source: { provider: "github", kind: "repository", repository: "Other/Bastion" } }),
      issue()
    ),
    null
  );
  assert.equal(normalizePublicIssue(project(), issue({ state: "draft" })), null);
  assert.equal(
    normalizePublicIssue(project(), issue({ html_url: "https://github.com/blixten85/Other/issues/42" })),
    null
  );
});

test("repository projects are the only eligible Issue sources", () => {
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
        repository: "blixten85/Produkter",
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
        repository: "blixten85/Avkroken"
      }
    })
  ];

  assert.deepEqual(
    eligibleIssueProjects(projects).map(item => item.slug),
    ["Bastion", "Produkter"]
  );
});

test("sorts Issues by latest update with a hard cap", () => {
  const items = normalizePublicIssues(project(), [
    issue({ number: 1, updated_at: "2026-09-20T00:00:00Z", html_url: "https://github.com/blixten85/Bastion/issues/1" }),
    issue({ number: 2, updated_at: "2026-09-23T00:00:00Z", html_url: "https://github.com/blixten85/Bastion/issues/2" }),
    issue({ number: 3, updated_at: "2026-09-22T00:00:00Z", html_url: "https://github.com/blixten85/Bastion/issues/3" })
  ]);

  assert.deepEqual(sortPublicIssues(items, 2).map(item => item.number), [2, 3]);
});
