import test from "node:test";
import assert from "node:assert/strict";
import worker, { claimTicket } from "../src/index.js";
import { handleGitHubCallback, startGitHubLogin } from "../src/github-auth.js";
import { classifyAppAssetUploadName, listPublicAssets, pngDimensions, safeAssetName } from "../src/public-assets.js";

const TOKEN = "test-token";
const GITHUB_USER_ID = 123;
const GITHUB_CLIENT_ID = "github-client";
const GITHUB_CLIENT_SECRET = "github-client-secret";
const MiB = 1024 * 1024;

function sizeOf(body) {
  if (body?.byteLength != null) return body.byteLength;
  return new TextEncoder().encode(String(body ?? "")).byteLength;
}

function fakeR2(seed = []) {
  const objects = new Map(seed.map(({ key, uploaded, body = "", size, httpMetadata, customMetadata }) => [key, {
    key, uploaded, body, size: size ?? sizeOf(body), httpMetadata, customMetadata, etag: `etag-${key}`,
  }]));
  return {
    puts: [],
    async put(key, body, options = {}) {
      const onlyIf = options.onlyIf;
      const ifNoneMatch = onlyIf instanceof Headers ? onlyIf.get("if-none-match") : null;
      if (ifNoneMatch === "*" && objects.has(key)) return null;
      this.puts.push({ key, body, options });
      const timestamp = Number(key.match(/\/(\d+)\.zip$/)?.[1] || Date.now());
      const entry = {
        key,
        uploaded: new Date(timestamp),
        body,
        size: sizeOf(body),
        httpMetadata: options.httpMetadata,
        customMetadata: options.customMetadata,
        etag: `etag-${this.puts.length}`,
      };
      objects.set(key, entry);
      return { key, etag: entry.etag };
    },
    async delete(key) {
      for (const item of Array.isArray(key) ? key : [key]) objects.delete(item);
    },
    async list({ prefix = "" } = {}) {
      return {
        objects: [...objects.values()]
          .filter((o) => o.key.startsWith(prefix))
          .map(({ key, uploaded, size, httpMetadata, customMetadata, etag }) => ({
            key, uploaded, size, httpMetadata, customMetadata, etag,
          })),
        truncated: false,
      };
    },
    async get(key) {
      const obj = objects.get(key);
      if (!obj) return null;
      return {
        body: obj.body,
        size: obj.size,
        httpMetadata: obj.httpMetadata,
        customMetadata: obj.customMetadata,
        etag: obj.etag,
        writeHttpMetadata(headers) {
          if (obj.httpMetadata?.contentType) headers.set("content-type", obj.httpMetadata.contentType);
        },
        async text() {
          if (typeof obj.body === "string") return obj.body;
          if (obj.body instanceof ArrayBuffer) return new TextDecoder().decode(obj.body);
          if (ArrayBuffer.isView(obj.body)) return new TextDecoder().decode(obj.body);
          return String(obj.body ?? "");
        },
      };
    },
    async head(key) {
      const obj = objects.get(key);
      if (!obj) return null;
      return {
        key: obj.key,
        size: obj.size,
        uploaded: obj.uploaded,
        httpMetadata: obj.httpMetadata,
        customMetadata: obj.customMetadata,
        etag: obj.etag,
        writeHttpMetadata(headers) {
          if (obj.httpMetadata?.contentType) headers.set("content-type", obj.httpMetadata.contentType);
        },
      };
    },
    has(key) { return objects.has(key); },
    keys() { return [...objects.keys()]; },
  };
}

function request(path, { method = "GET", token, body, headers = {} } = {}) {
  const h = new Headers(headers);
  if (token !== undefined) h.set("authorization", `Bearer ${token}`);
  return new Request(`https://dumpen.denied.se${path}`, { method, headers: h, body });
}

function env(r2 = fakeR2(), assets = fakeR2()) {
  return {
    DUMPEN_TOKEN: TOKEN,
    GITHUB_OAUTH_CLIENT_ID: GITHUB_CLIENT_ID,
    GITHUB_OAUTH_CLIENT_SECRET: GITHUB_CLIENT_SECRET,
    DUMPEN_ALLOWED_GITHUB_IDS: String(GITHUB_USER_ID),
    DUMPEN: r2,
    ASSETS: assets,
  };
}

function cookiePair(setCookie, name) {
  const match = setCookie.match(new RegExp(`${name}=([^;,\\s]+)`));
  if (!match) throw new Error(`cookie ${name} missing`);
  return `${name}=${match[1]}`;
}

