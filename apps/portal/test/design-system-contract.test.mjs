import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const tokens = await readFile(new URL("../public/tokens.css", import.meta.url), "utf8");
const styles = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");
const mobile = await readFile(new URL("../public/mobile.css", import.meta.url), "utf8");
const portal = await readFile(new URL("../public/portal-v2.css", import.meta.url), "utf8");
const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");

function declarations(css) {
  return new Map(
    [...css.matchAll(/(--ak-[a-z0-9-]+)\s*:\s*([^;]+);/g)]
      .map(match => [match[1], match[2].trim()])
  );
}

const runtimeTokens = declarations(tokens);

test("Portal loads the runtime token layer before stylesheet consumers", () => {
  const tokensIndex = html.indexOf('href="/tokens.css"');
  const stylesIndex = html.indexOf('href="/styles.css"');
  const mobileIndex = html.indexOf('href="/mobile.css"');
  const portalIndex = html.indexOf('href="/portal-v2.css"');

  assert.ok(tokensIndex >= 0, "tokens.css must be loaded");
  assert.ok(stylesIndex > tokensIndex, "styles.css must load after tokens.css");
  assert.ok(mobileIndex > tokensIndex, "mobile.css must load after tokens.css");
  assert.ok(portalIndex > tokensIndex, "portal-v2.css must load after tokens.css");
});

test("runtime tokens expose the documented Portal v2 foundation", () => {
  const required = [
    "--ak-ink-950",
    "--ak-ink-900",
    "--ak-ink-850",
    "--ak-ink-800",
    "--ak-ink-700",
    "--ak-ink-600",
    "--ak-mist-500",
    "--ak-mist-300",
    "--ak-mist-100",
    "--ak-paper-50",
    "--ak-moss-500",
    "--ak-moss-300",
    "--ak-brass-500",
    "--ak-brass-300",
    "--ak-ember-500",
    "--ak-ember-300",
    "--ak-sky-500",
    "--ak-sky-300",
    "--ak-surface-canvas",
    "--ak-surface-sunken",
    "--ak-surface-default",
    "--ak-surface-raised",
    "--ak-surface-interactive",
    "--ak-border-subtle",
    "--ak-border-default",
    "--ak-text-primary",
    "--ak-text-secondary",
    "--ak-text-tertiary",
    "--ak-accent-default",
    "--ak-accent-strong",
    "--ak-focus-ring",
    "--ak-status-success",
    "--ak-status-warning",
    "--ak-status-danger",
    "--ak-status-info",
    "--ak-space-0",
    "--ak-space-1",
    "--ak-space-2",
    "--ak-space-3",
    "--ak-space-4",
    "--ak-space-5",
    "--ak-space-6",
    "--ak-space-8",
    "--ak-space-10",
    "--ak-space-12",
    "--ak-space-16",
    "--ak-space-20",
    "--ak-radius-1",
    "--ak-radius-2",
    "--ak-radius-3",
    "--ak-radius-4",
    "--ak-radius-pill",
    "--ak-elevation-1",
    "--ak-elevation-2",
    "--ak-breakpoint-mobile",
    "--ak-breakpoint-tablet",
    "--ak-breakpoint-desktop",
  ];

  for (const token of required) {
    assert.ok(runtimeTokens.has(token), `missing runtime design token: ${token}`);
  }

  assert.match(tokens, /color-scheme:\s*dark;/);
});

test("semantic color tokens alias the primitive foundation", () => {
  const semantic = [
    "--ak-surface-canvas",
    "--ak-surface-sunken",
    "--ak-surface-default",
    "--ak-surface-raised",
    "--ak-surface-interactive",
    "--ak-border-subtle",
    "--ak-border-default",
    "--ak-text-primary",
    "--ak-text-secondary",
    "--ak-text-tertiary",
    "--ak-accent-default",
    "--ak-accent-strong",
    "--ak-focus-ring",
    "--ak-status-success",
    "--ak-status-warning",
    "--ak-status-danger",
    "--ak-status-info",
  ];

  for (const token of semantic) {
    assert.match(
      runtimeTokens.get(token) || "",
      /^var\(--ak-(?:ink|mist|paper|moss|brass|ember|sky)-/,
      `${token} must resolve through a primitive color token`
    );
  }
});

test("consumer styles do not redeclare the canonical --ak token namespace", () => {
  for (const [name, css] of [
    ["styles.css", styles],
    ["mobile.css", mobile],
    ["portal-v2.css", portal],
  ]) {
    assert.deepEqual(
      [...declarations(css).keys()],
      [],
      `${name} must consume, not redefine, the --ak token namespace`
    );
  }
});

test("Portal shell consumes semantic focus, surface, text and status tokens", () => {
  for (const token of [
    "--ak-surface-canvas",
    "--ak-surface-default",
    "--ak-text-primary",
    "--ak-text-secondary",
    "--ak-accent-default",
    "--ak-focus-ring",
    "--ak-status-info",
  ]) {
    assert.ok(
      portal.includes(`var(${token})`),
      `portal-v2.css must consume ${token}`
    );
  }
});
