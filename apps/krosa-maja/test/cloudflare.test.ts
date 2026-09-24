import assert from "node:assert/strict";
import test from "node:test";
import { verifyCloudflareApiAccess } from "../src/cloudflare.ts";

test("Cloudflare API verification selects the linked account and never returns the bearer token", async () => {
  const auth = {
    api: {
      getAccessToken: async ({ body }: { body: { accountId: string } }) => {
        assert.equal(body.accountId, "cf-account-record");
        return { accessToken: "cf-secret-token" };
      },
    },
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input, init) => {
    assert.equal(new Headers(init?.headers).get("authorization"), "Bearer cf-secret-token");
    return new Response(JSON.stringify({
      success: true,
      result: { id: "cf-user", email: "user@example.test", first_name: "Test", last_name: "User" },
    }), { status: 200 });
  };
  try {
    const user = await verifyCloudflareApiAccess(
      auth as never,
      new Request("https://auth.example.test/admin", { headers: { cookie: "session=test" } }),
      [{ id: "cf-account-record", providerId: "cloudflare" }],
    );
    assert.deepEqual(user, {
      id: "cf-user",
      email: "user@example.test",
      firstName: "Test",
      lastName: "User",
    });
    assert.equal("accessToken" in user, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
