import test from "node:test";
import assert from "node:assert/strict";
import {
  appDocumentSearchEntry,
  mergeSearchEntries,
  projectSearchEntries,
  searchableMarkdown,
  searchEntries,
  validateExternalSearchIndex
} from "../src/search-source.mjs";

function externalPayload(overrides = {}) {
  return {
    schemaVersion: 1,
    organization: "Avkroken",
    generatedAt: "2026-09-25T14:27:51Z",
    generatedMirror: true,
    canonical: "source repositories",
    entries: [
      {
        id: "document:Avkroken/Bastion:docs/architecture.md",
        kind: "document",
        repository: "Avkroken/Bastion",
        ref: "main",
        sourcePath: "docs/architecture.md",
        canonicalUrl: "https://github.com/Avkroken/Bastion/blob/main/docs/architecture.md",
        title: "Arkitektur",
        text: "Bastion architecture and SSH core.",
        truncated: false
      }
    ],
    ...overrides
  };
}

test("accepts safe generated entries and derives Portal document routes", () => {
  const parsed = validateExternalSearchIndex(externalPayload());
  assert.ok(parsed);
  assert.equal(parsed.entries.length, 1);
  assert.equal(
    parsed.entries[0].portalUrl,
    "/projekt/Bastion/dokumentation/docs/architecture.md"
  );
});

test("fails closed if the generic index contains the mixed-access monorepo", () => {
  const payload = externalPayload();
  payload.entries[0].repository = "Avkroken/Avkroken";
  payload.entries[0].canonicalUrl =
    "https://github.com/Avkroken/Avkroken/blob/main/apps/jobb/README.md";
  assert.equal(validateExternalSearchIndex(payload), null);
});

test("fails closed for non-canonical external URLs", () => {
  const payload = externalPayload();
  payload.entries[0].canonicalUrl = "https://example.invalid/Bastion";
  assert.equal(validateExternalSearchIndex(payload), null);
});

test("project search entries skip the protected Jobb app boundary", () => {
  const entries = projectSearchEntries([
    {
      slug: "Bastion",
      name: "Bastion",
      description: "SSH project",
      repository: "https://github.com/Avkroken/Bastion",
      portalUrl: "/projekt/Bastion",
      source: { kind: "repository", repository: "Avkroken/Bastion", ref: "main" }
    },
    {
      slug: "jobb",
      name: "Jobb",
      description: "Protected",
      repository: "https://github.com/Avkroken/Avkroken",
      portalUrl: "/projekt/jobb",
      source: {
        kind: "monorepo_app",
        repository: "Avkroken/Avkroken",
        ref: "main",
        path: "apps/jobb"
      }
    }
  ]);

  assert.deepEqual(entries.map(entry => entry.title), ["Bastion"]);
});

test("explicitly published app docs can enter search while Jobb cannot", () => {
  const safe = appDocumentSearchEntry(
    {
      key: "skvallerbyttan",
      sourceKind: "app",
      sourceRepository: "Avkroken",
      sourcePath: "apps/skvallerbyttan",
      defaultBranch: "main"
    },
    { path: "README.md", label: "Översikt" },
    "# Skvallerbyttan\n\nRead-only observation.",
    "https://github.com/Avkroken/Avkroken/blob/main/apps/skvallerbyttan/README.md"
  );
  assert.ok(safe);
  assert.equal(safe.sourceKind, "public_app_manifest");
  assert.equal(
    safe.portalUrl,
    "/projekt/skvallerbyttan/dokumentation/README.md"
  );

  const blocked = appDocumentSearchEntry(
    {
      key: "jobb",
      sourceKind: "app",
      sourceRepository: "Avkroken",
      sourcePath: "apps/jobb",
      defaultBranch: "main"
    },
    { path: "README.md", label: "Översikt" },
    "# Jobb",
    "https://github.com/Avkroken/Avkroken/blob/main/apps/jobb/README.md"
  );
  assert.equal(blocked, null);
});

test("markdown normalization removes link targets but preserves searchable text", () => {
  assert.equal(
    searchableMarkdown("# Drift\n\nSe [dokumentation](https://example.invalid) **nu**."),
    "Drift Se dokumentation nu ."
  );
});

test("search is accent-insensitive and prioritizes strong title matches", () => {
  const entries = [
    {
      id: "one",
      kind: "document",
      sourceKind: "generated_public_mirror",
      title: "Klarspråk",
      repository: "Avkroken/Klarsprak",
      sourcePath: "README.md",
      text: "Språk och dokumentation",
      portalUrl: "/projekt/Klarsprak/dokumentation/README.md",
      canonicalUrl: "https://github.com/Avkroken/Klarsprak/blob/main/README.md"
    },
    {
      id: "two",
      kind: "document",
      sourceKind: "generated_public_mirror",
      title: "Dokumentation",
      repository: "Avkroken/Bastion",
      sourcePath: "docs/index.md",
      text: "Här nämns klarspråk i brödtexten.",
      portalUrl: "/projekt/Bastion/dokumentation/docs/index.md",
      canonicalUrl: "https://github.com/Avkroken/Bastion/blob/main/docs/index.md"
    }
  ];

  const results = searchEntries(entries, "klarsprak");
  assert.deepEqual(results.map(result => result.id), ["one", "two"]);
});

test("merging search collections de-duplicates by stable id", () => {
  const entry = { id: "same", title: "A" };
  assert.deepEqual(mergeSearchEntries([entry], [entry]), [entry]);
});
