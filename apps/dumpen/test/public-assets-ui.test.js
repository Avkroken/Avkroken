import assert from "node:assert/strict";
import test from "node:test";

import {
  bindAssetFilterChanges,
  filterAssetCards,
  filterAssetRecords,
  publicAssetsScript,
  resolveAssetFilter,
} from "../src/public-assets-ui.js";

function card(app, size, theme) {
  return { dataset: { app, size, theme }, hidden: false };
}

test("asset filters browse apps by default and use 1254 when only app or theme is selected", () => {
  const cards = [
    card("plex", "1254", "1"),
    card("plex", "512", "1"),
    card("plex", "256", "2"),
    card("sonarr", "1254", "1"),
  ];

  let result = filterAssetCards(cards);
  assert.equal(result.browseApps, true);
  assert.equal(result.visible, 0);
  assert.equal(result.message, "");
  assert.deepEqual(cards.map((item) => item.hidden), [true, true, true, true]);

  result = filterAssetCards(cards, { app: "plex" });
  assert.equal(result.effectiveSize, "1254");
  assert.equal(result.visible, 1);
  assert.equal(result.message, "1 bild visas.");
  assert.deepEqual(cards.map((item) => item.hidden), [false, true, true, true]);

  result = filterAssetCards(cards, { theme: "1" });
  assert.equal(result.visible, 2);
  assert.deepEqual(cards.map((item) => item.hidden), [false, true, true, false]);

  result = filterAssetCards(cards, { app: "plex", size: "256", theme: "2" });
  assert.equal(result.visible, 1);
  assert.deepEqual(cards.map((item) => item.hidden), [true, true, false, true]);
});

test("explicit alla storlekar removes the implicit 1254 restriction", () => {
  const assets = [
    { appCategory: "plex", pixelSize: 1254, theme: "1" },
    { appCategory: "plex", pixelSize: 512, theme: "1" },
    { appCategory: "plex", pixelSize: 256, theme: "1" },
  ];

  assert.deepEqual(resolveAssetFilter({ app: "plex" }), {
    app: "plex", size: "", theme: "", browseApps: false, effectiveSize: "1254",
  });
  assert.equal(filterAssetRecords(assets, { app: "plex" }).length, 1);
  assert.equal(filterAssetRecords(assets, { app: "plex", size: "all" }).length, 3);
});

test("each asset filter select binds the change handler used by the browser script", () => {
  const handlers = [];
  const selects = Array.from({ length: 3 }, () => ({
    addEventListener(type, handler) {
      assert.equal(type, "change");
      handlers.push(handler);
    },
  }));
  let applied = 0;
  const apply = () => { applied += 1; };

  bindAssetFilterChanges(selects, apply);
  assert.equal(handlers.length, 3);
  for (const handler of handlers) handler();
  assert.equal(applied, 3);

  const script = publicAssetsScript();
  assert.match(script, /filterAssetRecords/);
  assert.match(script, /bindAssetFilterChanges\(/);
  assert.match(script, /findPreview/);
  assert.match(script, /pixelSize===256/);
  assert.match(script, /replace-app-assets/);
});
