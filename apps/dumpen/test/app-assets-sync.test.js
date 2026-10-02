import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { APP_ASSET_APPS, syncAppAssets } from "../scripts/app-assets-sync.mjs";

function fakeImageAdapter(sourceSize = 1254) {
  const dimensions = new Map();

  function image(file) {
    let requestedSize = null;
    return {
      async metadata() {
        if (dimensions.has(file)) return dimensions.get(file);
        if (file.includes(path.sep + "source" + path.sep)) {
          const size = typeof sourceSize === "function" ? sourceSize(file) : sourceSize;
          return { width: size, height: size };
        }
        return {};
      },
      resize(width, height, options) {
        assert.equal(width, height);
        assert.deepEqual(options, { fit: "contain", withoutEnlargement: true });
        requestedSize = width;
        return this;
      },
      png() {
        return this;
      },
      async toFile(destination) {
        assert.ok(requestedSize);
        dimensions.set(destination, { width: requestedSize, height: requestedSize });
      },
    };
  }

  return image;
}

test("app asset contract contains seven synchronized themes for all eight apps", () => {
  assert.equal(Object.keys(APP_ASSET_APPS).length, 8);
  for (const themes of Object.values(APP_ASSET_APPS)) {
    assert.deepEqual(themes, [1, 2, 3, 4, 5, 6, 7]);
  }
  assert.equal(Object.values(APP_ASSET_APPS).flat().length, 56);
});

test("app asset sync launches Wrangler through Node instead of platform cmd shims", async () => {
  const wrapper = await readFile(new URL("../scripts/sync-app-assets.mjs", import.meta.url), "utf8");
  assert.match(wrapper, /process\.execPath/);
  assert.match(wrapper, /import\.meta\.resolve\("wrangler"\)/);
  assert.doesNotMatch(wrapper, /wrangler\.cmd/);
});

test("app asset sync requires fresh live sources before upload", async () => {
  let wranglerCalls = 0;
  await assert.rejects(
    syncAppAssets({
      workRoot: "/tmp/dumpen-assets-test",
      shouldFetch: false,
      shouldUpload: true,
      apps: { demo: [1] },
      wrangler: async () => { wranglerCalls += 1; },
      image: fakeImageAdapter(),
    }),
    /--upload requires --fetch/,
  );
  assert.equal(wranglerCalls, 0);
});

test("app asset sync validates the full batch before the first live put", async () => {
  const calls = [];
  await assert.rejects(
    syncAppAssets({
      workRoot: path.resolve("/tmp/dumpen-assets-test"),
      shouldFetch: true,
      shouldUpload: true,
      apps: { demo: [1, 2] },
      sizes: [256, 512],
      sourceSize: 1254,
      bucket: "test-assets",
      wrangler: async (args) => { calls.push(args); },
      image: fakeImageAdapter((file) => file.endsWith("demo-2.png") ? 1000 : 1254),
      mkdirFn: async () => {},
      readFileFn: async () => new Uint8Array([1]),
    }),
    /Source apps\/demo\/demo-2\.png must be 1254×1254; observed 1000×1000\./,
  );
  assert.deepEqual(calls.map((args) => args.slice(0, 3)), [
    ["r2", "object", "get"],
    ["r2", "object", "get"],
  ]);
  assert.equal(calls.some((args) => args[2] === "put"), false);
});

test("app asset sync writes exactly canonical and hotlink mirror variants", async () => {
  const calls = [];
  const workRoot = path.resolve("/tmp/dumpen-assets-test");
  const result = await syncAppAssets({
    workRoot,
    shouldFetch: true,
    shouldUpload: true,
    apps: { demo: [1] },
    sizes: [256, 512],
    sourceSize: 1254,
    bucket: "test-assets",
    wrangler: async (args) => { calls.push(args); },
    image: fakeImageAdapter(),
    mkdirFn: async () => {},
    readFileFn: async () => new Uint8Array([1, 2, 3]),
  });

  assert.equal(result.sources, 1);
  assert.equal(result.generated, 2);
  assert.equal(result.uploadedObjects, 4);
  assert.deepEqual(result.variants.map(({ key, size, bytes }) => ({ key, size, bytes })), [
    { key: "apps/demo/demo-1-256.png", size: 256, bytes: 3 },
    { key: "apps/demo/demo-1-512.png", size: 512, bytes: 3 },
  ]);

  const source = path.join(workRoot, "source", "demo-1.png");
  const generated = path.join(workRoot, "generated", "apps", "demo");
  assert.deepEqual(calls, [
    ["r2", "object", "get", "test-assets/apps/demo/demo-1.png", "--remote", "--file", source],
    ["r2", "object", "put", "test-assets/apps/demo/demo-1-256.png", "--remote", "--file", path.join(generated, "demo-1-256.png"), "--content-type", "image/png"],
    ["r2", "object", "put", "test-assets/hotlink-ok/apps/demo/demo-1-256.png", "--remote", "--file", path.join(generated, "demo-1-256.png"), "--content-type", "image/png"],
    ["r2", "object", "put", "test-assets/apps/demo/demo-1-512.png", "--remote", "--file", path.join(generated, "demo-1-512.png"), "--content-type", "image/png"],
    ["r2", "object", "put", "test-assets/hotlink-ok/apps/demo/demo-1-512.png", "--remote", "--file", path.join(generated, "demo-1-512.png"), "--content-type", "image/png"],
  ]);
});
