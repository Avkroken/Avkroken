import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Jobb reuses the existing shared GitHub OAuth secret through a neutral binding", async () => {
  const raw = await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8");
  const config = JSON.parse(raw);
  const binding = config.secrets_store_secrets?.find(
    item => item.binding === "GITHUB_OAUTH_CLIENT_SECRET"
  );

  assert.deepEqual(binding && {
    binding: binding.binding,
    secret_name: binding.secret_name
  }, {
    binding: "GITHUB_OAUTH_CLIENT_SECRET",
    secret_name: "KROSA_MAJA_CLIENT_SECRET"
  });

  assert.equal(
    config.secrets_store_secrets?.some(item => item.binding === "KROSA_MAJA_CLIENT_SECRET"),
    false
  );
});
