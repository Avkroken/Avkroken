import assert from "node:assert/strict";
import test from "node:test";
import { getAllowedGitHubUserInfo } from "../src/github.ts";

test("GitHub profile is accepted only when numeric ID is allowlisted and email is verified", async () => {
  const originalFetch = globalThis.fetch;
  const responses = [
    new Response(JSON.stringify({ id: 123, login: "tester", name: null, avatar_url: "https://example.test/a.png" }), { status: 200 }),
    new Response(JSON.stringify([
      { email: "unverified@example.test", primary: true, verified: false },
      { email: "verified@example.test", primary: false, verified: true },
    ]), { status: 200 }),
  ];
  globalThis.fetch = async () => responses.shift() ?? new Response(null, { status: 500 });
  try {
    const result = await getAllowedGitHubUserInfo("token", new Set(["123"]));
    assert.equal(result?.user.email, "verified@example.test");
    assert.equal(result?.user.emailVerified, true);
    assert.equal(result?.user.name, "tester");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("GitHub profile is rejected before local identity creation when ID is not allowlisted", async () => {
  const originalFetch = globalThis.fetch;
  const responses = [
    new Response(JSON.stringify({ id: 999, login: "outsider" }), { status: 200 }),
    new Response(JSON.stringify([{ email: "x@example.test", primary: true, verified: true }]), { status: 200 }),
  ];
  globalThis.fetch = async () => responses.shift() ?? new Response(null, { status: 500 });
  try {
    const result = await getAllowedGitHubUserInfo("token", new Set(["123"]));
    assert.equal(result, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
