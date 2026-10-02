import assert from "node:assert/strict";
import test from "node:test";

import {
  bindAssetFilterChanges,
  filterAssetCards,
  publicAssetsScript,
} from "../src/public-assets-ui.js";

function card(app, size, theme) {
  return { dataset: { app, size, theme }, hidden: false };
}

test("asset filters combine app, pixel size and theme and report visible count", () => {
  const cards = [
    card("plex", "256", "1"),
    card("plex", "512", "1"),
    card("plex", "256", "2"),
    card("sonarr", "256", "1"),
  ];

  let result = filterAssetCards(cards, { app: "plex" });
  assert.equal(result.visible, 3);
  assert.equal(result.message, "3 bilder matchar filtret.");
  assert.deepEqual(cards.map((item) => item.hidden), [false, false, false, true]);

  result = filterAssetCards(cards, { app: "plex", size: "256" });
  assert.equal(result.visible, 2);
  assert.deepEqual(cards.map((item) => item.hidden), [false, true, false, true]);

  result = filterAssetCards(cards, { app: "plex", size: "256", theme: "2" });
  assert.equal(result.visible, 1);
  assert.equal(result.message, "1 bild matchar filtret.");
  assert.deepEqual(cards.map((item) => item.hidden), [true, true, false, true]);

  result = filterAssetCards(cards);
  assert.equal(result.visible, 4);
  assert.equal(result.message, "");
  assert.deepEqual(cards.map((item) => item.hidden), [false, false, false, false]);
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
  assert.match(script, /filterAssetCards\(document\.querySelectorAll/);
  assert.match(script, /bindAssetFilterChanges\(/);
  assert.match(script, /asset\.themeLabel/);
});
