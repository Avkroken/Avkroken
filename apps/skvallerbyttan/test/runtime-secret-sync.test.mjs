import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("runtime secret sync does not mutate the GitHub webhook secret", async () => {
  const workflow = await readFile(
    new URL("../../../.github/workflows/sync-skvallerbyttan-runtime-secrets.yml", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(workflow, /SKVALLERBYTTAN_WEBHOOK_SECRET/);
  assert.match(workflow, /vars\.GAMNACKEN_GITHUB_APP_CLIENT_ID/);
  assert.match(workflow, /secrets\.GAMNACKEN_GITHUB_APP_PRIVATE_KEY/);
  assert.doesNotMatch(workflow, /vars\.SKVALLERBYTTAN_GITHUB_APP_CLIENT_ID/);
  assert.doesNotMatch(workflow, /secrets\.SKVALLERBYTTAN_GITHUB_APP_PRIVATE_KEY/);
});
