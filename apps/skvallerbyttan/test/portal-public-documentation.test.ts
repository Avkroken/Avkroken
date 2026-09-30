import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPortalPublicDocumentationSnapshot,
  portalDocumentationPaths,
} from "../src/portal-docs-model";

const tree = [
  { type: "blob", path: "README.md" },
  { type: "blob", path: "docs/index.md" },
  { type: "blob", path: "docs/architecture.md" },
  { type: "blob", path: "docs/deep/topic.md" },
  { type: "blob", path: "docs/too/deep/topic.md" },
  { type: "blob", path: "private/secret.md" },
  { type: "blob", path: "apps/jobb/README.md" },
  { type: "blob", path: "apps/skvallerbyttan/README.md" },
  { type: "blob", path: "apps/skvallerbyttan/docs/index.md" },
];

test("root documentation exposes only bounded README/docs markdown", () => {
  assert.deepEqual(portalDocumentationPaths(tree), [
    "docs/architecture.md",
    "docs/deep/topic.md",
    "docs/index.md",
    "docs/too/deep/topic.md",
    "README.md",
  ]);
});

test("public app documentation is allowlisted and cannot enumerate Jobb", () => {
  assert.deepEqual(portalDocumentationPaths(tree, "apps/skvallerbyttan"), [
    "apps/skvallerbyttan/docs/index.md",
    "apps/skvallerbyttan/README.md",
  ]);
  assert.deepEqual(portalDocumentationPaths(tree, "apps/jobb"), []);
});

test("snapshot rejects unsupported app source paths", () => {
  let rejected = false;
  try {
    buildPortalPublicDocumentationSnapshot({
      generatedAt: "2026-09-30T13:00:00Z",
      repository: "Avkroken",
      defaultBranch: "main",
      sourcePath: "apps/jobb",
      tree,
    });
  } catch {
    rejected = true;
  }
  assert.equal(rejected, true);
});
