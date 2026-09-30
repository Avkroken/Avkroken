import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  MAX_LOGO_BYTES,
  contentMatchesType,
  isAdminLogoApi,
  isAdminLogoPage,
  serveAdminLogoApi,
  serveAdminLogoPage
} from "../src/admin-logos.mjs";

const ORIGIN = "https://avkroken.denied.se";
const adminHtml = await readFile(new URL("../public/admin/logos/index.html", import.meta.url), "utf8");
const adminClient = await readFile(new URL("../public/admin/logos/admin.js", import.meta.url), "utf8");
const ALLOW = {
  authorize: async () => ({ ok: true, payload: { sub: "member-1" } })
};

function pngBytes() {
  return new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
}

function jpegBytes() {
  return new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
}

function makeObject(key, bytes, options = {}) {
  const contentType = options.contentType || "image/png";
  const customMetadata = options.customMetadata || {};
  return {
    key,
    size: bytes.byteLength,
    etag: options.etag || "etag-1",
    httpEtag: "\"" + (options.etag || "etag-1") + "\"",
    httpMetadata: { contentType },
    customMetadata,
    body: bytes
  };
}

class FakeBucket {
  constructor(objects = []) {
    this.objects = new Map(objects.map(object => [object.key, object]));
    this.listCalls = [];
    this.putCalls = [];
    this.headCalls = [];
    this.getCalls = [];
    this.deleteCalls = [];
  }

  async list(options) {
    this.listCalls.push(options);
    return {
      objects: [...this.objects.values()].filter(object =>
        object.key.startsWith(options.prefix || "")
      ),
      truncated: false
    };
  }

  async put(key, body, options) {
    const bytes = new Uint8Array(body.slice(0));
    const object = makeObject(key, bytes, {
      contentType: options.httpMetadata.contentType,
      customMetadata: { ...options.customMetadata },
      etag: "etag-" + (this.putCalls.length + 1)
    });
    this.putCalls.push({ key, bytes, options });
    this.objects.set(key, object);
    return object;
  }

  async head(key) {
    this.headCalls.push(key);
    return this.objects.get(key) || null;
  }

  async get(key) {
    this.getCalls.push(key);
    return this.objects.get(key) || null;
  }

  async delete(key) {
    this.deleteCalls.push(key);
    this.objects.delete(key);
  }
}

async function payload(response) {
  return response.status === 204 ? null : response.json();
}

function apiRequest(pathname = "", init = {}) {
  return new Request(ORIGIN + "/api/admin/logos" + pathname, init);
}

test("admin routing is path-bounded and does not overlap neighboring routes", () => {
  assert.equal(isAdminLogoPage("/admin/logos"), true);
  assert.equal(isAdminLogoPage("/admin/logos/"), true);
  assert.equal(isAdminLogoPage("/admin/logos/admin.js"), true);
  assert.equal(isAdminLogoPage("/admin/logo"), false);
  assert.equal(isAdminLogoPage("/admin/logos-extra"), false);

  assert.equal(isAdminLogoApi("/api/admin/logos"), true);
  assert.equal(isAdminLogoApi("/api/admin/logos/a/download"), true);
  assert.equal(isAdminLogoApi("/api/admin/logo"), false);
  assert.equal(isAdminLogoApi("/api/admin/logos-extra"), false);
});

