import { homePage } from "./page.js";

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const MAX_BUCKET_BYTES = 500 * 1024 * 1024;
const RETENTION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
const TICKET_TTL_MS = 15 * 60 * 1000;
const INTERNAL_PREFIX = "_system/";
const TICKET_PREFIX = `${INTERNAL_PREFIX}tickets/`;
const CLAIM_PREFIX = `${INTERNAL_PREFIX}claims/`;

async function listAll(bucket, options = {}) {
  const objects = [];
  let cursor;
  do {
    const page = await bucket.list({ ...options, cursor });
    objects.push(...page.objects);
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return objects;
}

function contentObjects(objects) {
  return objects.filter((obj) => !obj.key.startsWith(INTERNAL_PREFIX));
}

function constantTimeEqual(a, b) {
  const aa = new TextEncoder().encode(a);
  const bb = new TextEncoder().encode(b);
  const length = Math.max(aa.length, bb.length);
  let diff = aa.length ^ bb.length;
  for (let i = 0; i < length; i += 1) diff |= (aa[i] || 0) ^ (bb[i] || 0);
  return diff === 0;
}

function uploadAuthorized(req, token) {
  if (!token) return null;
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return false;
  return constantTimeEqual(auth.slice(7), token);
}

function adminAuthorized(req, env) {
  if (!env.DUMPEN_ADMIN_USER || !env.DUMPEN_ADMIN_PASSWORD) return null;
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Basic ")) return false;
  try {
    const decoded = atob(auth.slice(6));
    const separator = decoded.indexOf(":");
    if (separator < 0) return false;
    return constantTimeEqual(decoded.slice(0, separator), env.DUMPEN_ADMIN_USER)
      && constantTimeEqual(decoded.slice(separator + 1), env.DUMPEN_ADMIN_PASSWORD);
  } catch {
    return false;
  }
}

function adminDenied(req, env, realm = "dumpen") {
  const authorized = adminAuthorized(req, env);
  if (authorized === null) return new Response("admin login not configured\n", { status: 503 });
  if (authorized) return null;
  return new Response("nope\n", {
    status: 401,
    headers: { "www-authenticate": `Basic realm="${realm}", charset="UTF-8"` },
  });
}

function objectStats(objects) {
  const visible = contentObjects(objects);
  const totalBytes = visible.reduce((sum, obj) => sum + (obj.size || 0), 0);
  const oldest = visible.reduce((value, obj) => {
    const uploaded = obj.uploaded instanceof Date ? obj.uploaded : new Date(obj.uploaded);
    return !value || uploaded < value ? uploaded : value;
  }, null);
  return {
    totalBytes,
    objectCount: visible.length,
    oldestDays: oldest ? Math.max(0, Math.floor((Date.now() - oldest.getTime()) / DAY_MS)) : null,
  };
}

function groupedObjects(objects) {
  const groups = new Map();
  for (const obj of contentObjects(objects)) {
    const slash = obj.key.indexOf("/");
    const name = slash >= 0 ? obj.key.slice(0, slash) : obj.key;
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(obj);
  }

  return [...groups.entries()].map(([name, versions]) => {
    versions.sort((a, b) => new Date(b.uploaded) - new Date(a.uploaded));
    const latest = versions[0];
    const oldest = versions[versions.length - 1];
    return {
      name,
      versions: versions.length,
      latestSize: latest.size || 0,
      latestUploaded: new Date(latest.uploaded).toISOString(),
      oldestUploaded: new Date(oldest.uploaded).toISOString(),
    };
  }).sort((a, b) => new Date(b.latestUploaded) - new Date(a.latestUploaded));
}

function randomHex(byteLength) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function r2Text(object) {
  if (typeof object.text === "function") return object.text();
  if (typeof object.body === "string") return object.body;
  if (object.body instanceof ArrayBuffer) return new TextDecoder().decode(object.body);
  if (ArrayBuffer.isView(object.body)) return new TextDecoder().decode(object.body);
  return String(object.body ?? "");
}

async function createUploadTicket(req, env) {
  const denied = adminDenied(req, env, "dumpen tickets");
  if (denied) return denied;

  const token = randomHex(32);
  const digest = await sha256Hex(token);
  const expiresAt = Date.now() + TICKET_TTL_MS;
  await env.DUMPEN.put(
    `${TICKET_PREFIX}${digest}.json`,
    JSON.stringify({ expiresAt, maxBytes: MAX_UPLOAD_BYTES }),
    { httpMetadata: { contentType: "application/json" } },
  );

  const origin = new URL(req.url).origin;
  return Response.json({
    uploadUrl: `${origin}/api/upload/${token}`,
    expiresAt: new Date(expiresAt).toISOString(),
    maxUploadBytes: MAX_UPLOAD_BYTES,
    oneTime: true,
  }, { status: 201, headers: { "cache-control": "no-store" } });
}

export async function claimTicket(bucket, digest) {
  const condition = new Headers({ "if-none-match": "*" });
  const result = await bucket.put(
    `${CLAIM_PREFIX}${digest}`,
    String(Date.now()),
    { onlyIf: condition, httpMetadata: { contentType: "text/plain" } },
  );
  return result !== null;
}

function generatedName(now) {
  const day = new Date(now).toISOString().slice(0, 10).replaceAll("-", "");
  return `drop-${day}-${randomHex(6)}`;
}

async function capabilityUpload(req, env, token) {
  if (!/^[0-9a-f]{64}$/i.test(token || "")) return new Response("invalid upload ticket\n", { status: 404 });

  const digest = await sha256Hex(token);
  const ticketKey = `${TICKET_PREFIX}${digest}.json`;
  const ticketObject = await env.DUMPEN.get(ticketKey);
  if (!ticketObject) return new Response("invalid or used upload ticket\n", { status: 410 });

  let ticket;
  try {
    ticket = JSON.parse(await r2Text(ticketObject));
  } catch {
    return new Response("invalid upload ticket\n", { status: 410 });
  }

  if (!Number.isFinite(ticket.expiresAt) || ticket.expiresAt <= Date.now()) {
    await env.DUMPEN.delete(ticketKey);
    return new Response("upload ticket expired\n", { status: 410 });
  }

  const maxBytes = Math.min(Number(ticket.maxBytes) || MAX_UPLOAD_BYTES, MAX_UPLOAD_BYTES);
  const declaredLength = Number(req.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes)
    return new Response("too large\n", { status: 413 });

  const body = await req.arrayBuffer();
  if (body.byteLength > maxBytes) return new Response("too large\n", { status: 413 });

  const currentObjects = contentObjects(await listAll(env.DUMPEN));
  const currentBytes = currentObjects.reduce((sum, obj) => sum + (obj.size || 0), 0);
  if (currentBytes + body.byteLength > MAX_BUCKET_BYTES)
    return new Response("dumpen full\n", { status: 507 });

  if (!(await claimTicket(env.DUMPEN, digest)))
    return new Response("upload ticket already used\n", { status: 409 });

  const now = Date.now();
  const name = generatedName(now);
  const key = `${name}/${now}.zip`;
  await env.DUMPEN.put(key, body, {
    customMetadata: { source: "one-time-capability" },
    httpMetadata: { contentType: "application/zip" },
  });
  await env.DUMPEN.delete(ticketKey);

  return Response.json({ name, key }, {
    status: 201,
    headers: { "cache-control": "no-store" },
  });
}

async function downloadByName(req, env, name, url) {
  const denied = adminDenied(req, env, "dumpen download");
  if (denied) return denied;

  const objects = contentObjects(await listAll(env.DUMPEN, { prefix: `${name}/` }));
  if (!objects.length) return new Response("tomt\n", { status: 404 });

  const sorted = objects.sort((a, b) => new Date(b.uploaded) - new Date(a.uploaded));
  const n = Math.max(1, parseInt(url.searchParams.get("n") || "1", 10));
  const pick = sorted[n - 1];
  if (!pick) return new Response(`bara ${sorted.length} versioner\n`, { status: 404 });

  const obj = await env.DUMPEN.get(pick.key);
  if (!obj) return new Response("tomt\n", { status: 404 });
  return new Response(obj.body, {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${name}.zip"`,
      "cache-control": "private, no-store",
      "x-dumpen-key": pick.key,
      "x-dumpen-count": String(sorted.length),
    },
  });
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const segments = url.pathname.split("/").filter(Boolean);
    const canonicalPath = "/" + segments.join("/");
    if (url.pathname !== canonicalPath) {
      url.pathname = canonicalPath;
      return new Response(null, {
        status: 307,
        headers: { location: url.toString(), "cache-control": "no-store" },
      });
    }

    if (segments[0] === "api" && segments[1] === "objects") {
      if (req.method !== "GET") return new Response("method\n", { status: 405 });
      const denied = adminDenied(req, env, "dumpen objects");
      if (denied) return denied;
      return Response.json({ objects: groupedObjects(await listAll(env.DUMPEN)) }, {
        headers: { "cache-control": "no-store" },
      });
    }

    if (segments[0] === "api" && segments[1] === "tickets") {
      if (req.method !== "POST") return new Response("method\n", { status: 405 });
      return createUploadTicket(req, env);
    }

    if (segments[0] === "api" && segments[1] === "upload") {
      if (req.method !== "PUT") return new Response("method\n", { status: 405 });
      return capabilityUpload(req, env, segments[2]);
    }

    if (segments[0] === "api" && segments[1] === "download") {
      if (req.method !== "GET" || !segments[2]) return new Response("method\n", { status: 405 });
      return downloadByName(req, env, segments[2], url);
    }

    const name = segments[0];
    if (!name || (name === "admin" && segments.length === 1)) {
      if (req.method !== "GET") return new Response("method\n", { status: 405 });
      const stats = objectStats(await listAll(env.DUMPEN));
      return new Response(homePage(stats, {
        maxUploadBytes: MAX_UPLOAD_BYTES,
        maxBucketBytes: MAX_BUCKET_BYTES,
        retentionDays: RETENTION_DAYS,
        ticketTtlMinutes: TICKET_TTL_MS / 60000,
        adminPage: name === "admin",
      }), {
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store",
          "x-content-type-options": "nosniff",
          "referrer-policy": "no-referrer",
        },
      });
    }

    // Legacy authenticated upload kept for existing automation. AI/chat uploads
    // should use /api/tickets + /api/upload/<capability> instead.
    if (req.method === "PUT") {
      const authorized = uploadAuthorized(req, env.DUMPEN_TOKEN);
      if (authorized === null) return new Response("upload token not configured\n", { status: 503 });
      if (!authorized) return new Response("nope\n", { status: 401 });

      const declaredLength = Number(req.headers.get("content-length"));
      if (Number.isFinite(declaredLength) && declaredLength > MAX_UPLOAD_BYTES)
        return new Response("too large\n", { status: 413 });

      const body = await req.arrayBuffer();
      if (body.byteLength > MAX_UPLOAD_BYTES)
        return new Response("too large\n", { status: 413 });

      const currentObjects = contentObjects(await listAll(env.DUMPEN));
      const currentBytes = currentObjects.reduce((sum, obj) => sum + (obj.size || 0), 0);
      if (currentBytes + body.byteLength > MAX_BUCKET_BYTES)
        return new Response("dumpen full\n", { status: 507 });

      const key = `${name}/${Date.now()}.zip`;
      await env.DUMPEN.put(key, body);
      return new Response(`${key}\n`, { status: 201 });
    }

    if (req.method === "GET") {
      // Alla äldre nedladdningslänkar går genom samma Access-skyddade väg.
      // Skicka aldrig filinnehåll direkt från den publika legacy-routen.
      url.pathname = `/api/download/${name}`;
      return new Response(null, {
        status: 302,
        headers: { location: url.toString(), "cache-control": "no-store" },
      });
    }

    return new Response("method\n", { status: 405 });
  },
};
