import test from "node:test";
import assert from "node:assert/strict";
import {
  appDocsSource,
  canonicalDocUrl,
  docsContentLocation,
  repositoryDocsSource
} from "../src/docs-source.mjs";

test("maps repository documentation to its canonical repository source", () => {
  const source = repositoryDocsSource({
    name: "Bastion",
    html_url: "https://github.com/Avkroken/Bastion",
    default_branch: "main",
    has_pages: true,
    language: "Swift"
  });
  assert.equal(source.key, "Bastion");
  assert.equal(source.sourceRepository, "Bastion");
  assert.equal(source.docsRoot, "docs");
  assert.equal(source.readmePath, null);
});

test("maps an opted-in app to its app-local documentation roots", () => {
  const source = appDocsSource({
    type: "app",
    slug: "skvallerbyttan",
    name: "Skvallerbyttan",
    repository: "https://github.com/Avkroken/Avkroken",
    issues: "https://github.com/Avkroken/Avkroken/issues",
    source: {
      kind: "monorepo_app",
      repository: "Avkroken/Avkroken",
      ref: "main",
      path: "apps/skvallerbyttan"
    }
  });
  assert.equal(source.key, "skvallerbyttan");
  assert.equal(source.sourceRepository, "Avkroken");
  assert.equal(source.docsRoot, "apps/skvallerbyttan/docs");
  assert.equal(source.readmePath, "apps/skvallerbyttan/README.md");
  assert.equal(source.pagesUrl, null);
});

test("rejects non-app and nested arbitrary source paths", () => {
  assert.equal(appDocsSource({ type: "repository" }), null);
  assert.equal(appDocsSource({
    type: "app",
    slug: "jobb",
    name: "Jobb",
    repository: "https://github.com/Avkroken/Avkroken",
    source: {
      kind: "monorepo_app",
      repository: "Avkroken/Avkroken",
      ref: "main",
      path: "apps/skvallerbyttan/../jobb"
    }
  }), null);
});

test("content locations require an exact page already present in the public catalog entry", () => {
  const entry = {
    sourceRepository: "Avkroken",
    defaultBranch: "main",
    repository: "https://github.com/Avkroken/Avkroken",
    pages: [
      { path: "apps/skvallerbyttan/README.md" },
      { path: "apps/skvallerbyttan/docs/architecture.md" }
    ]
  };

  assert.deepEqual(
    docsContentLocation(entry, "apps/skvallerbyttan/docs/architecture.md"),
    {
      repository: "Avkroken",
      ref: "main",
      path: "apps/skvallerbyttan/docs/architecture.md"
    }
  );
  assert.equal(docsContentLocation(entry, "apps/jobb/README.md"), null);
});

test("canonical URLs use the canonical repository/ref/path from the catalog entry", () => {
  const entry = {
    sourceRepository: "Avkroken",
    defaultBranch: "main",
    repository: "https://github.com/Avkroken/Avkroken",
    pages: [{ path: "apps/skvallerbyttan/docs/API guide.md" }]
  };
  assert.equal(
    canonicalDocUrl(entry, "apps/skvallerbyttan/docs/API guide.md"),
    "https://github.com/Avkroken/Avkroken/blob/main/apps/skvallerbyttan/docs/API%20guide.md"
  );
});
