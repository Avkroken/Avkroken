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
    issues: "https://github.com/Avkroken/Bastion/issues",
    source: {
      provider: "github",
      kind: "repository",
      repository: "Avkroken/Bastion",
      ref: "main"
    },
    ...overrides
  };
}

function issue(overrides = {}) {
  return {
    id: 123,
    number: 42,
    title: "Public issue title",
    state: "open",
    created_at: "2026-09-20T10:00:00Z",
    updated_at: "2026-09-25T11:00:00Z",
    html_url: "https://github.com/Avkroken/Bastion/issues/42",
    body: "must-not-be-copied",
    user: { login: "must-not-be-copied" },
    assignees: [{ login: "must-not-be-copied" }],
    comments: 99,
    labels: [{ name: "must-not-be-copied" }],
    ...overrides
  };
}

test("normalizes an open issue to the minimal public contract", () => {
  const item = normalizePublicIssue(project(), issue());

  assert.deepEqual(item, {
    id: "issue:bastion:42",
    projectSlug: "Bastion",
    projectName: "Bastion",
    projectUrl: "/projekt/Bastion",
    repository: "Avkroken/Bastion",
    number: 42,
    title: "Public issue title",
    createdAt: "2026-09-20T10:00:00Z",
    updatedAt: "2026-09-25T11:00:00Z",
    url: "https://github.com/Avkroken/Bastion/issues/42"
  });

  const serialized = JSON.stringify(item);
  for (const forbidden of [
    "body",
    "user",
    "assignees",
    "comments",
    "labels",
    "must-not-be-copied"
  ]) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
});

test("filters pull requests, closed issues and malformed canonical URLs", () => {
  assert.equal(normalizePublicIssue(project(), issue({ pull_request: { url: "x" } })), null);
  assert.equal(normalizePublicIssue(project(), issue({ state: "closed" })), null);
  assert.equal(
    normalizePublicIssue(project(), issue({ html_url: "https://github.com/Avkroken/Other/issues/42" })),
    null
  );
  assert.equal(
    normalizePublicIssue(project(), issue({ html_url: "https://example.test/issues/42" })),
    null
  );
});

test("requires valid issue identity and timestamps", () => {
  assert.equal(normalizePublicIssue(project(), issue({ number: 0 })), null);
  assert.equal(normalizePublicIssue(project(), issue({ title: "" })), null);
  assert.equal(normalizePublicIssue(project(), issue({ created_at: "not-a-date" })), null);
  assert.equal(normalizePublicIssue(project(), issue({ updated_at: null })), null);
});

test("repository projects are the only eligible issue sources", () => {
  const projects = [
    project(),
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

  assert.deepEqual(eligibleIssueProjects(projects).map(item => item.slug), ["Bastion"]);
});

test("sorts issues by most recently updated with a hard cap", () => {
  const items = normalizePublicIssues(project(), [
    issue({ number: 1, updated_at: "2026-09-21T00:00:00Z", html_url: "https://github.com/Avkroken/Bastion/issues/1" }),
    issue({ number: 2, updated_at: "2026-09-23T00:00:00Z", html_url: "https://github.com/Avkroken/Bastion/issues/2" }),
    issue({ number: 3, updated_at: "2026-09-22T00:00:00Z", html_url: "https://github.com/Avkroken/Bastion/issues/3" })
  ]);

  assert.deepEqual(sortPublicIssues(items, 2).map(item => item.number), [2, 3]);
});
