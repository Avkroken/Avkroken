import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const shell = await readFile(new URL("../public/shell.js", import.meta.url), "utf8");
const css = await readFile(new URL("../public/portal-v2.css", import.meta.url), "utf8");
const browser = await readFile(new URL("./browser-a11y.mjs", import.meta.url), "utf8");

test("skip-link targets a programmatically focusable main landmark", () => {
  assert.match(
    html,
    /<main class="shell portal-main" id="portal-content" tabindex="-1">/
  );
  assert.match(html, /<a class="skip-link" href="#portal-content">/);
});

test("SPA navigation moves focus to the active page heading", () => {
  assert.ok(shell.includes("function focusViewHeading(view)"));
  assert.ok(shell.includes('panel?.querySelector("h1")'));
  assert.ok(shell.includes("heading.focus({ preventScroll: true })"));
  assert.ok(shell.includes("applyRoute({ focus: true })"));
  assert.ok(shell.includes('window.addEventListener("popstate", () => applyRoute({ focus: true }))'));
});

test("Escape closes an open mobile menu and returns focus to its toggle", () => {
  assert.ok(shell.includes("closeMenu({ restoreFocus: true })"));
  assert.ok(shell.includes("menuToggle.focus()"));
  assert.ok(shell.includes('if (event.key !== "Escape") return;'));
});

test("browser gate uses installed ChromeDriver, axe and mobile overflow assertions", () => {
  assert.ok(browser.includes('spawn("chromedriver"'));
  assert.ok(browser.includes("axe.run(document"));
  assert.ok(browser.includes("wcag22aa"));
  assert.ok(browser.includes("scrollWidth <= overflow.clientWidth + 1"));
  assert.ok(browser.includes('"portal-menu-toggle"'));
});


test("mobile hero grid items may shrink inside the viewport", () => {
  assert.match(
    css,
    /\.portal-hero-copy,\s*\.portal-hero-aside\s*\{\s*min-width:\s*0;\s*\}/
  );
});
