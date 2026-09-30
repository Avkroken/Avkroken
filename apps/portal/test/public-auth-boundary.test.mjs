import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";

const publicRoot = new URL("../public/", import.meta.url);
const workerUrl = new URL("../src/index.js", import.meta.url);

async function collectPublicTextFiles(directoryUrl) {
  const entries = await readdir(directoryUrl, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      files.push(
        ...(await collectPublicTextFiles(new URL(`${entry.name}/`, directoryUrl)))
      );
      continue;
    }

    if (/\.(?:css|html|js|json|svg|txt|xml)$/i.test(entry.name)) {
      files.push(new URL(entry.name, directoryUrl));
    }
  }

  return files;
}

test("public Portal assets exclude protected auth, session and machine-token contracts", async () => {
  const files = await collectPublicTextFiles(publicRoot);
  assert.ok(files.length > 0, "expected public text assets");

  const forbidden = [
    ["Jobb OAuth client secret", /GITHUB_OAUTH_CLIENT_SECRET/],
    ["Jobb allowlist", /JOBB_ALLOWED_GITHUB_IDS/],
    ["Jobb OAuth session cookie", /__Host-jobb_oauth/],
    ["Jobb authenticated session cookie", /__Host-jobb_session/],
    ["Turnstile secret", /TURNSTILE_SECRET/],
    ["Skvallerbyttan machine read token", /SKVALLERBYTTAN_READ_API_TOKEN/],
    ["private key material", /BEGIN (?:RSA )?PRIVATE KEY/]
  ];

  for (const file of files) {
    const source = await readFile(file, "utf8");
    for (const [label, pattern] of forbidden) {
      assert.doesNotMatch(source, pattern, `${file.pathname}: leaked ${label}`);
    }
  }
});

test("protected Jobb redirect is evaluated before Portal shell or asset rendering", async () => {
  const worker = await readFile(workerUrl, "utf8");

  const lookup = worker.indexOf(
    "const protectedRedirect = protectedRedirectForPath(url.pathname);"
  );
  const redirect = worker.indexOf(
    "return Response.redirect(protectedRedirect, 302);",
    lookup
  );
  const shellRoute = worker.indexOf(
    "isPortalDocumentRoute(url.pathname)",
    lookup
  );
  const assetFetch = worker.indexOf("env.ASSETS.fetch", lookup);

  assert.notEqual(lookup, -1, "protected redirect lookup must exist");
  assert.notEqual(redirect, -1, "protected redirect response must exist");
  assert.notEqual(shellRoute, -1, "Portal document fallback must exist");
  assert.notEqual(assetFetch, -1, "Portal asset fetch must exist");

  assert.ok(lookup < redirect, "redirect lookup must precede redirect");
  assert.ok(redirect < shellRoute, "protected redirect must precede shell routing");
  assert.ok(redirect < assetFetch, "protected redirect must precede asset rendering");
});

test("Portal shell fallback fetches the asset root without exposing an index redirect", async () => {
  const worker = await readFile(workerUrl, "utf8");
  assert.match(worker, /const shellUrl = new URL\("\/", url\.origin\);/);
  assert.doesNotMatch(worker, /const shellUrl = new URL\("\/index\.html", url\.origin\);/);
});
