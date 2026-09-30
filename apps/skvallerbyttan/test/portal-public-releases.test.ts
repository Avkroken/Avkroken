import test from "node:test";
import assert from "node:assert/strict";
import { normalizePortalPublicRelease } from "../src/portal-release-model";

test("public release projection keeps only bounded public fields and derives categories", () => {
  const release = normalizePortalPublicRelease({
    id: 42,
    tag_name: "v1.2.3",
    name: "Release 1.2.3",
    html_url: "https://github.com/Avkroken/Bastion/releases/tag/v1.2.3",
    published_at: "2026-09-30T12:00:00Z",
    prerelease: false,
    draft: false,
    body: "## Features\n- Something\n## Security\n- Hardening",
    author: { login: "hidden" },
    assets: [{ name: "hidden" }],
  }, "Avkroken/Bastion");

  assert.deepEqual(release, {
    id: "42",
    tag_name: "v1.2.3",
    name: "Release 1.2.3",
    html_url: "https://github.com/Avkroken/Bastion/releases/tag/v1.2.3",
    published_at: "2026-09-30T12:00:00Z",
    prerelease: false,
    categories: ["releases", "features", "security"],
  });
});

test("drafts and release URLs outside the expected repository are rejected", () => {
  assert.equal(normalizePortalPublicRelease({
    id: 1,
    tag_name: "v1",
    html_url: "https://github.com/Avkroken/Bastion/releases/tag/v1",
    published_at: "2026-09-30T12:00:00Z",
    draft: true,
  }, "Avkroken/Bastion"), null);

  assert.equal(normalizePortalPublicRelease({
    id: 1,
    tag_name: "v1",
    html_url: "https://github.com/Other/Bastion/releases/tag/v1",
    published_at: "2026-09-30T12:00:00Z",
  }, "Avkroken/Bastion"), null);
});
