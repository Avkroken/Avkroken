import assert from "node:assert/strict";
import test from "node:test";

import {
  deleteAsset,
  downloadAsset,
  mutableAssetKey,
  replaceAsset,
  resolveAssetUploadTarget,
} from "../src/asset-library.js";

function sizeOf(body) {
  if (body?.byteLength != null) return body.byteLength;
  return new TextEncoder().encode(String(body ?? "")).byteLength;
}

function fakeR2(seed = []) {
  const objects = new Map(seed.map((item) => [item.key, {
    uploaded: item.uploaded || new Date("2026-10-05T12:00:00Z"),
    body: item.body ?? "",
    size: item.size ?? sizeOf(item.body ?? ""),
    httpMetadata: item.httpMetadata || {},
    customMetadata: item.customMetadata || {},
  }]));
  return {
    async list({ cursor } = {}) {
      assert.equal(cursor, undefined);
      return {
        objects: [...objects].map(([key, value]) => ({ key, ...value })),
        truncated: false,
      };
    },
    async head(key) {
      const value = objects.get(key);
      return value ? { key, ...value } : null;
    },
    async get(key) {
      const value = objects.get(key);
      return value ? { key, ...value } : null;
    },
    async put(key, body, options = {}) {
      objects.set(key, {
        uploaded: new Date("2026-10-06T00:00:00Z"),
        body,
        size: sizeOf(body),
        httpMetadata: options.httpMetadata || {},
        customMetadata: options.customMetadata || {},
      });
      return { key };
    },
    async delete(keys) {
      for (const key of Array.isArray(keys) ? keys : [keys]) objects.delete(key);
    },
    has(key) {
      return objects.has(key);
    },
    value(key) {
      return objects.get(key);
    },
  };
}

test("explicit upload metadata resolves to canonical app target independent of filename", () => {
  const target = resolveAssetUploadTarget("my-pretty-picture.png", {
    app: "plex",
    theme: "4",
    size: "512",
  });
  assert.equal(target.error, undefined);
  assert.equal(target.explicit, true);
  assert.equal(target.originalName, "my-pretty-picture.png");
  assert.equal(target.name, "plex-4-512.png");
  assert.equal(target.target.key, "apps/plex/plex-4-512.png");

  assert.equal(resolveAssetUploadTarget("x.png", { app: "plex" }).error, "App, tema och storlek måste anges tillsammans.");
  assert.match(resolveAssetUploadTarget("x.png", { app: "unknown", theme: "1", size: "1254" }).error, /Ogiltig/);
});

test("legacy filename inference remains available when explicit metadata is absent", () => {
  const target = resolveAssetUploadTarget("qbittorrent-t4-1254x1254.png");
  assert.equal(target.explicit, false);
  assert.equal(target.target.key, "apps/qbittorrent/qbittorrent-4.png");

  const generic = resolveAssetUploadTarget("notes.txt");
  assert.equal(generic.target, null);
  assert.equal(generic.name, "notes.txt");
});

test("asset item mutations are restricted to managed uploads and canonical app assets", () => {
  assert.equal(mutableAssetKey("staging/themes-v2/apps/plex/plex-1.png"), null);
  assert.equal(mutableAssetKey("hotlink-ok/apps/plex/plex-1.png"), null);
  assert.equal(mutableAssetKey("hotlink-ok/manual.png"), null);
  assert.equal(mutableAssetKey("uploads/not-an-id/file.png"), null);
  assert.equal(mutableAssetKey("uploads/0123456789abcdef0123456789abcdef/file.png")?.kind, "managed");
  assert.equal(mutableAssetKey("apps/plex/plex-1.png")?.kind, "app");
});

test("deleting a canonical app image also deletes its hidden hotlink mirror", async () => {
  const bucket = fakeR2([
    { key: "apps/plex/plex-1.png", body: "canonical" },
    { key: "hotlink-ok/apps/plex/plex-1.png", body: "mirror" },
  ]);
  const result = await deleteAsset(bucket, "apps/plex/plex-1.png");
  assert.equal(result.status, 204);
  assert.equal(bucket.has("apps/plex/plex-1.png"), false);
  assert.equal(bucket.has("hotlink-ok/apps/plex/plex-1.png"), false);
});

test("managed replace preserves stable key and enforces total storage limit", async () => {
  const key = "uploads/0123456789abcdef0123456789abcdef/photo.jpg";
  const bucket = fakeR2([
    {
      key,
      body: new Uint8Array([1, 2]),
      httpMetadata: { contentType: "image/jpeg" },
      customMetadata: { originalName: "photo.jpg", kind: "dumpen-upload" },
    },
    { key: "other.bin", body: new Uint8Array(8) },
  ]);

  const tooLarge = await replaceAsset(
    new Request("https://dumpen.denied.se/api/assets/item", {
      method: "PUT",
      headers: { "content-type": "image/jpeg" },
      body: new Uint8Array(5),
    }),
    bucket,
    key,
    { maxUploadBytes: 20, maxBucketBytes: 12 },
  );
  assert.equal(tooLarge.response.status, 507);

  const replaced = await replaceAsset(
    new Request("https://dumpen.denied.se/api/assets/item", {
      method: "PUT",
      headers: { "content-type": "image/jpeg" },
      body: new Uint8Array([9, 9, 9]),
    }),
    bucket,
    key,
    { maxUploadBytes: 20, maxBucketBytes: 20 },
  );
  assert.equal(replaced.replaced, true);
  assert.equal(replaced.asset.key, key);
  assert.equal(replaced.asset.name, "photo.jpg");
  assert.equal(bucket.value(key).size, 3);
});

test("asset download is private/no-store and keeps the original filename", async () => {
  const key = "uploads/0123456789abcdef0123456789abcdef/manual.pdf";
  const bucket = fakeR2([{
    key,
    body: "pdf-data",
    httpMetadata: { contentType: "application/pdf" },
    customMetadata: { originalName: "manual.pdf", kind: "dumpen-upload" },
  }]);

  const result = await downloadAsset(bucket, key);
  assert.equal(result.response.status, 200);
  assert.equal(result.response.headers.get("cache-control"), "private, no-store");
  assert.match(result.response.headers.get("content-disposition"), /manual\.pdf/);
  assert.equal(await result.response.text(), "pdf-data");
});
