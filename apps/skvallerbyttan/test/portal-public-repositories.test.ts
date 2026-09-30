import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPortalPublicRepositoriesSnapshot,
  normalizePortalPublicRepository,
} from "../src/portal-repository-model";

const baseRepository = {
  name: "Bastion",
  full_name: "Avkroken/Bastion",
  html_url: "https://github.com/Avkroken/Bastion",
  visibility: "public",
  private: false,
  archived: false,
  description: "Public project",
  topics: ["portal-project", "portal-blue"],
  homepage: "https://example.invalid/",
  has_wiki: true,
  has_discussions: true,
  has_pages: false,
  language: "Swift",
  size: 123,
  pushed_at: "2026-09-30T10:00:00Z",
  updated_at: "2026-09-30T10:01:00Z",
  stargazers_count: 7,
  default_branch: "main",
};

test("normalizes only public repositories owned by the configured GitHub account", () => {
  const normalized = normalizePortalPublicRepository(baseRepository, "Avkroken");
  if (!normalized) throw new Error("expected public repository");
  assert.equal(normalized.full_name, "Avkroken/Bastion");
  assert.equal(normalized.visibility, "public");
  assert.equal(normalized.archived, false);
  assert.equal(normalized.html_url, "https://github.com/Avkroken/Bastion");
  assert.deepEqual(normalized.topics, ["portal-project", "portal-blue"]);

  assert.equal(
    normalizePortalPublicRepository({ ...baseRepository, visibility: "private", private: true }, "Avkroken"),
    null,
  );
  assert.equal(
    normalizePortalPublicRepository({ ...baseRepository, archived: true }, "Avkroken"),
    null,
  );
  assert.equal(
    normalizePortalPublicRepository({ ...baseRepository, full_name: "Other/Bastion" }, "Avkroken"),
    null,
  );
});

test("sanitizes public repository metadata instead of forwarding provider payloads", () => {
  const normalized = normalizePortalPublicRepository({
    ...baseRepository,
    homepage: "http://insecure.invalid/",
    token: "must-not-leak",
    permissions: { admin: true },
    owner: { login: "Avkroken", private_field: "hidden" },
  }, "Avkroken");

  if (!normalized) throw new Error("expected sanitized public repository");
  assert.equal(normalized.homepage, null);
  assert.equal("token" in normalized, false);
  assert.equal("permissions" in normalized, false);
  assert.equal("owner" in normalized, false);
});

test("builds a bounded public snapshot with stable ordering", () => {
  const snapshot = buildPortalPublicRepositoriesSnapshot({
    generatedAt: "2026-09-30T10:02:00Z",
    owner: "Avkroken",
    repositories: [
      { ...baseRepository, name: "Produkter", full_name: "Avkroken/Produkter" },
      baseRepository,
      { ...baseRepository, name: "Private", full_name: "Avkroken/Private", visibility: "private", private: true },
    ],
    truncated: false,
  });

  assert.equal(snapshot.schemaVersion, 1);
  assert.equal(snapshot.status, "available");
  assert.equal(snapshot.truncated, false);
  assert.deepEqual(snapshot.repositories.map((repo) => repo.name), ["Bastion", "Produkter"]);
});
