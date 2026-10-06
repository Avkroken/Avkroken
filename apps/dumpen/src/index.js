import { homePage } from "./page.js";
import {
  ASSET_CLAIM_PREFIX,
  ASSET_TICKET_PREFIX,
  isPngBytes,
  isThemeStagingKey,
} from "./asset-upload-ticket.js";
import {
  uploadPublicAsset,
} from "./public-assets.js";
import {
  assetMetadata,
  deleteAsset,
  downloadAsset,
  listAssetLibrary,
  replaceAsset,
  resolveAssetUploadTarget,
} from "./asset-library.js";
import {
  authenticatedGitHubUserId,
  githubAuthConfigurationState,
  handleGitHubCallback,
  logoutGitHub,
  renderGitHubLoginPage,
  startGitHubLogin,
} from "./github-auth.js";

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const MAX_BUCKET_BYTES = 500 * 1024 * 1024;
const DAY_MS = 24 * 60 * 60 * 1000;
const TICKET_TTL_MS = 15 * 60 * 1000;
const INTERNAL_PREFIX = "_system/";
const TICKET_PREFIX = `${INTERNAL_PREFIX}tickets/`;
const CLAIM_PREFIX = `${INTERNAL_PREFIX}claims/`;
const ASSET_MUTATION_LOCK_KEY = `${INTERNAL_PREFIX}asset-mutation-lock.json`;
const ASSET_MUTATION_LOCK_TTL_MS = 2 * 60 * 1000;

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

