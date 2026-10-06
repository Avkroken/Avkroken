import assert from "node:assert/strict";
import test from "node:test";

import {
  bindAssetFilterChanges,
  filterAssetCards,
  filterAssetRecords,
  publicAssetsScript,
  resolveAssetFilter,
  sortAssetRecords,
} from "../src/public-assets-ui.js";

function card(app, size, theme, name = "", key = "") {
  return { dataset: { app, size, theme, name, key }, hidden: false };
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

  result = filterAssetCards(cards, { app: "plex" });
  assert.equal(result.effectiveSize, "1254");
  assert.equal(result.visible, 1);

  result = filterAssetCards(cards, { theme: "1" });
  assert.equal(result.visible, 2);

  result = filterAssetCards(cards, { app: "plex", size: "256", theme: "2" });
  assert.equal(result.visible, 1);
});

test("search turns app browser into filtered results and combines with facets", () => {
  const assets = [
    { name: "plex-1.png", key: "apps/plex/plex-1.png", appCategory: "plex", appLabel: "Plex", pixelSize: 1254, theme: "1", themeLabel: "Neon Glass" },
    { name: "sonarr-1.png", key: "apps/sonarr/sonarr-1.png", appCategory: "sonarr", appLabel: "Sonarr", pixelSize: 1254, theme: "1", themeLabel: "Neon Glass" },
  ];

  const resolved = resolveAssetFilter({ search: "plex" });
  assert.equal(resolved.browseApps, false);
  assert.equal(resolved.search, "plex");
  assert.equal(filterAssetRecords(assets, { search: "plex" }).length, 1);
  assert.equal(filterAssetRecords(assets, { search: "neon", app: "sonarr" }).length, 1);
});

test("explicit alla storlekar removes the implicit 1254 restriction", () => {
  const assets = [
    { appCategory: "plex", pixelSize: 1254, theme: "1" },
    { appCategory: "plex", pixelSize: 512, theme: "1" },
    { appCategory: "plex", pixelSize: 256, theme: "1" },
  ];

  assert.deepEqual(resolveAssetFilter({ app: "plex" }), {
    app: "plex", size: "", theme: "", search: "", browseApps: false, effectiveSize: "1254",
  });
  assert.equal(filterAssetRecords(assets, { app: "plex" }).length, 1);
  assert.equal(filterAssetRecords(assets, { app: "plex", size: "all" }).length, 3);
});

test("asset sorting supports newest, name and size", () => {
  const assets = [
    { name: "b.png", size: 2, uploadedAt: "2026-10-01T00:00:00Z" },
    { name: "a.png", size: 3, uploadedAt: "2026-10-02T00:00:00Z" },
  ];
  assert.deepEqual(sortAssetRecords(assets, "newest").map((x) => x.name), ["a.png", "b.png"]);
  assert.deepEqual(sortAssetRecords(assets, "name").map((x) => x.name), ["a.png", "b.png"]);
  assert.deepEqual(sortAssetRecords(assets, "size").map((x) => x.name), ["a.png", "b.png"]);
});

test("media library script contains queue, progress, clipboard and item mutations", () => {
  const handlers = [];
  const selects = Array.from({ length: 4 }, () => ({
    addEventListener(type, handler) {
      assert.equal(type, "change");
      handlers.push(handler);
    },
  }));
  let applied = 0;
  bindAssetFilterChanges(selects, () => { applied += 1; });
  for (const handler of handlers) handler();
  assert.equal(applied, 4);

  const script = publicAssetsScript();
  assert.doesNotThrow(() => new Function(script));
  assert.match(script, /XMLHttpRequest/);
  assert.match(script, /xhr\.upload\.onprogress/);
  assert.match(script, /clipboardData/);
  assert.match(script, /Promise\.all\(batch\.map\(uploadItem\)\)/);
  assert.match(script, /\/admin\/api\/assets\/uploads/);
  assert.match(script, /\/admin\/api\/assets\/item/);
  assert.match(script, /asset_upload_busy/);
  assert.match(script, /asset\.mutable === true/);
  assert.match(script, /showModal/);
});