test("admin UI exposes an authenticated self-test that exercises the real CRUD routes and cleans up", () => {
  assert.match(adminHtml, /id="run-admin-verification"/);
  assert.match(adminHtml, /id="verification-steps"[^>]*aria-live="polite"/);
  assert.match(adminClient, /async function runAdminVerification\(\)/);
  assert.match(adminClient, /method: "POST"/);
  assert.match(adminClient, /method: "PUT"/);
  assert.match(adminClient, /\/download/);
  assert.match(adminClient, /method: "DELETE"/);
  assert.match(adminClient, /verifyPublicAsset/);
  assert.match(adminClient, /if \(assetId && !deleted\)/);
  assert.match(adminClient, /cleanup\.status !== 204 && cleanup\.status !== 404/);
  assert.match(adminClient, /verificationButton\.addEventListener\("click"/);
  assert.equal(adminClient.includes("CF-Access-Client-Secret"), false);
  assert.equal(adminClient.includes("CF-Authorization"), false);
});

test("image content validation rejects mismatches and active SVG payloads", () => {
  assert.equal(contentMatchesType(pngBytes(), "image/png"), true);
  assert.equal(contentMatchesType(jpegBytes(), "image/jpeg"), true);
  assert.equal(contentMatchesType(pngBytes(), "image/jpeg"), false);

  const safeSvg = new TextEncoder().encode(
    "<svg xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M0 0h1v1z\"/></svg>"
  );
  const scriptedSvg = new TextEncoder().encode(
    "<svg xmlns=\"http://www.w3.org/2000/svg\" onload=\"alert(1)\"></svg>"
  );
  assert.equal(contentMatchesType(safeSvg, "image/svg+xml"), true);
  assert.equal(contentMatchesType(scriptedSvg, "image/svg+xml"), false);
});

test("authorization runs before storage access and admin APIs fail closed", async () => {
  let touched = false;
  const bucket = new FakeBucket();
  bucket.list = async () => {
    touched = true;
    return { objects: [], truncated: false };
  };

  const denied = await serveAdminLogoApi(
    apiRequest(),
    { PORTAL_LOGOS: bucket },
    { authorize: async () => ({ ok: false, status: 403, error: "access_token_invalid" }) }
  );
  assert.equal(denied.status, 403);
  assert.equal((await payload(denied)).error, "access_token_invalid");
  assert.equal(touched, false);
  assert.equal(denied.headers.get("cache-control"), "no-store");

  const missing = await serveAdminLogoApi(apiRequest(), {}, ALLOW);
  assert.equal(missing.status, 503);
  assert.equal((await payload(missing)).error, "logo_storage_not_configured");
});

test("admin list exposes only validated logo ids below the fixed prefix", async () => {
  const bucket = new FakeBucket([
    makeObject("logos/valid-logo", pngBytes(), {
      customMetadata: {
        originalName: "valid.png",
        createdAt: "2026-09-28T10:00:00.000Z",
        updatedAt: "2026-09-28T11:00:00.000Z"
      }
    }),
    makeObject("other/not-a-logo", pngBytes()),
    makeObject("logos/INVALID", pngBytes())
  ]);

  const response = await serveAdminLogoApi(apiRequest(), { PORTAL_LOGOS: bucket }, ALLOW);
  assert.equal(response.status, 200);
  const body = await payload(response);
  assert.equal(body.status, "available");
  assert.deepEqual(body.assets.map(asset => asset.id), ["valid-logo"]);
  assert.equal(body.assets[0].publicUrl, "/media/logos/valid-logo");
  assert.equal(body.assets[0].originalName, "valid.png");
  assert.deepEqual(bucket.listCalls, [{
    prefix: "logos/",
    limit: 1000,
    cursor: undefined,
    include: ["httpMetadata", "customMetadata"]
  }]);
});

test("upload validates size, MIME content and sanitizes source filenames", async () => {
  const bucket = new FakeBucket();

  const mismatch = await serveAdminLogoApi(
    apiRequest("", {
      method: "POST",
      headers: { "Content-Type": "image/png", "X-File-Name": "fake.png" },
      body: new TextEncoder().encode("not-a-png")
    }),
    { PORTAL_LOGOS: bucket },
    ALLOW
  );
  assert.equal(mismatch.status, 415);
  assert.equal((await payload(mismatch)).error, "content_type_mismatch");
  assert.equal(bucket.putCalls.length, 0);

  const oversized = await serveAdminLogoApi(
    apiRequest("", {
      method: "POST",
      headers: {
        "Content-Type": "image/png",
        "Content-Length": String(MAX_LOGO_BYTES + 1),
        "X-File-Name": "large.png"
      },
      body: pngBytes()
    }),
    { PORTAL_LOGOS: bucket },
    ALLOW
  );
  assert.equal(oversized.status, 413);
  assert.equal((await payload(oversized)).error, "logo_too_large");
  assert.equal(bucket.putCalls.length, 0);

  const created = await serveAdminLogoApi(
    apiRequest("", {
      method: "POST",
      headers: {
        "Content-Type": "image/png",
        "X-File-Name": "../folder/my-logo.png"
      },
      body: pngBytes()
    }),
    { PORTAL_LOGOS: bucket },
    ALLOW
  );
  assert.equal(created.status, 201);
  const createdBody = await payload(created);
  assert.equal(createdBody.status, "created");
  assert.match(createdBody.asset.id, /^[a-z0-9](?:[a-z0-9_-]{0,62}[a-z0-9])?$/);
  assert.equal(createdBody.asset.originalName, "my-logo.png");
  assert.equal(bucket.putCalls.length, 1);
  assert.equal(bucket.putCalls[0].key, "logos/" + createdBody.asset.id);
  assert.equal(created.headers.get("location"), "/api/admin/logos/" + createdBody.asset.id);
});

test("replace preserves identity and creation time; download and delete stay scoped", async () => {
  const createdAt = "2026-09-28T10:00:00.000Z";
  const id = "asset-1";
  const key = "logos/" + id;
  const bucket = new FakeBucket([
    makeObject(key, pngBytes(), {
      customMetadata: {
        originalName: "old.png",
        createdAt,
        updatedAt: createdAt
      }
    })
  ]);

  const replaced = await serveAdminLogoApi(
    apiRequest("/" + id, {
      method: "PUT",
      headers: { "Content-Type": "image/jpeg", "X-File-Name": "new.jpg" },
      body: jpegBytes()
    }),
    { PORTAL_LOGOS: bucket },
    ALLOW
  );
  assert.equal(replaced.status, 200);
  const replacedBody = await payload(replaced);
  assert.equal(replacedBody.status, "updated");
  assert.equal(replacedBody.asset.id, id);
  assert.equal(replacedBody.asset.publicUrl, "/media/logos/" + id);
  assert.equal(replacedBody.asset.originalName, "new.jpg");
  assert.equal(replacedBody.asset.createdAt, createdAt);

  const downloaded = await serveAdminLogoApi(
    apiRequest("/" + id + "/download"),
    { PORTAL_LOGOS: bucket },
    ALLOW
  );
  assert.equal(downloaded.status, 200);
  assert.equal(downloaded.headers.get("content-type"), "image/jpeg");
  assert.match(downloaded.headers.get("content-disposition") || "", /attachment/);
  assert.equal(downloaded.headers.get("cache-control"), "no-store");

  const deleted = await serveAdminLogoApi(
    apiRequest("/" + id, { method: "DELETE" }),
    { PORTAL_LOGOS: bucket },
    ALLOW
  );
  assert.equal(deleted.status, 204);
  assert.deepEqual(bucket.deleteCalls, [key]);

  const missing = await serveAdminLogoApi(
    apiRequest("/" + id),
    { PORTAL_LOGOS: bucket },
    ALLOW
  );
  assert.equal(missing.status, 404);
});

test("admin methods are explicit and storage failures do not leak provider details", async () => {
  const bucket = new FakeBucket();
  const wrongMethod = await serveAdminLogoApi(
    apiRequest("", { method: "PATCH" }),
    { PORTAL_LOGOS: bucket },
    ALLOW
  );
  assert.equal(wrongMethod.status, 405);
  assert.equal(wrongMethod.headers.get("allow"), "GET, POST");

  bucket.list = async () => {
    throw new Error("provider secret detail");
  };
  const failure = await serveAdminLogoApi(
    apiRequest(),
    { PORTAL_LOGOS: bucket },
    ALLOW
  );
  assert.equal(failure.status, 502);
  assert.deepEqual(await payload(failure), {
    status: "error",
    error: "logo_storage_unavailable"
  });
});

test("admin page is auth-gated, no-store and served with a restrictive browser policy", async () => {
  let requestedUrl = null;
  const env = {
    ASSETS: {
      fetch: async request => {
        requestedUrl = request.url;
        return new Response("<!doctype html><title>admin</title>", {
          headers: { "Content-Type": "text/html; charset=utf-8" }
        });
      }
    }
  };

  const response = await serveAdminLogoPage(
    new Request(ORIGIN + "/admin/logos"),
    env,
    ALLOW
  );
  assert.equal(response.status, 200);
  assert.equal(requestedUrl, ORIGIN + "/admin/logos/index.html");
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.match(response.headers.get("content-security-policy") || "", /default-src 'none'/);
  assert.match(response.headers.get("content-security-policy") || "", /frame-ancestors 'none'/);

  const denied = await serveAdminLogoPage(
    new Request(ORIGIN + "/admin/logos"),
    env,
    { authorize: async () => ({ ok: false, status: 403, error: "access_token_invalid" }) }
  );
  assert.equal(denied.status, 302);
  assert.equal(denied.headers.get("location"), ORIGIN + "/access-denied/identity/");
  assert.equal(denied.headers.get("cache-control"), "no-store");
});

test("admin page rejects writes and HEAD does not return an asset body", async () => {
  const env = {
    ASSETS: {
      fetch: async request => new Response(
        request.method === "HEAD" ? null : "static-admin-body",
        { headers: { "Content-Type": "text/html; charset=utf-8" } }
      )
    }
  };

  const write = await serveAdminLogoPage(
    new Request(ORIGIN + "/admin/logos", { method: "POST" }),
    env,
    ALLOW
  );
  assert.equal(write.status, 405);
  assert.equal(write.headers.get("allow"), "GET, HEAD");

  const head = await serveAdminLogoPage(
    new Request(ORIGIN + "/admin/logos", { method: "HEAD" }),
    env,
    ALLOW
  );
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
});


test("admin item routes reject traversal and encoded separators before R2 access", async () => {
  const bucket = new FakeBucket([
    makeObject("logos/escape", pngBytes())
  ]);

  for (const path of [
    "/../escape",
    "/%2e%2e/escape",
    "/a%2fb",
    "//escape",
    "/escape/not-download"
  ]) {
    const response = await serveAdminLogoApi(
      apiRequest(path),
      { PORTAL_LOGOS: bucket },
      ALLOW
    );
    assert.equal(response.status, 404, path);
  }

  assert.deepEqual(bucket.headCalls, []);
  assert.deepEqual(bucket.getCalls, []);
  assert.deepEqual(bucket.deleteCalls, []);
});