async function createAdminSessionCookie() {
  const e = env();
  const start = await startGitHubLogin(
    new Request("https://dumpen.denied.se/auth/start?return_to=%2Fadmin"),
    e,
  );
  const authorize = new URL(start.headers.get("location"));
  const state = authorize.searchParams.get("state");
  const oauthCookie = cookiePair(start.headers.get("set-cookie"), "__Host-dumpen_oauth");
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (url === "https://github.com/login/oauth/access_token") return Response.json({ access_token: "gho_test" });
    if (url === "https://api.github.com/user") return Response.json({ id: GITHUB_USER_ID });
    return new Response(null, { status: 204 });
  };
  try {
    const callback = await handleGitHubCallback(
      new Request(`https://dumpen.denied.se/auth/callback?code=abc&state=${encodeURIComponent(state)}`, {
        headers: { Cookie: oauthCookie },
      }),
      e,
    );
    assert.equal(callback.status, 303);
    return cookiePair(callback.headers.get("set-cookie"), "__Host-dumpen_session");
  } finally {
    globalThis.fetch = originalFetch;
  }
}

const ADMIN_COOKIE = await createAdminSessionCookie();

async function mintTicket(e, adminCookie = ADMIN_COOKIE) {
  const response = await worker.fetch(request("/api/tickets", {
    method: "POST",
    headers: { cookie: adminCookie },
  }), e);
  assert.equal(response.status, 201);
  return response.json();
}

async function mintAssetTicket(e, targetKey, adminCookie = ADMIN_COOKIE) {
  const response = await worker.fetch(request("/api/assets/tickets", {
    method: "POST",
    body: JSON.stringify({ targetKey }),
    headers: {
      cookie: adminCookie,
      "content-type": "application/json",
    },
  }), e);
  assert.equal(response.status, 201);
  return response.json();
}

const PNG_BODY = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 1, 2, 3]);

const TEST_PNG_CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let value = 0; value < table.length; value += 1) {
    let crc = value;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 1) ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1);
    }
    table[value] = crc >>> 0;
  }
  return table;
})();

function testPngCrc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = TEST_PNG_CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data = new Uint8Array()) {
  const typeBytes = new TextEncoder().encode(type);
  const bytes = new Uint8Array(12 + data.byteLength);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, data.byteLength, false);
  bytes.set(typeBytes, 4);
  bytes.set(data, 8);
  view.setUint32(8 + data.byteLength, testPngCrc32(bytes.slice(4, 8 + data.byteLength)), false);
  return bytes;
}

function pngBody(width, height) {
  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const header = new Uint8Array(13);
  const headerView = new DataView(header.buffer);
  headerView.setUint32(0, width, false);
  headerView.setUint32(4, height, false);
  header.set([8, 6, 0, 0, 0], 8);

  const chunks = [
    pngChunk("IHDR", header),
    pngChunk("IDAT", new Uint8Array([0x78, 0x9c, 0x03, 0x00, 0x00, 0x00, 0x00, 0x01])),
    pngChunk("IEND"),
  ];
  const total = signature.byteLength + chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const bytes = new Uint8Array(total);
  let offset = 0;
  bytes.set(signature, offset);
  offset += signature.byteLength;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

const versions = [
  { key: "regelverk/1000.zip", uploaded: new Date(1000), body: "old" },
  { key: "regelverk/3000.zip", uploaded: new Date(3000), body: "new" },
  { key: "regelverk/2000.zip", uploaded: new Date(2000), body: "middle" },
];

test("root visar privat dashboard och engångsticket-flöde", async () => {
  const response = await worker.fetch(request("/"), env(fakeR2(versions)));
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /dumpen\.denied\.se/);
  assert.match(html, /Privat kontrollpanel/);
  assert.match(html, /engångsticket/i);
  assert.match(html, /publika assets/);
  assert.match(html, /--bg:#04070e/);
  assert.match(html, /value="legacy">Legacy/);
  assert.match(html, /20 MB per fil/);
  assert.match(html, /500 MB appgräns/);
});

test("fel token på legacy PUT ger 401", async () => {
  const response = await worker.fetch(request("/regelverk", { method: "PUT", token: "fel", body: "zip" }), env());
  assert.equal(response.status, 401);
});

test("legacy PUT failar stängt om upload-token saknas", async () => {
  const e = env();
  delete e.DUMPEN_TOKEN;
  const response = await worker.fetch(request("/regelverk", { method: "PUT", token: "undefined", body: "zip" }), e);
  assert.equal(response.status, 503);
  assert.equal(await response.text(), "upload token not configured\n");
});

test("legacy PUT skapar timestampad nyckel", async () => {
  const r2 = fakeR2();
  const originalNow = Date.now;
  Date.now = () => 1787724000123;
  try {
    const response = await worker.fetch(request("/regelverk", { method: "PUT", token: TOKEN, body: new Uint8Array([1, 2, 3]) }), env(r2));
    assert.equal(response.status, 201);
    assert.equal(await response.text(), "regelverk/1787724000123.zip\n");
  } finally { Date.now = originalNow; }
});

test("legacy PUT över 20 MB ger 413", async () => {
  const response = await worker.fetch(request("/stor", { method: "PUT", token: TOKEN, body: new Uint8Array(20 * MiB + 1) }), env());
  assert.equal(response.status, 413);
});

test("legacy PUT över 500 MB totalt ger 507", async () => {
  const r2 = fakeR2([{ key: "gammalt/1.zip", uploaded: new Date(1), size: 500 * MiB }]);
  const response = await worker.fetch(request("/nytt", { method: "PUT", token: TOKEN, body: new Uint8Array([1]) }), env(r2));
  assert.equal(response.status, 507);
});

test("publik nedladdning kräver GitHub-session", async () => {
  const response = await worker.fetch(request("/api/download/regelverk"), env(fakeR2(versions)));
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("www-authenticate"), null);
});

