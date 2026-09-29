import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const publicFile = name => new URL(`../public/${name}`, import.meta.url);

function themeBody(css, name) {
  const match = css.match(new RegExp(`:root\\[data-theme="${name}"\\]\\s*\\{([\\s\\S]*?)\\}`));
  return match?.[1] || "";
}

test("Portal exposes Forest, Legacy and Blackout through one shared token layer", async () => {
  const [tokens, html, shell] = await Promise.all([
    readFile(publicFile("tokens.css"), "utf8"),
    readFile(publicFile("index.html"), "utf8"),
    readFile(publicFile("shell.js"), "utf8")
  ]);

  assert.match(tokens, /:root\[data-theme="forest"\]/);
  assert.match(tokens, /:root\[data-theme="legacy"\]/);
  assert.match(tokens, /:root\[data-theme="blackout"\]/);

  assert.match(html, /<html lang="sv" data-theme="legacy">/);
  assert.match(html, /<select id="portal-theme"/);
  assert.match(html, /<option value="legacy">Legacy<\/option>[\s\S]*<option value="forest">Avkroken<\/option>/);
  assert.match(html, /<option value="blackout">Blackout<\/option>/);

  assert.match(shell, /new Set\(\["legacy", "forest", "blackout"\]\)/);
  assert.match(shell, /const defaultTheme = "legacy"/);
  assert.match(shell, /avkroken\.theme/);
  assert.match(shell, /avkroken\.portal\.theme/);
  assert.match(shell, /avkroken_theme/);
  assert.match(shell, /Domain=\.denied\.se/);
  assert.match(shell, /document\.documentElement\.dataset\.theme = theme/);
  assert.match(shell, /localStorage\.setItem\(themeStorageKey, theme\)/);

  assert.doesNotMatch(html, /legacy\.css|blackout\.css|forest\.css/);
});

test("theme variants override primitive colors without duplicating semantic component tokens", async () => {
  const tokens = await readFile(publicFile("tokens.css"), "utf8");

  for (const theme of ["legacy", "blackout"]) {
    const body = themeBody(tokens, theme);
    assert.ok(body, `missing ${theme} theme body`);
    assert.match(body, /--ak-ink-950:/);
    assert.match(body, /--ak-paper-50:/);
    assert.match(body, /--ak-brass-500:/);

    assert.doesNotMatch(body, /--ak-surface-/);
    assert.doesNotMatch(body, /--ak-text-/);
    assert.doesNotMatch(body, /--ak-interactive-/);
    assert.doesNotMatch(body, /--ak-status-/);
    assert.doesNotMatch(body, /--ak-space-/);
    assert.doesNotMatch(body, /--ak-radius-/);
  }
});

test("theme control is labeled and uses shared focusable native controls", async () => {
  const [html, css] = await Promise.all([
    readFile(publicFile("index.html"), "utf8"),
    readFile(publicFile("portal-v2.css"), "utf8")
  ]);

  assert.match(html, /<label class="portal-theme-control" for="portal-theme">/);
  assert.match(html, /aria-label="Portaltema"/);
  assert.match(css, /\.portal-theme-control select\s*\{/);
  assert.match(css, /var\(--ak-border-default\)/);
  assert.match(css, /var\(--ak-text-primary\)/);
});
