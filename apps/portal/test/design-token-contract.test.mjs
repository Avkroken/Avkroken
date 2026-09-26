import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const publicFile = name => new URL(`../public/${name}`, import.meta.url);

test("Portal v2 exposes the required design token families", async () => {
  const css = await readFile(publicFile("tokens.css"), "utf8");
  const requiredTokens = [
    "--ak-surface-canvas:",
    "--ak-border-default:",
    "--ak-text-primary:",
    "--ak-interactive-surface:",
    "--ak-status-success:",
    "--ak-font-sans:",
    "--ak-font-mono:",
    "--ak-type-display-size:",
    "--ak-type-heading-1-size:",
    "--ak-type-heading-2-size:",
    "--ak-type-body-size:",
    "--ak-type-small-size:",
    "--ak-type-label-size:",
    "--ak-line-height-body:",
    "--ak-space-4:",
    "--ak-radius-3:",
    "--ak-elevation-1:",
    "--ak-focus-ring:",
    "--ak-motion-duration-fast:",
    "--ak-motion-duration-standard:",
    "--ak-motion-duration-reduced:",
    "--ak-motion-ease-standard:",
    "--ak-breakpoint-mobile:",
    "--ak-breakpoint-tablet:",
    "--ak-breakpoint-desktop:"
  ];

  for (const token of requiredTokens) {
    assert.ok(css.includes(token), token);
  }
});

test("Portal runtime consumes shared typography and motion tokens", async () => {
  const [foundation, portal] = await Promise.all([
    readFile(publicFile("styles.css"), "utf8"),
    readFile(publicFile("portal-v2.css"), "utf8")
  ]);

  assert.match(foundation, /font-family:\s*var\(--ak-font-sans\)/);
  assert.match(foundation, /var\(--ak-motion-duration-standard\)/);
  assert.match(portal, /font-family:\s*var\(--ak-font-mono\)/);
  assert.match(portal, /var\(--ak-motion-duration-fast\)/);
  assert.match(portal, /var\(--ak-motion-duration-reduced\)/);
  assert.match(portal, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
});