test("autentiserad GET returnerar nyaste", async () => {
  const response = await worker.fetch(request("/api/download/regelverk", { headers: { cookie: ADMIN_COOKIE } }), env(fakeR2(versions)));
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "new");
  assert.equal(response.headers.get("x-dumpen-key"), "regelverk/3000.zip");
  assert.equal(response.headers.get("cache-control"), "private, no-store");
});

test("autentiserad ?n=2 returnerar näst nyaste", async () => {
  const response = await worker.fetch(request("/api/download/regelverk?n=2", { headers: { cookie: ADMIN_COOKIE } }), env(fakeR2(versions)));
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "middle");
});

test("autentiserad ?n=99 ger 404", async () => {
  const response = await worker.fetch(request("/api/download/regelverk?n=99", { headers: { cookie: ADMIN_COOKIE } }), env(fakeR2(versions)));
  assert.equal(response.status, 404);
});

test("ticket-minting kräver admininloggning", async () => {
  const response = await worker.fetch(request("/api/tickets", { method: "POST" }), env());
  assert.equal(response.status, 401);
});

test("admin kan skapa kortlivad engångsticket", async () => {
  const r2 = fakeR2();
  const data = await mintTicket(env(r2));
  assert.match(data.uploadUrl, /^https:\/\/dumpen\.denied\.se\/api\/upload\/[0-9a-f]{64}$/);
  assert.equal(data.oneTime, true);
  assert.equal(data.maxUploadBytes, 20 * MiB);
  assert.ok(new Date(data.expiresAt).getTime() > Date.now());
  assert.equal(r2.keys().filter((key) => key.startsWith("_system/tickets/")).length, 1);
});

test("ticket laddar upp till servergenererad nyckel och kan inte återanvändas", async () => {
  const r2 = fakeR2();
  const e = env(r2);
  const ticket = await mintTicket(e);
  const path = new URL(ticket.uploadUrl).pathname;

  const first = await worker.fetch(request(path, { method: "PUT", body: "zip-data" }), e);
  assert.equal(first.status, 201);
  const uploaded = await first.json();
  assert.match(uploaded.name, /^drop-\d{8}-[0-9a-f]{12}$/);
  assert.equal(uploaded.key.startsWith(`${uploaded.name}/`), true);
  assert.equal(r2.has(uploaded.key), true);

  const replay = await worker.fetch(request(path, { method: "PUT", body: "second" }), e);
  assert.equal(replay.status, 410);
});

test("ticket-claim är atomisk", async () => {
  const r2 = fakeR2();
  const results = await Promise.all([
    claimTicket(r2, "same-digest"),
    claimTicket(r2, "same-digest"),
  ]);
  assert.deepEqual(results.sort(), [false, true]);
  assert.equal(r2.keys().filter((key) => key === "_system/claims/same-digest").length, 1);
});

test("samma ticket kan inte vinna två samtidiga uploads", async () => {
  const r2 = fakeR2();
  const e = env(r2);
  const ticket = await mintTicket(e);
  const path = new URL(ticket.uploadUrl).pathname;

  const [a, b] = await Promise.all([
    worker.fetch(request(path, { method: "PUT", body: "first" }), e),
    worker.fetch(request(path, { method: "PUT", body: "second" }), e),
  ]);
  const statuses = [a.status, b.status];
  assert.equal(statuses.filter((status) => status === 201).length, 1);
  assert.equal(statuses.filter((status) => status === 409 || status === 410).length, 1);
  assert.equal(r2.keys().filter((key) => /^drop-/.test(key)).length, 1);
});

