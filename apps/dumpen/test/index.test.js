import test from "node:test";
import assert from "node:assert/strict";
import worker, { claimTicket } from "../src/index.js";

const TOKEN = "test-token";
const ADMIN_USER = "admin";
const ADMIN_PASSWORD = "correct-horse";
const MiB = 1024 * 1024;

function sizeOf(body) {
  if (body?.byteLength != null) return body.byteLength;
  return new TextEncoder().encode(String(body ?? "")).byteLength;
}

function fakeR2(seed = []) {
  const objects = new Map(seed.map(({ key, uploaded, body = "", size }) => [key, {
    key, uploaded, body, size: size ?? sizeOf(body),
  }]));
  return {
    puts: [],
    async put(key, body, options = {}) {
      const onlyIf = options.onlyIf;
      const ifNoneMatch = onlyIf instanceof Headers ? onlyIf.get("if-none-match") : null;
      if (ifNoneMatch === "*" && objects.has(key)) return null;
      this.puts.push({ key, body, options });
      const timestamp = Number(key.match(/\/(\d+)\.zip$/)?.[1] || Date.now());
      const entry = { key, uploaded: new Date(timestamp), body, size: sizeOf(body) };
      objects.set(key, entry);
      return { key, etag: `etag-${this.puts.length}` };
    },
    async delete(key) {
      objects.delete(key);
    },
    async list({ prefix = "" } = {}) {
      return {
        objects: [...objects.values()]
          .filter((o) => o.key.startsWith(prefix))
          .map(({ key, uploaded, size }) => ({ key, uploaded, size })),
        truncated: false,
      };
    },
    async get(key) {
      const obj = objects.get(key);
      if (!obj) return null;
      return {
        body: obj.body,
        async text() {
          if (typeof obj.body === "string") return obj.body;
          if (obj.body instanceof ArrayBuffer) return new TextDecoder().decode(obj.body);
          if (ArrayBuffer.isView(obj.body)) return new TextDecoder().decode(obj.body);
          return String(obj.body ?? "");
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

function env(r2 = fakeR2()) {
  return {
    DUMPEN_TOKEN: TOKEN,
    DUMPEN_ADMIN_USER: ADMIN_USER,
    DUMPEN_ADMIN_PASSWORD: ADMIN_PASSWORD,
    DUMPEN: r2,
  };
}

function basic(user = ADMIN_USER, password = ADMIN_PASSWORD) {
  return `Basic ${btoa(`${user}:${password}`)}`;
}

async function mintTicket(e) {
  const response = await worker.fetch(request("/api/tickets", {
    method: "POST",
    headers: { authorization: basic() },
  }), e);
  assert.equal(response.status, 201);
  return response.json();
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
  assert.match(html, /Vanlig GET är privat/);
  assert.match(html, /--bg:#050505/);
  assert.match(html, /20 MB per fil/);
  assert.match(html, /500 MB totalt/);
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

test("publik nedladdning kräver lösenord bakom Access", async () => {
  const response = await worker.fetch(request("/api/download/regelverk"), env(fakeR2(versions)));
  assert.equal(response.status, 401);
  assert.match(response.headers.get("www-authenticate"), /Basic/);
});

test("autentiserad GET returnerar nyaste", async () => {
  const response = await worker.fetch(request("/api/download/regelverk", { headers: { authorization: basic() } }), env(fakeR2(versions)));
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "new");
  assert.equal(response.headers.get("x-dumpen-key"), "regelverk/3000.zip");
  assert.equal(response.headers.get("cache-control"), "private, no-store");
});

test("autentiserad ?n=2 returnerar näst nyaste", async () => {
  const response = await worker.fetch(request("/api/download/regelverk?n=2", { headers: { authorization: basic() } }), env(fakeR2(versions)));
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "middle");
});

test("autentiserad ?n=99 ger 404", async () => {
  const response = await worker.fetch(request("/api/download/regelverk?n=99", { headers: { authorization: basic() } }), env(fakeR2(versions)));
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
    const ticket = await mintTicket(e);
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

  const privateRead = await worker.fetch(request(`/api/download/${name}`, { headers: { authorization: basic() } }), e);
  assert.equal(privateRead.status, 200);
  assert.equal(await privateRead.text(), "private-data");
});

test("objektlista kräver admininloggning", async () => {
  const response = await worker.fetch(request("/api/objects"), env(fakeR2(versions)));
  assert.equal(response.status, 401);
});

test("objektlista nekar fel lösenord", async () => {
  const response = await worker.fetch(request("/api/objects", { headers: { authorization: basic(ADMIN_USER, "fel") } }), env(fakeR2(versions)));
  assert.equal(response.status, 401);
});

test("objektlista grupperar versioner och döljer intern ticket-metadata", async () => {
  const r2 = fakeR2([...versions, { key: "backup/4000.zip", uploaded: new Date(4000), body: "backup" }]);
  const e = env(r2);
  await mintTicket(e);
  const response = await worker.fetch(request("/api/objects", { headers: { authorization: basic() } }), e);
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.objects.length, 2);
  assert.equal(data.objects.some((x) => x.name === "_system"), false);
  assert.equal(data.objects.find((x) => x.name === "regelverk").versions, 3);
});

test("objektlista ger 503 om adminsecrets saknas", async () => {
  const e = env();
  delete e.DUMPEN_ADMIN_USER;
  delete e.DUMPEN_ADMIN_PASSWORD;
  const response = await worker.fetch(request("/api/objects", { headers: { authorization: basic() } }), e);
  assert.equal(response.status, 503);
});


test("legacy GET skickar även autentiserade besökare via MFA-vägen utan R2-läsning", async () => {
  for (const headers of [{}, { authorization: basic() }]) {
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
    const response = await worker.fetch(request(path, { headers: { authorization: basic() } }), env({
      list() { throw new Error("Noncanonical route must not read storage"); },
    }));
    assert.equal(response.status, 307);
    assert.equal(new URL(response.headers.get("location")).pathname, "/" + path.split("/").filter(Boolean).join("/"));
  }
});


test("publik startsida leder till Access innan lösenordsformuläret visas", async () => {
  const publicPage = await worker.fetch(request("/"), env());
  const publicHtml = await publicPage.text();
  assert.match(publicHtml, /href="\/admin"/);
  assert.doesNotMatch(publicHtml, /<form id="login"/);
  const adminPage = await worker.fetch(request("/admin"), env());
  assert.equal(adminPage.status, 200);
  assert.match(await adminPage.text(), /<form id="login"/);
});
