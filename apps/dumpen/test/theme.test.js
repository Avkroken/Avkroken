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
  assert.match(css, /--accent:#6ee71e/);
  assert.match(css, /--secondary:#a66cff/);
  assert.match(css, /rgba\(36,231,232,.11\)/);
  assert.match(css, /rgba\(213,29,203,.10\)/);
  assert.match(css, /background-size:42px 42px/);
  assert.match(control, /value="legacy">Legacy/);
  assert.match(control, /value="forest">Avkroken/);
  assert.match(script, /avkroken\.theme/);
  assert.match(script, /avkroken_theme/);
  assert.match(script, /Domain=\.denied\.se/);
});

test("Dumpen main pages use Legacy fallback and expose the selector", () => {
  const dashboard = homePage(
    { totalBytes: 0, objectCount: 0, oldestDays: null },
    { maxBucketBytes: 524288000, retentionDays: 7, ticketTtlMinutes: 10, adminPage: false },
  );
  const publicHtml = publicPage();

  for (const html of [dashboard, publicHtml]) {
    assert.match(html, /data-theme="legacy"/);
    assert.match(html, /id="theme-select"/);
    assert.match(html, /value="legacy">Legacy/);
    assert.match(html, /value="blackout">Blackout/);
  }
});