test("för stor capability-upload förbrukar inte ticketen", async () => {
  const r2 = fakeR2();
  const e = env(r2);
  const ticket = await mintTicket(e);
  const path = new URL(ticket.uploadUrl).pathname;

  const tooLarge = await worker.fetch(request(path, {
    method: "PUT",
    body: "x",
    headers: { "content-length": String(20 * MiB + 1) },
  }), e);
  assert.equal(tooLarge.status, 413);

  const retry = await worker.fetch(request(path, { method: "PUT", body: "ok" }), e);
  assert.equal(retry.status, 201);
});

test("utgången ticket nekas och tas bort", async () => {
  const r2 = fakeR2();
  const e = env(r2);
  const originalNow = Date.now;
  let now = 1_800_000_000_000;
  Date.now = () => now;
  try {
    const adminCookie = await createAdminSessionCookie();
    const ticket = await mintTicket(e, adminCookie);
    const path = new URL(ticket.uploadUrl).pathname;
    now += 16 * 60 * 1000;
    const response = await worker.fetch(request(path, { method: "PUT", body: "zip" }), e);
    assert.equal(response.status, 410);
    assert.equal(r2.keys().filter((key) => key.startsWith("_system/tickets/")).length, 0);
  } finally { Date.now = originalNow; }
});

test("capability-upload är privat efter uppladdning", async () => {
  const r2 = fakeR2();
  const e = env(r2);
  const ticket = await mintTicket(e);
  const upload = await worker.fetch(request(new URL(ticket.uploadUrl).pathname, { method: "PUT", body: "private-data" }), e);
  const { name } = await upload.json();

  const publicRead = await worker.fetch(request(`/api/download/${name}`), e);
  assert.equal(publicRead.status, 401);

  const privateRead = await worker.fetch(request(`/api/download/${name}`, { headers: { cookie: ADMIN_COOKIE } }), e);
  assert.equal(privateRead.status, 200);
  assert.equal(await privateRead.text(), "private-data");
});

test("asset-ticket kräver admininloggning", async () => {
  const response = await worker.fetch(request("/api/assets/tickets", {
    method: "POST",
    body: JSON.stringify({ targetKey: "staging/themes-v2/apps/plex/plex-2.png" }),
    headers: { "content-type": "application/json" },
  }), env());
  assert.equal(response.status, 401);
});

test("asset-ticket accepterar bara låsta theme-v2 staging-nycklar", async () => {
  const e = env();
  for (const targetKey of [
    "apps/plex/plex-2.png",
    "staging/themes-v2/apps/plex/plex-8.png",
    "staging/themes-v2/apps/plex/sonarr-2.png",
    "staging/themes-v2/apps/unknown/unknown-2.png",
    "staging/themes-v2/apps/plex/../plex-2.png",
  ]) {
    const response = await worker.fetch(request("/api/assets/tickets", {
      method: "POST",
      body: JSON.stringify({ targetKey }),
      headers: {
        cookie: ADMIN_COOKIE,
        "content-type": "application/json",
      },
    }), e);
    assert.equal(response.status, 400, targetKey);
  }
});

test("admin kan skapa kortlivad asset-ticket för exakt staging-nyckel", async () => {
  const transfers = fakeR2();
  const assets = fakeR2();
  const e = env(transfers, assets);
  const targetKey = "staging/themes-v2/apps/plex/plex-2.png";
  const data = await mintAssetTicket(e, targetKey);

  assert.match(data.uploadUrl, /^https:\/\/dumpen\.denied\.se\/api\/asset-upload\/[0-9a-f]{64}$/);
  assert.equal(data.targetKey, targetKey);
  assert.equal(data.oneTime, true);
  assert.equal(data.maxUploadBytes, 20 * MiB);
  assert.ok(new Date(data.expiresAt).getTime() > Date.now());
  assert.equal(transfers.keys().filter((key) => key.startsWith("_system/asset-tickets/")).length, 1);
  assert.equal(assets.keys().length, 0);
});

test("asset-ticket skriver PNG till ASSETS och kan inte återanvändas", async () => {
  const transfers = fakeR2();
  const assets = fakeR2();
  const e = env(transfers, assets);
  const targetKey = "staging/themes-v2/apps/plex/plex-2.png";
  const ticket = await mintAssetTicket(e, targetKey);
  const path = new URL(ticket.uploadUrl).pathname;

  const first = await worker.fetch(request(path, {
    method: "PUT",
    body: PNG_BODY,
    headers: { "content-type": "image/png" },
  }), e);
  assert.equal(first.status, 201);
  assert.deepEqual(await first.json(), { key: targetKey, size: PNG_BODY.byteLength });
  assert.equal(assets.has(targetKey), true);
  assert.equal(transfers.keys().filter((key) => key.startsWith("_system/asset-tickets/")).length, 0);
  const put = assets.puts.find((entry) => entry.key === targetKey);
  assert.equal(put.options.httpMetadata.contentType, "image/png");
  assert.equal(put.options.customMetadata.kind, "theme-v2-staging");

  const replay = await worker.fetch(request(path, {
    method: "PUT",
    body: PNG_BODY,
  }), e);
  assert.equal(replay.status, 410);
});

