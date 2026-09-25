import test from "node:test";
import assert from "node:assert/strict";
import {
  mergePublicProjectCatalog,
  normalizePublicAppManifest
} from "../src/project-source.mjs";

const context = {
  sourcePath: "apps/skvallerbyttan",
  repositoryName: "Avkroken/Avkroken",
  repository: "https://github.com/Avkroken/Avkroken",
  ref: "main",
  hasDiscussions: true,
  updatedAt: "2026-09-25T10:00:00Z",
  stars: 0
};

function manifest(overrides = {}) {
  return {
    schemaVersion: 1,
    slug: "skvallerbyttan",
    name: "Skvallerbyttan",
    description: "Read-only observationslager.",
    category: "project",
    accent: "blue",
    ...overrides
  };
}

test("normalizes an explicitly opted-in public app without inventing a public endpoint", () => {
  const project = normalizePublicAppManifest(manifest(), context);
  assert.equal(project.type, "app");
  assert.equal(project.slug, "skvallerbyttan");
  assert.equal(project.url, null);
  assert.equal(project.portalPublished, false);
  assert.equal(project.documentation, null);
  assert.equal(project.source.kind, "monorepo_app");
  assert.equal(project.source.path, "apps/skvallerbyttan");
  assert.equal(
    project.sourceUrl,
    "https://github.com/Avkroken/Avkroken/tree/main/apps/skvallerbyttan"
  );
});

test("accepts an optional public URL only when it is HTTPS", () => {
  assert.equal(
    normalizePublicAppManifest(manifest({ publicUrl: "https://example.test" }), context).url,
    "https://example.test/"
  );
  assert.equal(
    normalizePublicAppManifest(manifest({ publicUrl: "http://example.test" }), context).url,
    null
  );
  assert.equal(
    normalizePublicAppManifest(manifest({ publicUrl: "https://user:pass@example.test" }), context).url,
    null
  );
});

test("rejects malformed or unsupported public app manifests", () => {
  for (const value of [
    null,
    [],
    manifest({ schemaVersion: 2 }),
    manifest({ slug: "../jobb" }),
    manifest({ name: "" }),
    manifest({ description: "" }),
    manifest({ category: "private" }),
    manifest({ accent: "neon" })
  ]) {
    assert.equal(normalizePublicAppManifest(value, context), null);
  }
});

test("source location is controlled by discovery context, not manifest payload", () => {
  const project = normalizePublicAppManifest(
    manifest({
      sourcePath: "apps/jobb",
      repository: "https://example.test/private",
      ref: "secret"
    }),
    context
  );
  assert.equal(project.source.path, "apps/skvallerbyttan");
  assert.equal(project.source.repository, "Avkroken/Avkroken");
  assert.equal(project.source.ref, "main");
});

test("unknown manifest fields are not copied into the public project model", () => {
  const project = normalizePublicAppManifest(
    manifest({
      secret: "do-not-publish",
      internalStatus: { auth: "protected" }
    }),
    context
  );
  assert.equal("secret" in project, false);
  assert.equal("internalStatus" in project, false);
});

test("merges repository and app projects by stable id and sorts by display name", () => {
  const repositories = [
    { id: "repository:produkter", name: "Produkter" },
    { id: "repository:avkroken", name: "Avkroken" }
  ];
  const apps = [
    { id: "app:avkroken/avkroken:skvallerbyttan", name: "Skvallerbyttan" },
    { id: "repository:avkroken", name: "Duplicate" }
  ];

  assert.deepEqual(
    mergePublicProjectCatalog(repositories, apps).map(project => project.name),
    ["Avkroken", "Produkter", "Skvallerbyttan"]
  );
});
