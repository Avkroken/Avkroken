import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const publicFile = path => new URL(`../public/${path}`, import.meta.url);

const routes = [
  ["access-denied/index.html", "general", "Åtkomst nekad"],
  ["access-denied/identity/index.html", "identity", "Identiteten kunde inte verifieras"],
  ["access-denied/non-identity/index.html", "non-identity", "Åtkomst nekad av policy"],
  ["access-denied/gateway/index.html", "gateway", "Begäran blockerades av Gateway"]
];

test("denied routes are static noindex documents with shared token styling", async () => {
  for (const [path, kind, title] of routes) {
    const html = await readFile(publicFile(path), "utf8");
    assert.match(html, /<html lang="sv" data-theme="forest">/);
    assert.match(html, /<meta name="robots" content="noindex,nofollow">/);
    assert.match(html, /href="\/tokens\.css"/);
    assert.match(html, /href="\/styles\.css"/);
    assert.match(html, new RegExp(`data-denied-kind="${kind}"`));
    assert.ok(html.includes(title));
    assert.match(html, /aria-labelledby="denied-title"/);
    assert.doesNotMatch(html, /<script\b/i);
    assert.doesNotMatch(html, /<form\b/i);
  }
});

test("404 keeps stylesheet links inside head without literal escape text", async () => {
  const html = await readFile(publicFile("404.html"), "utf8");
  assert.match(
    html,
    /href="\/tokens\.css">\n\s*<link rel="stylesheet" href="\/styles\.css">/
  );
  assert.doesNotMatch(html, /tokens\.css">\\n/);
});

test("Access and Gateway denial semantics remain distinct", async () => {
  const identity = await readFile(publicFile("access-denied/identity/index.html"), "utf8");
  const policy = await readFile(publicFile("access-denied/non-identity/index.html"), "utf8");
  const gateway = await readFile(publicFile("access-denied/gateway/index.html"), "utf8");

  assert.match(identity, /Cloudflare Access-fel/);
  assert.match(identity, /autentisering eller identity/);
  assert.match(policy, /Access deny/);
  assert.match(policy, /Gateway och originens egna 401\/403 är separata lager/);
  assert.match(gateway, /Cloudflare Gateway/);
  assert.match(gateway, /skild från Cloudflare Access/);
});

test("denied component keeps visible focus and responsive token-driven layout", async () => {
  const css = await readFile(publicFile("styles.css"), "utf8");
  assert.match(css, /\.button:focus-visible\s*\{/);
  assert.match(css, /outline:\s*var\(--ak-border-2\) solid var\(--ak-focus-ring\)/);
  assert.match(css, /padding:\s*clamp\(20px, 5vw, 48px\)/);
  assert.match(css, /var\(--ak-surface-canvas\)/);
  assert.match(
    css,
    /\.denied-detail\s*\{[\s\S]*?color:\s*var\(--ak-text-secondary\)/
  );
});