test("fel filtyp förbrukar inte asset-ticket", async () => {
  const transfers = fakeR2();
  const assets = fakeR2();
  const e = env(transfers, assets);
  const targetKey = "staging/themes-v2/apps/tautulli/tautulli-2.png";
  const ticket = await mintAssetTicket(e, targetKey);
  const path = new URL(ticket.uploadUrl).pathname;

  const bad = await worker.fetch(request(path, {
    method: "PUT",
    body: new Uint8Array([1, 2, 3]),
  }), e);
  assert.equal(bad.status, 415);

  const retry = await worker.fetch(request(path, {
    method: "PUT",
    body: PNG_BODY,
  }), e);
  assert.equal(retry.status, 201);
  assert.equal(assets.has(targetKey), true);
});

test("asset-ticket skriver aldrig över befintlig staging-fil", async () => {
  const targetKey = "staging/themes-v2/apps/radarr/radarr-3.png";
  const transfers = fakeR2();
  const assets = fakeR2([{
    key: targetKey,
    uploaded: new Date(),
    body: PNG_BODY,
    httpMetadata: { contentType: "image/png" },
  }]);
  const e = env(transfers, assets);
  const ticket = await mintAssetTicket(e, targetKey);

  const response = await worker.fetch(request(new URL(ticket.uploadUrl).pathname, {
    method: "PUT",
    body: PNG_BODY,
  }), e);
  assert.equal(response.status, 409);
  assert.equal(transfers.keys().filter((key) => key.startsWith("_system/asset-tickets/")).length, 0);
});

test("assetfilnamn trunkeras på UTF-8-gräns utan att dela Unicode-tecken", () => {
  const encoder = new TextEncoder();
  const omittedEmoji = safeAssetName("a".repeat(177) + "😀");
  assert.equal(omittedEmoji, "a".repeat(177));
  assert.ok(encoder.encode(omittedEmoji).byteLength <= 180);

  const retainedEmoji = safeAssetName("a".repeat(176) + "😀");
  assert.equal(retainedEmoji, "a".repeat(176) + "😀");
  assert.equal(encoder.encode(retainedEmoji).byteLength, 180);
});

test("assetdirektlänkar bevarar tomma segment i giltiga R2-nycklar", async () => {
  const assets = fakeR2([{
    key: "apps//icon.png",
    uploaded: new Date("2026-10-01T10:00:00Z"),
    body: new Uint8Array([1]),
    httpMetadata: { contentType: "image/png" },
  }]);

  const listed = await listPublicAssets(assets);
  assert.equal(listed[0].directUrl, "https://logos.denied.se/apps//icon.png");
});

test("appbilder får kategori, tema och storleksvariant utan mirror- eller legacy-dubbletter", async () => {
  const uploaded = new Date("2026-10-01T10:00:00Z");
  const png = { uploaded, body: new Uint8Array([1]), httpMetadata: { contentType: "image/png" } };
  const assets = fakeR2([
    { ...png, key: "apps/dozzle/dozzle-1.png" },
    { ...png, key: "apps/dozzle/dozzle-1-256.png" },
    { ...png, key: "apps/dozzle/dozzle-1-512.png" },
    { ...png, key: "apps/dozzle/dozzle-256.png" },
    { ...png, key: "hotlink-ok/apps/dozzle/dozzle-1.png" },
    { ...png, key: "hotlink-ok/apps/dozzle/dozzle-1-256.png" },
    { ...png, key: "hotlink-ok/apps/dozzle/dozzle-1-512.png" },
    { ...png, key: "staging/themes-v2/apps/dozzle/dozzle-2.png" },
    { ...png, key: "hotlink-ok/manual.png" },
  ]);

  const listed = await listPublicAssets(assets);
  assert.deepEqual(listed.map((asset) => asset.key), [
    "apps/dozzle/dozzle-1.png",
    "apps/dozzle/dozzle-1-256.png",
    "apps/dozzle/dozzle-1-512.png",
    "hotlink-ok/manual.png",
  ]);
  assert.deepEqual(listed.slice(0, 3).map((asset) => ({
    appCategory: asset.appCategory,
    theme: asset.theme,
    pixelSize: asset.pixelSize,
    variant: asset.variant,
  })), [
    { appCategory: "dozzle", theme: "1", pixelSize: 1254, variant: "original" },
    { appCategory: "dozzle", theme: "1", pixelSize: 256, variant: "resized" },
    { appCategory: "dozzle", theme: "1", pixelSize: 512, variant: "resized" },
  ]);
  assert.equal(listed.slice(0, 3).every((asset) => asset.appLabel === "Dozzle"), true);
  assert.equal(listed.slice(0, 3).every((asset) => asset.themeLabel === "Neon Glass"), true);
  assert.equal(listed[3].mirror, false);
});

