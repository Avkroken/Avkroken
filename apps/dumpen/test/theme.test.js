import test from "node:test";
import assert from "node:assert/strict";
import { themeControl, themeCss, themeScript } from "../src/theme.js";
import { homePage } from "../src/page.js";
import { publicPage } from "../src/public-page.js";
import { renderGitHubLoginPage } from "../src/github-auth.js";

test("shared theme contract keeps Dumpen product accents", () => {
  const css = themeCss();
  const control = themeControl();
  const script = themeScript();

  assert.match(css, /:root\[data-theme="forest"\]/);
  assert.match(css, /:root\[data-theme="blackout"\]/);
  assert.match(css, /--accent:#74f04a/);
  assert.match(css, /--secondary:#9b7cff/);
  assert.match(css, /--surface-raised:#121a16/);
  assert.match(css, /--shadow-lg:/);
  assert.match(css, /background-size:64px 64px/);
  assert.match(control, /value="legacy">Aurora/);
  assert.match(control, /value="forest">Avkroken/);
  assert.match(script, /avkroken\.theme/);
  assert.match(script, /avkroken_theme/);
  assert.match(script, /Domain=\.denied\.se/);
});

test("Dumpen main pages use Aurora fallback and expose the selector", () => {
  const dashboard = homePage(
    { totalBytes: 0, objectCount: 0, oldestDays: null },
    { maxBucketBytes: 524288000, automaticDeletion: false, ticketTtlMinutes: 10, adminPage: false },
  );
  const publicHtml = publicPage();

  for (const html of [dashboard, publicHtml]) {
    assert.match(html, /data-theme="legacy"/);
    assert.match(html, /id="theme-select"/);
    assert.match(html, /value="legacy">Aurora/);
    assert.match(html, /value="blackout">Blackout/);
    assert.match(html, /Avkroken \/ Dumpen/);
    assert.match(html, /class="gradient-text">DUMPEN/);
    assert.match(html, /R2 · Transferer · Assets/);
  }
});

test("Dumpen front page follows the shared Avkroken landing-page structure", () => {
  const html = publicPage();

  assert.match(html, /class="brand-mini"/);
  assert.match(html, /class="brand-dot"/);
  assert.match(html, /class="hero"/);
  assert.match(html, /class="manifesto"/);
  assert.match(html, /class="access-card"/);
  assert.match(html, /class="info-grid"/);
  assert.match(html, /class="button-link" href="\/admin"/);
});