function transferObjects(objects) {
  return contentObjects(objects).filter((obj) => !obj.key.startsWith("public/"));
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

async function adminDenied(req, env) {
  if (githubAuthConfigurationState(env) !== "ready") {
    return new Response("github admin auth not configured\n", {
      status: 503,
      headers: { "cache-control": "no-store" },
    });
  }
  try {
    if (await authenticatedGitHubUserId(req, env)) return null;
  } catch (error) {
    console.error("Dumpen GitHub session validation failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return new Response("github admin auth unavailable\n", {
      status: 503,
      headers: { "cache-control": "no-store" },
    });
  }
  return new Response("authentication required\n", {
    status: 401,
    headers: { "cache-control": "no-store" },
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
  for (const obj of transferObjects(objects)) {
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

async function acquireAssetMutationLock(env) {
  const token = randomHex(16);
  const payload = JSON.stringify({
    token,
    expiresAt: Date.now() + ASSET_MUTATION_LOCK_TTL_MS,
  });
  const options = {
    onlyIf: new Headers({ "if-none-match": "*" }),
    httpMetadata: { contentType: "application/json" },
  };

  let result = await env.DUMPEN.put(ASSET_MUTATION_LOCK_KEY, payload, options);
  if (result !== null) return token;

  const existing = await env.DUMPEN.get(ASSET_MUTATION_LOCK_KEY);
  if (existing) {
    try {
      const state = JSON.parse(await r2Text(existing));
      if (Number(state.expiresAt) <= Date.now() && existing.etag) {
        result = await env.DUMPEN.put(ASSET_MUTATION_LOCK_KEY, payload, {
          ...options,
          onlyIf: { etagMatches: existing.etag },
        });
        if (result !== null) return token;
      }
    } catch {
      return null;
    }
  }
  return null;
}

async function releaseAssetMutationLock(env, token) {
  try {
    const existing = await env.DUMPEN.get(ASSET_MUTATION_LOCK_KEY);
    if (!existing?.etag) return;
    const state = JSON.parse(await r2Text(existing));
    if (state.token !== token) return;
    await env.DUMPEN.put(
      ASSET_MUTATION_LOCK_KEY,
      JSON.stringify({ token: null, expiresAt: 0 }),
      {
        onlyIf: { etagMatches: existing.etag },
        httpMetadata: { contentType: "application/json" },
      },
    );
  } catch (error) {
    console.error("Dumpen asset mutation lock release failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    // The committed mutation remains authoritative; the lock TTL recovers cleanup failures.
  }
}

async function serializedAssetMutation(env, operation) {
  let token = null;
  for (let attempt = 0; attempt < 40 && !token; attempt += 1) {
    token = await acquireAssetMutationLock(env);
    if (!token) await new Promise((resolve) => setTimeout(resolve, 50));
  }
  if (!token) return { busy: true };
  let value;
  try {
    value = await operation();
  } catch (error) {
    await releaseAssetMutationLock(env, token);
    throw error;
  }
  await releaseAssetMutationLock(env, token);
  return { busy: false, value };
}

async function bufferAssetMutationRequest(req) {
  const declaredLength = Number(req.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_UPLOAD_BYTES) {
    return { response: new Response("too large\n", { status: 413 }) };
  }
  const body = await req.arrayBuffer();
  if (!body.byteLength) {
    return { response: Response.json({ error: "Tom fil kan inte laddas upp." }, { status: 400 }) };
  }
  if (body.byteLength > MAX_UPLOAD_BYTES) {
    return { response: new Response("too large\n", { status: 413 }) };
  }
  return {
    request: new Request(req.url, {
      method: req.method,
      headers: req.headers,
      body,
    }),
  };
}

function assetMutationBusyResponse() {
  return Response.json({
    error: "asset_upload_busy",
    retryAfterMs: 250,
  }, {
    status: 409,
    headers: {
      "cache-control": "no-store",
      "retry-after": "1",
    },
  });
}

async function createUploadTicket(req, env) {
  const denied = await adminDenied(req, env);
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

async function createAssetUploadTicket(req, env) {
  const denied = await adminDenied(req, env);
  if (denied) return denied;
  if (!env.ASSETS) return new Response("asset storage not configured\n", { status: 503 });

  let payload;
  try {
    payload = await req.json();
  } catch {
    return new Response("invalid json\n", { status: 400 });
  }
  const targetKey = String(payload?.targetKey || "");
  if (!isThemeStagingKey(targetKey)) {
    return new Response("invalid staging key\n", { status: 400 });
  }

  const token = randomHex(32);
  const digest = await sha256Hex(token);
  const expiresAt = Date.now() + TICKET_TTL_MS;
  await env.DUMPEN.put(
    `${ASSET_TICKET_PREFIX}${digest}.json`,
    JSON.stringify({
      kind: "asset-upload",
      targetKey,
      contentType: "image/png",
      expiresAt,
      maxBytes: MAX_UPLOAD_BYTES,
    }),
    { httpMetadata: { contentType: "application/json" } },
  );

  const origin = new URL(req.url).origin;
  return Response.json({
    uploadUrl: `${origin}/api/asset-upload/${token}`,
    targetKey,
    expiresAt: new Date(expiresAt).toISOString(),
    maxUploadBytes: MAX_UPLOAD_BYTES,
    oneTime: true,
  }, { status: 201, headers: { "cache-control": "no-store" } });
}

async function claimAtPrefix(bucket, prefix, digest) {
  const condition = new Headers({ "if-none-match": "*" });
  const result = await bucket.put(
    `${prefix}${digest}`,
    String(Date.now()),
    { onlyIf: condition, httpMetadata: { contentType: "text/plain" } },
  );
  return result !== null;
}

export async function claimTicket(bucket, digest) {
  return claimAtPrefix(bucket, CLAIM_PREFIX, digest);
}

async function claimAssetTicket(bucket, digest) {
  return claimAtPrefix(bucket, ASSET_CLAIM_PREFIX, digest);
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

async function assetCapabilityUpload(req, env, token) {
  if (!/^[0-9a-f]{64}$/i.test(token || "")) {
    return new Response("invalid asset upload ticket\n", { status: 404 });
  }
  if (!env.ASSETS) return new Response("asset storage not configured\n", { status: 503 });

  const digest = await sha256Hex(token);
  const ticketKey = `${ASSET_TICKET_PREFIX}${digest}.json`;
  const ticketObject = await env.DUMPEN.get(ticketKey);
  if (!ticketObject) {
    return new Response("invalid or used asset upload ticket\n", { status: 410 });
  }

  let ticket;
  try {
    ticket = JSON.parse(await r2Text(ticketObject));
  } catch {
    return new Response("invalid asset upload ticket\n", { status: 410 });
  }

  if (ticket?.kind !== "asset-upload" || !isThemeStagingKey(ticket?.targetKey)) {
    return new Response("invalid asset upload ticket\n", { status: 410 });
  }
  if (!Number.isFinite(ticket.expiresAt) || ticket.expiresAt <= Date.now()) {
    await env.DUMPEN.delete(ticketKey);
    return new Response("asset upload ticket expired\n", { status: 410 });
  }

  const maxBytes = Math.min(Number(ticket.maxBytes) || MAX_UPLOAD_BYTES, MAX_UPLOAD_BYTES);
  const declaredLength = Number(req.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    return new Response("too large\n", { status: 413 });
  }

  const body = await req.arrayBuffer();
  if (body.byteLength > maxBytes) return new Response("too large\n", { status: 413 });
  if (!isPngBytes(body)) return new Response("png required\n", { status: 415 });

  const mutation = await serializedAssetMutation(env, async () => {
    if (await env.ASSETS.head(ticket.targetKey)) {
      await env.DUMPEN.delete(ticketKey);
      return new Response("asset already exists\n", { status: 409 });
    }

    const existing = await listAll(env.ASSETS);
    const usedBytes = existing.reduce((sum, object) => sum + (Number(object.size) || 0), 0);
    if (usedBytes + body.byteLength > MAX_BUCKET_BYTES) {
      return new Response("asset storage full\n", { status: 507 });
    }

    if (!(await claimAssetTicket(env.DUMPEN, digest))) {
      return new Response("asset upload ticket already used\n", { status: 409 });
    }

    const onlyIf = new Headers({ "if-none-match": "*" });
    let result;
    try {
      result = await env.ASSETS.put(ticket.targetKey, body, {
        onlyIf,
        httpMetadata: {
          contentType: "image/png",
          cacheControl: "max-age=31536000",
        },
        customMetadata: {
          kind: "theme-v2-staging",
          source: "one-time-asset-capability",
        },
      });
    } finally {
      await env.DUMPEN.delete(ticketKey);
    }

    if (result === null) return new Response("asset already exists\n", { status: 409 });
    return Response.json({
      key: ticket.targetKey,
      size: body.byteLength,
    }, {
      status: 201,
      headers: { "cache-control": "no-store" },
    });
  });

  if (mutation.busy) return assetMutationBusyResponse();
  return mutation.value;
}

async function downloadByName(req, env, name, url) {
  const denied = await adminDenied(req, env);
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

    if (url.pathname === "/login") {
      if (req.method !== "GET") return new Response("method\n", { status: 405 });
      return renderGitHubLoginPage(req, githubAuthConfigurationState(env));
    }

    if (url.pathname === "/auth/start") {
      if (req.method !== "GET") return new Response("method\n", { status: 405 });
      try {
        return await startGitHubLogin(req, env);
      } catch (error) {
        console.error("Dumpen GitHub OAuth start failed", {
          error: error instanceof Error ? error.message : String(error),
        });
        return renderGitHubLoginPage(
          new Request("https://dumpen.denied.se/login?error=config"),
          "misconfigured",
        );
      }
    }

    if (url.pathname === "/auth/callback") {
      if (req.method !== "GET") return new Response("method\n", { status: 405 });
      return handleGitHubCallback(req, env);
    }

    if (url.pathname === "/auth/logout") {
      if (req.method !== "POST") return new Response("method\n", { status: 405 });
      return logoutGitHub();
    }

    if (segments[0] === "api" && segments[1] === "objects") {
      if (req.method !== "GET") return new Response("method\n", { status: 405 });
      const denied = await adminDenied(req, env);
      if (denied) return denied;
      const allObjects = await listAll(env.DUMPEN);
      return Response.json({
        objects: groupedObjects(allObjects),
      }, {
        headers: { "cache-control": "no-store" },
      });
    }

    if (segments[0] === "api" && segments[1] === "assets" && segments.length === 2) {
      if (req.method !== "GET") return new Response("method\n", { status: 405 });
      const denied = await adminDenied(req, env);
      if (denied) return denied;
      if (!env.ASSETS) {
        return Response.json({ assets: [], assetState: "not_configured" }, {
          headers: { "cache-control": "no-store" },
        });
      }
      try {
        return Response.json({
          assets: await listAssetLibrary(env.ASSETS),
          assetState: "available",
        }, {
          headers: { "cache-control": "no-store" },
        });
      } catch {
        return Response.json({ assets: [], assetState: "unavailable" }, {
          headers: { "cache-control": "no-store" },
        });
      }
    }

    if (segments[0] === "api" && segments[1] === "assets" && segments[2] === "item") {
      const denied = await adminDenied(req, env);
      if (denied) return denied;
      if (!env.ASSETS) return new Response("asset storage not configured\n", { status: 503 });
      const key = url.searchParams.get("key") || "";

      if (req.method === "GET" && url.searchParams.get("download") === "1") {
        return (await downloadAsset(env.ASSETS, key)).response;
      }
      if (req.method === "GET") {
        const asset = await assetMetadata(env.ASSETS, key);
        if (!asset) return Response.json({ error: "asset_not_found" }, {
          status: 404,
          headers: { "cache-control": "no-store" },
        });
        return Response.json({ asset }, { headers: { "cache-control": "no-store" } });
      }
      if (req.method === "PUT") {
        const buffered = await bufferAssetMutationRequest(req);
        if (buffered.response) return buffered.response;
        const mutation = await serializedAssetMutation(env, () => replaceAsset(buffered.request, env.ASSETS, key, {
          maxUploadBytes: MAX_UPLOAD_BYTES,
          maxBucketBytes: MAX_BUCKET_BYTES,
        }));
        if (mutation.busy) return assetMutationBusyResponse();
        const result = mutation.value;
        if (result.response) return result.response;
        return Response.json({
          asset: result.asset,
          categorized: result.categorized,
          replaced: result.replaced,
          mirrorKey: result.mirrorKey || null,
        }, {
          headers: { "cache-control": "no-store" },
        });
      }
      if (req.method === "DELETE") {
        const mutation = await serializedAssetMutation(env, () => deleteAsset(env.ASSETS, key));
        if (mutation.busy) return assetMutationBusyResponse();
        const result = mutation.value;
        if (result.status === 204) {
          return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
        }
        return Response.json({ error: result.error }, {
          status: result.status,
          headers: { "cache-control": "no-store" },
        });
      }
      return new Response("method\n", { status: 405 });
    }

    if (segments[0] === "api" && segments[1] === "assets" && segments[2] === "uploads") {
      if (req.method !== "POST") return new Response("method\n", { status: 405 });
      const denied = await adminDenied(req, env);
      if (denied) return denied;
      if (!env.ASSETS) return new Response("asset storage not configured\n", { status: 503 });

      const resolved = resolveAssetUploadTarget(url.searchParams.get("name") || "", {
        app: url.searchParams.get("app"),
        theme: url.searchParams.get("theme"),
        size: url.searchParams.get("size"),
      });
      if (resolved.error) {
        return Response.json({ error: resolved.error }, {
          status: 400,
          headers: { "cache-control": "no-store" },
        });
      }

      const buffered = await bufferAssetMutationRequest(req);
      if (buffered.response) return buffered.response;
      const mutation = await serializedAssetMutation(env, () => uploadPublicAsset(
        buffered.request,
        env.ASSETS,
        encodeURIComponent(resolved.name),
        {
          maxUploadBytes: MAX_UPLOAD_BYTES,
          maxBucketBytes: MAX_BUCKET_BYTES,
        },
        {
          overwriteAppAsset: url.searchParams.get("replace") === "1",
        },
      ));
      if (mutation.busy) return assetMutationBusyResponse();
      const result = mutation.value;
      if (result.response) return result.response;
      return Response.json({
        asset: result.asset,
        categorized: result.categorized,
        replaced: result.replaced,
        mirrorKey: result.mirrorKey || null,
        explicitTarget: resolved.explicit,
      }, {
        status: 201,
        headers: { "cache-control": "no-store" },
      });
    }

    if (segments[0] === "api" && segments[1] === "assets" && segments[2] === "tickets") {
      if (req.method !== "POST") return new Response("method\n", { status: 405 });
      return createAssetUploadTicket(req, env);
    }

    if (segments[0] === "api" && segments[1] === "assets" && segments[2] === "upload") {
      if (req.method !== "PUT" || !segments[3]) return new Response("method\n", { status: 405 });
      const denied = await adminDenied(req, env);
      if (denied) return denied;
      if (!env.ASSETS) return new Response("asset storage not configured\n", { status: 503 });
      const buffered = await bufferAssetMutationRequest(req);
      if (buffered.response) return buffered.response;
      const mutation = await serializedAssetMutation(env, () => uploadPublicAsset(
        buffered.request,
        env.ASSETS,
        segments[3],
        {
          maxUploadBytes: MAX_UPLOAD_BYTES,
          maxBucketBytes: MAX_BUCKET_BYTES,
        },
        {
          overwriteAppAsset: url.searchParams.get("replace") === "1",
        },
      ));
      if (mutation.busy) return assetMutationBusyResponse();
      const result = mutation.value;
      if (result.response) return result.response;
      return Response.json({
        asset: result.asset,
        categorized: result.categorized,
        replaced: result.replaced,
        mirrorKey: result.mirrorKey || null,
      }, {
        status: 201,
        headers: { "cache-control": "no-store" },
      });
    }

    if (segments[0] === "api" && segments[1] === "asset-upload") {
      if (req.method !== "PUT") return new Response("method\n", { status: 405 });
      return assetCapabilityUpload(req, env, segments[2]);
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
      const adminPage = name === "admin";
      if (adminPage) {
        if (githubAuthConfigurationState(env) !== "ready") {
          return new Response(null, {
            status: 303,
            headers: { location: "/login?error=config&return_to=%2Fadmin", "cache-control": "no-store" },
          });
        }
        let userId = null;
        try {
          userId = await authenticatedGitHubUserId(req, env);
        } catch (error) {
          console.error("Dumpen GitHub admin validation failed", {
            error: error instanceof Error ? error.message : String(error),
          });
        }
        if (!userId) {
          return new Response(null, {
            status: 303,
            headers: { location: "/login?return_to=%2Fadmin", "cache-control": "no-store" },
          });
        }
      }
      const stats = objectStats(await listAll(env.DUMPEN));
      return new Response(homePage(stats, {
        maxUploadBytes: MAX_UPLOAD_BYTES,
        maxBucketBytes: MAX_BUCKET_BYTES,
        automaticDeletion: false,
        ticketTtlMinutes: TICKET_TTL_MS / 60000,
        adminPage,
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
      // Alla äldre nedladdningslänkar går genom samma GitHub-session-skyddade adminväg.
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
