import assert from "node:assert/strict";
import test from "node:test";

import {
  bindAssetFilterChanges,
  filterAssetCards,
  filterAssetRecords,
  publicAssetsMarkup,
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

test("type facet separates app images, generic images and files", () => {
  const assets = [
    { name: "plex-256.png", key: "apps/plex/plex-256.png", image: true, appCategory: "plex", pixelSize: 256, assetRole: "launcher" },
    { name: "plex-1.png", key: "apps/plex/plex-1.png", image: true, appCategory: "plex", pixelSize: 1254, theme: "1", assetRole: "theme" },
    { name: "photo.png", key: "uploads/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/photo.png", image: true },
    { name: "notes.txt", key: "uploads/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb/notes.txt", image: false },
  ];

  assert.equal(resolveAssetFilter({ type: "image" }).browseApps, false);
  assert.deepEqual(filterAssetRecords(assets, { type: "launcher" }).map((asset) => asset.name), ["plex-256.png"]);
  assert.deepEqual(filterAssetRecords(assets, { type: "app" }).map((asset) => asset.name), ["plex-1.png"]);
  assert.deepEqual(filterAssetRecords(assets, { type: "image" }).map((asset) => asset.name), ["photo.png"]);
  assert.deepEqual(filterAssetRecords(assets, { type: "file" }).map((asset) => asset.name), ["notes.txt"]);
});

test("launcher filter does not inherit original 1254 size", () => {
  const resolved = resolveAssetFilter({ app: "tautulli", type: "launcher" });
  assert.equal(resolved.effectiveSize, "");
  assert.equal(resolved.browseApps, false);

  const assets = [
    { name: "tautulli-256.png", image: true, appCategory: "tautulli", pixelSize: 256, assetRole: "launcher" },
    { name: "tautulli-1.png", image: true, appCategory: "tautulli", pixelSize: 1254, theme: "1", assetRole: "theme" },
  ];
  assert.deepEqual(filterAssetRecords(assets, { app: "tautulli", type: "launcher" }).map((asset) => asset.name), ["tautulli-256.png"]);
});

test("explicit alla storlekar removes the implicit 1254 restriction", () => {
  const assets = [
    { appCategory: "plex", pixelSize: 1254, theme: "1" },
    { appCategory: "plex", pixelSize: 512, theme: "1" },
    { appCategory: "plex", pixelSize: 256, theme: "1" },
  ];

  assert.deepEqual(resolveAssetFilter({ app: "plex" }), {
    app: "plex", size: "", theme: "", type: "", search: "", browseApps: false, effectiveSize: "1254",
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

test("media library markup exposes the production runtime marker", () => {
  assert.match(publicAssetsMarkup(), /data-media-library-version="3"/);
  assert.match(publicAssetsMarkup(), /data-deployment-contract="provider-version"/);
});

test("media library uses one native iOS-compatible file input", () => {
  const markup = publicAssetsMarkup();
  assert.match(markup, /id="asset-files" type="file" multiple/);
  assert.match(markup, /Bilder, kamera och iCloud Drive/);
  assert.match(markup, /Launcher-loggor/);
  assert.match(markup, /Temabilder/);
  assert.doesNotMatch(markup, /id="asset-photo-files"/);
  assert.doesNotMatch(markup, /id="choose-assets"/);

  const script = publicAssetsScript();
  assert.doesNotMatch(script, /asset-files"\)\.click\(\)/);
  assert.doesNotMatch(script, /asset-replace-file"\)\.click\(\)/);
  assert.doesNotMatch(script, /#asset-photo-files/);
});

test("iOS file selection handles input and change without duplicate staging", () => {
  const script = publicAssetsScript();
  assert.match(script, /on\("#asset-files", "input", handleFileSelection\)/);
  assert.match(script, /on\("#asset-files", "change", handleFileSelection\)/);
  assert.match(script, /event\.currentTarget/);
  assert.match(script, /input\.value = ""/);
});

test("staging happens before preview generation", () => {
  const script = publicAssetsScript();
  const addFilesStart = script.indexOf("function addFiles");
  const renderQueueIndex = script.indexOf("renderQueue();", addFilesStart);
  const previewIndex = script.indexOf("URL.createObjectURL", addFilesStart);
  assert.ok(addFilesStart >= 0);
  assert.ok(renderQueueIndex > addFilesStart);
  assert.ok(previewIndex > renderQueueIndex);
});

test("file selection stages visibly behind an explicit upload action", () => {
  const markup = publicAssetsMarkup();
  assert.match(markup, /id="asset-files" type="file" multiple/);
  assert.doesNotMatch(markup, /id="asset-photo-files"/);
  assert.match(markup, /id="asset-queue-panel"/);
  assert.match(markup, /id="asset-upload-button"/);
  assert.match(markup, /Valda filer/);
  assert.match(markup, /Ladda upp/);

  const script = publicAssetsScript();
  assert.match(script, /state:"staged"/);
  assert.match(script, /#asset-upload-button/);
  assert.match(script, /startSelectedUpload/);
});

test("theme metadata is hidden in auto mode instead of rendered disabled", () => {
  const markup = publicAssetsMarkup();
  assert.match(markup, /id="asset-theme-config"[^>]*hidden/);
  assert.doesNotMatch(markup, /id="asset-upload-app" disabled/);
  assert.doesNotMatch(markup, /id="asset-upload-theme" disabled/);
  assert.doesNotMatch(markup, /id="asset-upload-size" disabled/);
});

test("browser script defines the esbuild name helper before serialized functions", () => {
  const script = publicAssetsScript();
  assert.match(script, /^const __name=\(target\)=>target;/);
  assert.ok(script.indexOf("const __name=") < script.indexOf("const resolveAssetFilter="));
});

test("media library bootstrap exports loaders before guarded bindings", () => {
  const markup = publicAssetsMarkup();
  assert.match(markup, /id="asset-apps"/);
  assert.match(markup, /Laddar mediebibliotek/);

  const script = publicAssetsScript();
  assert.match(script, /window\.loadAssets=loadAssets/);
  assert.match(script, /media-library-bootstrap/);
  assert.match(script, /dumpenClientError/);
});

test("media library script contains queue, progress, clipboard and item mutations", () => {
  const handlers = [];
  const selects = Array.from({ length: 5 }, () => ({
    addEventListener(type, handler) {
      assert.equal(type, "change");
      handlers.push(handler);
    },
  }));
  let applied = 0;
  bindAssetFilterChanges(selects, () => { applied += 1; });
  for (const handler of handlers) handler();
  assert.equal(applied, 5);

  const script = publicAssetsScript();
  assert.doesNotThrow(() => new Function(script));
  assert.match(script, /XMLHttpRequest/);
  assert.match(script, /xhr\.upload\.onprogress/);
  assert.match(script, /clipboardData/);
  assert.match(script, /Promise\.all\(batch\.map\(uploadItem\)\)/);
  assert.match(script, /\/admin\/api\/assets\/uploads/);
  assert.match(script, /\/admin\/api\/assets\/item/);
  assert.match(script, /asset_upload_busy/);
  assert.match(script, /setTimeout\(runQueue, 0\)/);
  assert.match(script, /Manuell temabild kräver exakt en vald fil/);
  assert.match(script, /state === "staged"/);
  assert.match(script, /uploadConfig/);
  assert.match(script, /#asset-filter-type/);
  assert.match(script, /asset\.mutable === true/);
  assert.match(script, /showModal/);
});