test("okända appkategorier använder sitt namn även om det matchar Object.prototype", async () => {
  const uploaded = new Date("2026-10-01T10:00:00Z");
  const png = { uploaded, body: new Uint8Array([1]), httpMetadata: { contentType: "image/png" } };
  const assets = fakeR2([
    { ...png, key: "apps/constructor/constructor-1.png" },
    { ...png, key: "apps/dozzle/dozzle-1.png" },
  ]);

  const listed = await listPublicAssets(assets);
  const unknown = listed.find((asset) => asset.appCategory === "constructor");
  assert.equal(unknown.appLabel, "constructor");
  assert.equal(typeof unknown.appLabel, "string");
});

test("assetfel degraderar separat utan att blockera privata transferer", async () => {
  const transfers = fakeR2([{
    key: "backup/1000.zip",
    uploaded: new Date(1000),
    body: "private-data",
  }]);
  const assets = fakeR2();
  assets.list = async () => {
    throw new Error("asset provider unavailable");
  };

  const response = await worker.fetch(
    request("/api/objects", { headers: { cookie: ADMIN_COOKIE } }),
    env(transfers, assets),
  );
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.objects.length, 1);
  assert.equal(data.objects[0].name, "backup");
  assert.deepEqual(data.assets, []);
  assert.equal(data.assetState, "unavailable");
});

test("publik asset-upload kräver admininloggning", async () => {
  const response = await worker.fetch(request("/api/assets/upload/app-icon.png", {
    method: "PUT",
    body: new Uint8Array([1, 2, 3]),
    headers: { "content-type": "image/png" },
  }), env());
  assert.equal(response.status, 401);
});

test("admin listar befintliga App Launcher-assets och laddar upp till ASSETS-bindingen", async () => {
  const transfers = fakeR2();
  const assets = fakeR2([{
    key: "apps/plex/plex-1-256.png",
    uploaded: new Date("2026-09-27T11:32:58Z"),
    body: new Uint8Array([1, 2, 3]),
    httpMetadata: { contentType: "image/png" },
  }]);
  const e = env(transfers, assets);
  const body = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

  const upload = await worker.fetch(request("/api/assets/upload/app-icon.png", {
    method: "PUT",
    body,
    headers: { cookie: ADMIN_COOKIE, "content-type": "image/png" },
  }), e);
  assert.equal(upload.status, 201);
  const { asset } = await upload.json();
  assert.match(asset.managedId, /^[0-9a-f]{32}$/);
  assert.equal(asset.name, "app-icon.png");
  assert.equal(asset.contentType, "image/png");
  assert.equal(asset.image, true);
  assert.match(asset.key, /^uploads\/[0-9a-f]{32}\/app-icon\.png$/);
  assert.match(asset.directUrl, /^https:\/\/logos\.denied\.se\/uploads\/[0-9a-f]{32}\/app-icon\.png$/);
  assert.equal(assets.keys().includes(asset.key), true);
  assert.equal(transfers.keys().length, 0);

  const listing = await worker.fetch(request("/api/objects", { headers: { cookie: ADMIN_COOKIE } }), e);
  assert.equal(listing.status, 200);
  const listed = await listing.json();
  assert.equal(listed.assetState, "available");
  assert.equal(listed.objects.length, 0);
  assert.equal(listed.assets.length, 2);
  const plex = listed.assets.find((item) => item.key === "apps/plex/plex-1-256.png");
  assert.equal(plex.directUrl, "https://logos.denied.se/apps/plex/plex-1-256.png");
  assert.match(plex.previewUrl, /^https:\/\/logos\.denied\.se\/apps\/plex\/plex-1-256\.png\?v=/);
  assert.equal(plex.image, true);
  assert.equal(plex.contentType, "image/png");
  assert.equal(plex.appCategory, "plex");
  assert.equal(plex.appLabel, "Plex");
  assert.equal(plex.theme, "1");
  assert.equal(plex.themeLabel, "Neon Glass");
  assert.equal(plex.pixelSize, 256);
  assert.equal(plex.pixelLabel, "256×256");
});

