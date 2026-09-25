import test from "node:test";
import assert from "node:assert/strict";
import {
  eligibleActivityProjects,
  normalizePublicActivityEvent,
  normalizePublicActivity,
  sortPublicActivity
} from "../src/activity-source.mjs";

function project(overrides = {}) {
  return {
    id: "repository:bastion",
    type: "repository",
    slug: "Bastion",
    name: "Bastion",
    repository: "https://github.com/Avkroken/Bastion",
    portalUrl: "/projekt/Bastion",
    source: {
      provider: "github",
      kind: "repository",
      repository: "Avkroken/Bastion",
      ref: "main"
    },
    ...overrides
  };
}

function event(overrides = {}) {
  return {
    id: "123456789",
    type: "PushEvent",
    public: true,
    created_at: "2026-09-25T18:00:00Z",
    actor: {
      login: "SECRET_ACTOR",
      avatar_url: "https://avatars.example/secret"
    },
    repo: {
      name: "Avkroken/Bastion"
    },
    payload: {
      ref: "refs/heads/SECRET_BRANCH",
      head: "SECRET_SHA",
      before: "SECRET_BEFORE",
      commits: [
        { message: "SECRET_COMMIT_MESSAGE" }
      ]
    },
    ...overrides
  };
}

test("normalizes push activity without actor, branch, SHA or commit content", () => {
  const item = normalizePublicActivityEvent(project(), event());

  assert.deepEqual(item, {
    id: "github-event:123456789",
    kind: "push",
    projectSlug: "Bastion",
    projectName: "Bastion",
    projectUrl: "/projekt/Bastion",
    repository: "Avkroken/Bastion",
    summary: "Kod pushad",
    occurredAt: "2026-09-25T18:00:00Z",
    url: "https://github.com/Avkroken/Bastion"
  });

  const serialized = JSON.stringify(item);
  for (const forbidden of [
    "SECRET_ACTOR",
    "SECRET_BRANCH",
    "SECRET_SHA",
    "SECRET_BEFORE",
    "SECRET_COMMIT_MESSAGE",
    "avatar"
  ]) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
});

test("normalizes PR and Issue activity without titles or actors", () => {
  const pr = normalizePublicActivityEvent(project(), event({
    id: "2",
    type: "PullRequestEvent",
    payload: {
      action: "opened",
      pull_request: {
        number: 7,
        title: "SECRET_PR_TITLE",
        html_url: "https://github.com/Avkroken/Bastion/pull/7",
        user: { login: "SECRET_PR_USER" }
      }
    }
  }));

  const issue = normalizePublicActivityEvent(project(), event({
    id: "3",
    type: "IssuesEvent",
    payload: {
      action: "closed",
      issue: {
        number: 9,
        title: "SECRET_ISSUE_TITLE",
        html_url: "https://github.com/Avkroken/Bastion/issues/9",
        user: { login: "SECRET_ISSUE_USER" }
      }
    }
  }));

  assert.equal(pr.summary, "Pull request #7 öppnad");
  assert.equal(pr.url, "https://github.com/Avkroken/Bastion/pull/7");
  assert.equal(issue.summary, "Issue #9 stängd");
  assert.equal(issue.url, "https://github.com/Avkroken/Bastion/issues/9");

  const serialized = JSON.stringify([pr, issue]);
  for (const forbidden of [
    "SECRET_PR_TITLE",
    "SECRET_PR_USER",
    "SECRET_ISSUE_TITLE",
    "SECRET_ISSUE_USER"
  ]) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
});

test("requires public events and canonical repository-scoped URLs", () => {
  assert.equal(
    normalizePublicActivityEvent(project(), event({ public: false })),
    null
  );
  assert.equal(
    normalizePublicActivityEvent(project(), event({
      type: "IssuesEvent",
      payload: {
        action: "opened",
        issue: {
          number: 1,
          html_url: "https://github.com/Avkroken/Other/issues/1"
        }
      }
    })),
    null
  );
  assert.equal(
    normalizePublicActivityEvent(project(), event({
      type: "WatchEvent",
      payload: { action: "started" }
    })),
    null
  );
});

test("excludes mixed-scope monorepo and app projects from Activity eligibility", () => {
  const projects = [
    project(),
    project({
      id: "repository:avkroken",
      slug: "Avkroken",
      name: "Avkroken",
      repository: "https://github.com/Avkroken/Avkroken",
      source: {
        provider: "github",
        kind: "repository",
        repository: "Avkroken/Avkroken",
        ref: "main"
      }
    }),
    project({
      id: "app:skvallerbyttan",
      type: "app",
      slug: "skvallerbyttan",
      name: "Skvallerbyttan",
      source: {
        provider: "github",
        kind: "monorepo_app",
        repository: "Avkroken/Avkroken",
        ref: "main",
        path: "apps/skvallerbyttan"
      }
    })
  ];

  assert.deepEqual(
    eligibleActivityProjects(projects).map(item => item.slug),
    ["Bastion"]
  );
});

test("filters events to eligible project repositories and deduplicates event ids", () => {
  const items = normalizePublicActivity(
    [project()],
    [
      event(),
      event(),
      event({ id: "4", repo: { name: "Avkroken/Other" } })
    ]
  );

  assert.equal(items.length, 1);
  assert.equal(items[0].projectSlug, "Bastion");
});

test("sorts Activity newest first with a hard cap", () => {
  const items = [
    {
      id: "a",
      occurredAt: "2026-09-24T10:00:00Z"
    },
    {
      id: "b",
      occurredAt: "2026-09-25T10:00:00Z"
    },
    {
      id: "c",
      occurredAt: "2026-09-23T10:00:00Z"
    }
  ];

  assert.deepEqual(sortPublicActivity(items, 2).map(item => item.id), ["b", "a"]);
});
