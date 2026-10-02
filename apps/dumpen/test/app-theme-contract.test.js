import assert from "node:assert/strict";
import test from "node:test";

import {
  APP_THEME_APPS,
  APP_THEME_IDS,
  APP_THEME_LABELS,
  appThemeLabel,
} from "../src/app-theme-contract.js";

test("theme contract exposes seven semantic themes for eight apps", () => {
  assert.equal(APP_THEME_APPS.length, 8);
  assert.deepEqual(APP_THEME_IDS, [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(
    APP_THEME_IDS.map((theme) => appThemeLabel(theme)),
    [
      "Neon Glass",
      "Cyan Blueprint",
      "Isometric Console",
      "Illustrated Scene",
      "Emerald Radar",
      "Emerald Core",
      "Azure Orbit",
    ],
  );
  assert.equal(Object.keys(APP_THEME_LABELS).length, 7);
  assert.equal(APP_THEME_APPS.length * APP_THEME_IDS.length, 56);
});

test("unknown theme ids retain a readable fallback label", () => {
  assert.equal(appThemeLabel(8), "Tema 8");
  assert.equal(appThemeLabel(""), null);
});