test("appbildsnamn normaliseras till canonical nyckel och förväntad storlek", () => {
  assert.deepEqual(classifyAppAssetUploadName("qbittorrent-t4-1254x1254.png"), {
    app: "qbittorrent",
    appLabel: "qBittorrent",
    theme: "4",
    themeLabel: "Illustrated Scene",
    pixelSize: 1254,
    pixelLabel: "1254×1254",
    canonicalName: "qbittorrent-4.png",
    key: "apps/qbittorrent/qbittorrent-4.png",
    mirrorKey: "hotlink-ok/apps/qbittorrent/qbittorrent-4.png",
  });
  assert.equal(classifyAppAssetUploadName("plex-2-512.png")?.key, "apps/plex/plex-2-512.png");
  assert.equal(classifyAppAssetUploadName("unknown-t1-1254x1254.png"), null);
});

test("PNG-validering kräver komplett chunkstruktur och korrekta CRC", () => {
  const valid = pngBody(1254, 512);
  assert.deepEqual(pngDimensions(valid), { width: 1254, height: 512 });
  assert.equal(pngDimensions(new Uint8Array([1, 2, 3])), null);
  assert.equal(pngDimensions(valid.slice(0, -1)), null);

  const corrupt = valid.slice();
  corrupt[corrupt.length - 1] ^= 0xff;
  assert.equal(pngDimensions(corrupt), null);
});

test("adminupload kategoriserar känd appbild till canonical och mirror", async () => {
  const assets = fakeR2();
  const response = await worker.fetch(request("/api/assets/upload/plex-t2-1254x1254.png", {
    method: "PUT",
    body: pngBody(1254, 1254),
    headers: { cookie: ADMIN_COOKIE, "content-type": "image/png" },
  }), env(fakeR2(), assets));

  assert.equal(response.status, 201);
  const result = await response.json();
  assert.equal(result.categorized, true);
  assert.equal(result.replaced, false);
  assert.equal(result.asset.key, "apps/plex/plex-2.png");
  assert.equal(result.asset.theme, "2");
  assert.equal(result.asset.pixelSize, 1254);
  assert.equal(result.mirrorKey, "hotlink-ok/apps/plex/plex-2.png");
  assert.equal(assets.has("apps/plex/plex-2.png"), true);
  assert.equal(assets.has("hotlink-ok/apps/plex/plex-2.png"), true);
});

test("kategoriserad appupload rullar tillbaka ny spegel om canonical write misslyckas", async () => {
  const assets = fakeR2();
  const originalPut = assets.put.bind(assets);
  assets.put = async (key, body, options = {}) => {
    if (key === "apps/plex/plex-2.png") throw new Error("simulated canonical put failure");
    return originalPut(key, body, options);
  };

  await assert.rejects(
    () => worker.fetch(request("/api/assets/upload/plex-t2-1254x1254.png", {
      method: "PUT",
      body: pngBody(1254, 1254),
      headers: { cookie: ADMIN_COOKIE, "content-type": "image/png" },
    }), env(fakeR2(), assets)),
    /simulated canonical put failure/,
  );
  assert.equal(assets.has("apps/plex/plex-2.png"), false);
  assert.equal(assets.has("hotlink-ok/apps/plex/plex-2.png"), false);
});

test("kategoriserad appupload nekar fel pixelmått", async () => {
  const assets = fakeR2();
  const response = await worker.fetch(request("/api/assets/upload/plex-t2-512x512.png", {
    method: "PUT",
    body: pngBody(256, 256),
    headers: { cookie: ADMIN_COOKIE, "content-type": "image/png" },
  }), env(fakeR2(), assets));

  assert.equal(response.status, 422);
  assert.equal(assets.keys().length, 0);
});

test("kategoriserad appupload kräver explicit ersättning för befintlig canonical", async () => {
  const assets = fakeR2([{
    key: "apps/plex/plex-2.png",
    uploaded: new Date("2026-10-04T00:00:00Z"),
    body: pngBody(1254, 1254),
    httpMetadata: { contentType: "image/png" },
  }]);

  const denied = await worker.fetch(request("/api/assets/upload/plex-t2-1254x1254.png", {
    method: "PUT",
    body: pngBody(1254, 1254),
    headers: { cookie: ADMIN_COOKIE, "content-type": "image/png" },
  }), env(fakeR2(), assets));
  assert.equal(denied.status, 409);

  const replaced = await worker.fetch(request("/api/assets/upload/plex-t2-1254x1254.png?replace=1", {
    method: "PUT",
    body: pngBody(1254, 1254),
    headers: { cookie: ADMIN_COOKIE, "content-type": "image/png" },
  }), env(fakeR2(), assets));
  assert.equal(replaced.status, 201);
  const result = await replaced.json();
  assert.equal(result.replaced, true);
  assert.equal(assets.has("hotlink-ok/apps/plex/plex-2.png"), true);
});

