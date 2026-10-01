import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizePortalReleaseCandidate,
  normalizePortalReleaseCandidates,
  publicMarkdownPaths,
} from "../src/portal-github-public-model";

test("public documentation index keeps repository docs plus explicitly allowlisted public app docs", () => {
  const paths = publicMarkdownPaths([
    { type: "blob", path: "README.md" },
    { type: "blob", path: "docs/index.md" },
    { type: "blob", path: "docs/architecture.md" },
    { type: "blob", path: "apps/skvallerbyttan/README.md" },
    { type: "blob", path: "apps/skvallerbyttan/docs/index.md" },
    { type: "blob", path: "apps/skvallerbyttan/docs/security.md" },
    { type: "blob", path: "apps/dumpen/README.md" },
    { type: "blob", path: "apps/dumpen/docs/index.md" },
    { type: "blob", path: "apps/jobb/README.md" },
    { type: "blob", path: "apps/jobb/docs/index.md" },
    { type: "blob", path: "src/private.md" },
    { type: "blob", path: "docs/../secret.md" },
    { type: "tree", path: "docs" },
  ]);

  assert.deepEqual(paths, [
    "apps/dumpen/docs/index.md",
    "apps/dumpen/README.md",
    "apps/skvallerbyttan/docs/index.md",
    "apps/skvallerbyttan/docs/security.md",
    "apps/skvallerbyttan/README.md",
    "docs/architecture.md",
    "docs/index.md",
    "README.md",
  ]);
});

test("public release candidates are canonical, published and bounded", () => {
  const release = normalizePortalReleaseCandidate("Avkroken", "Bastion", {
    id: 42,
    tag_name: "v1.2.3",
    name: "Version 1.2.3",
    published_at: "2026-09-30T12:00:00Z",
    html_url: "https://github.com/Avkroken/Bastion/releases/tag/v1.2.3",
    body: "## Features\nUseful change",
    prerelease: false,
    draft: false,
    author: { login: "must-not-leak" },
    assets: [{ name: "must-not-leak" }],
  });

  if (!release) throw new Error("expected sanitized release");
  assert.equal(release.id, 42);
  assert.equal(release.tag_name, "v1.2.3");
  assert.equal("author" in release, false);
  assert.equal("assets" in release, false);
});

test("drafts and cross-repository release URLs fail closed", () => {
  assert.equal(normalizePortalReleaseCandidate("Avkroken", "Bastion", {
    id: 1,
    tag_name: "v1",
    published_at: "2026-09-30T12:00:00Z",
    html_url: "https://github.com/Avkroken/Bastion/releases/tag/v1",
    draft: true,
  }), null);

  assert.equal(normalizePortalReleaseCandidate("Avkroken", "Bastion", {
    id: 2,
    tag_name: "v1",
    published_at: "2026-09-30T12:00:00Z",
    html_url: "https://github.com/Other/Bastion/releases/tag/v1",
    draft: false,
  }), null);

  const releases = normalizePortalReleaseCandidates("Avkroken", "Bastion", Array.from(
    { length: 30 },
    (_, index) => ({
      id: index + 1,
      tag_name: `v${index + 1}`,
      published_at: "2026-09-30T12:00:00Z",
      html_url: `https://github.com/Avkroken/Bastion/releases/tag/v${index + 1}`,
      draft: false,
    }),
  ), 10);
  assert.equal(releases.length, 10);
});
