import test from "node:test";
import assert from "node:assert/strict";
import {
  isPublicLogoRoute,
  logoAssetIdFromPath,
  logoStorageKey,
  servePublicLogo
} from "../src/logo-assets.mjs";

function fakeObject(contentType = "image/png") {
  return {
    body: "image-bytes",
    httpEtag: "\"etag-1\"",
    httpMetadata: { contentType },
    writeHttpMetadata(headers) {
      headers.set("Content-Type", contentType);
      headers.set("Cache-Control", "private, max-age=999");
    }
  };
}

function fakeBucket(entries = {}) {
  const requested = [];
  return {
    requested,
    async get(key) {
      requested.push(key);
      return entries[key] || null;
    }
  };
}

test("public logo routing accepts only exact single-segment asset ids", () => {
  assert.equal(isPublicLogoRoute("/media/logos/abc-123"), true);
  assert.equal(isPublicLogoRoute("/media/logos"), true);
  assert.equal(isPublicLogoRoute("/media/logo/abc-123"), false);

  assert.equal(logoAssetIdFromPath("/media/logos/abc-123"), "abc-123");
  assert.equal(logoAssetIdFromPath("/media/logos/a_b"), "a_b");
  assert.equal(logoAssetIdFromPath("/media/logos"), null);
  assert.equal(logoAssetIdFromPath("/media/logos/"), null);
  assert.equal(logoAssetIdFromPath("/media/logos/../secret"), null);
  assert.equal(logoAssetIdFromPath("/media/logos/%2e%2e"), null);
  assert.equal(logoAssetIdFromPath("/media/logos/a%2fb"), null);
  assert.equal(logoAssetIdFromPath("/media/logos/A"), null);

  assert.equal(logoStorageKey("abc-123"), "logos/abc-123");
  assert.equal(logoStorageKey("../secret"), null);
});

test("GET serves only the prefixed R2 object with bounded public caching", async () => {
  const bucket = fakeBucket({ "logos/abc-123": fakeObject("image/png") });
  const response = await servePublicLogo(
    new Request("https://avkroken.denied.se/media/logos/abc-123"),
    bucket
  );

  assert.equal(response.status, 200);
  assert.deepEqual(bucket.requested, ["logos/abc-123"]);
  assert.equal(response.headers.get("content-type"), "image/png");
  assert.equal(response.headers.get("cache-control"), "public, max-age=300, stale-while-revalidate=60");
  assert.equal(response.headers.get("etag"), "\"etag-1\"");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(await response.text(), "image-bytes");
});

test("HEAD returns metadata without a response body", async () => {
  const bucket = fakeBucket({ "logos/abc-123": fakeObject("image/webp") });
  const response = await servePublicLogo(
    new Request("https://avkroken.denied.se/media/logos/abc-123", { method: "HEAD" }),
    bucket
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "image/webp");
  assert.equal(await response.text(), "");
});

test("logo route fails closed for missing binding, listing attempts and unsupported content", async () => {
  const missingBinding = await servePublicLogo(
    new Request("https://avkroken.denied.se/media/logos/abc-123"),
    undefined
  );
  assert.equal(missingBinding.status, 503);
  assert.equal(missingBinding.headers.get("cache-control"), "no-store");

  const bucket = fakeBucket({ "logos/abc-123": fakeObject("text/html") });
  const unsupported = await servePublicLogo(
    new Request("https://avkroken.denied.se/media/logos/abc-123"),
    bucket
  );
  assert.equal(unsupported.status, 415);

  const listing = await servePublicLogo(
    new Request("https://avkroken.denied.se/media/logos"),
    bucket
  );
  assert.equal(listing.status, 404);
  assert.deepEqual(bucket.requested, ["logos/abc-123"]);
});

test("SVG responses receive a restrictive CSP and writes are rejected", async () => {
  const bucket = fakeBucket({ "logos/vector-1": fakeObject("image/svg+xml") });
  const svg = await servePublicLogo(
    new Request("https://avkroken.denied.se/media/logos/vector-1"),
    bucket
  );
  assert.equal(svg.status, 200);
  assert.match(svg.headers.get("content-security-policy") || "", /default-src 'none'/);

  const write = await servePublicLogo(
    new Request("https://avkroken.denied.se/media/logos/vector-1", { method: "PUT" }),
    bucket
  );
  assert.equal(write.status, 405);
  assert.equal(write.headers.get("allow"), "GET, HEAD");
});