test("objektlista kräver admininloggning", async () => {
  const response = await worker.fetch(request("/api/objects"), env(fakeR2(versions)));
  assert.equal(response.status, 401);
});

test("objektlista nekar ogiltig GitHub-session", async () => {
  const response = await worker.fetch(request("/api/objects", { headers: { cookie: "__Host-dumpen_session=invalid" } }), env(fakeR2(versions)));
  assert.equal(response.status, 401);
});

test("objektlista grupperar versioner och döljer intern ticket-metadata", async () => {
  const r2 = fakeR2([...versions, { key: "backup/4000.zip", uploaded: new Date(4000), body: "backup" }]);
  const e = env(r2);
  await mintTicket(e);
  const response = await worker.fetch(request("/api/objects", { headers: { cookie: ADMIN_COOKIE } }), e);
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.objects.length, 2);
  assert.equal(data.objects.some((x) => x.name === "_system"), false);
  assert.equal(data.objects.find((x) => x.name === "regelverk").versions, 3);
});

test("objektlista ger 503 om GitHub OAuth-secret saknas", async () => {
  const e = env();
  delete e.GITHUB_OAUTH_CLIENT_SECRET;
  const response = await worker.fetch(request("/api/objects", { headers: { cookie: ADMIN_COOKIE } }), e);
  assert.equal(response.status, 503);
});


test("legacy GET skickar även autentiserade besökare via GitHub-skyddad adminväg utan R2-läsning", async () => {
  for (const headers of [{}, { cookie: ADMIN_COOKIE }]) {
    const response = await worker.fetch(request("/regelverk?n=2", { headers }), env({
      list() { throw new Error("Legacy route must not read storage"); },
      get() { throw new Error("Legacy route must not read storage"); },
    }));
    assert.equal(response.status, 302);
    assert.equal(response.headers.get("location"), "https://dumpen.denied.se/api/download/regelverk?n=2");
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(await response.text(), "");
  }
});


test("dubbla snedstreck kan inte kringgå Access-routens sökväg", async () => {
  for (const path of ["//api/download/regelverk", "/api//download/regelverk", "/api//tickets"]) {
    const response = await worker.fetch(request(path, { headers: { cookie: ADMIN_COOKIE } }), env({
      list() { throw new Error("Noncanonical route must not read storage"); },
    }));
    assert.equal(response.status, 307);
    assert.equal(new URL(response.headers.get("location")).pathname, "/" + path.split("/").filter(Boolean).join("/"));
  }
});


test("publik startsida leder till GitHub Auth före privata kontrollpanelen", async () => {
  const publicPage = await worker.fetch(request("/"), env());
  const publicHtml = await publicPage.text();
  assert.match(publicHtml, /href="\/admin"/);
  assert.doesNotMatch(publicHtml, /<form id="login"/);

  const adminRedirect = await worker.fetch(request("/admin"), env());
  assert.equal(adminRedirect.status, 303);
  assert.equal(adminRedirect.headers.get("location"), "/login?return_to=%2Fadmin");

  const adminPage = await worker.fetch(request("/admin", { headers: { cookie: ADMIN_COOKIE } }), env());
  assert.equal(adminPage.status, 200);
  const adminHtml = await adminPage.text();
  assert.doesNotMatch(adminHtml, /<form id="login"/);
  assert.match(adminHtml, /GitHub Auth verifierad/);
  assert.match(adminHtml, />Bilder </);
  assert.match(adminHtml, /id="asset-app-grid"/);
  assert.match(adminHtml, /id="asset-other-files"/);
  assert.equal((adminHtml.match(/id="asset-files"/g) || []).length, 1);
  assert.match(adminHtml, /id="asset-filter-app"/);
  assert.match(adminHtml, /id="asset-filter-size"/);
  assert.match(adminHtml, /id="asset-filter-theme"/);
  assert.match(adminHtml, />App\s*</);
  assert.match(adminHtml, />Tema\s*</);
  assert.match(adminHtml, />Storlek\s*</);
  assert.match(adminHtml, /Original 1254/);
  assert.match(adminHtml, /id="replace-app-assets"/);
  assert.match(adminHtml, /findPreview/);
  assert.match(adminHtml, /pixelSize===256/);
  assert.match(adminHtml, /asset\.appCategory/);
  assert.match(adminHtml, /asset\.theme/);
  assert.match(adminHtml, /asset\.pixelSize/);
  assert.match(adminHtml, /id="asset-status" class="asset-status" role="status" aria-live="polite" aria-atomic="true"/);
  assert.match(adminHtml, /renderAssets\(data\.assets\|\|\[\],data\.assetState\|\|'available'\)/);
  assert.match(adminHtml, /appbilder kategoriserade/);
  assert.match(adminHtml, /Assetlagret är tillfälligt otillgängligt/);
});
