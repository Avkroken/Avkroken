import {
  classifyAppAssetUploadName,
  listPublicAssets,
  publicAssetRecord,
  safeAssetName,
  uploadPublicAsset,
} from "./public-assets.js";

const MANAGED_KEY = /^uploads\/[0-9a-f]{32}\/[^/]+$/;
const DIRECT_ORIGIN = "https://logos.denied.se";

function encodedDirectUrl(key) {
  return DIRECT_ORIGIN + "/" + String(key)
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

function contentTypeFromName(name) {
  const ext = String(name || "").toLowerCase().split(".").pop();
  const types = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif",
    avif: "image/avif",
    ico: "image/x-icon",
    svg: "image/svg+xml",
    json: "application/json",
    txt: "text/plain",
    css: "text/css",
    pdf: "application/pdf",
  };
  return types[ext] || "application/octet-stream";
}

function normalizedContentType(value, name) {
  return String(value || "").split(";", 1)[0].trim().toLowerCase() || contentTypeFromName(name);
}

function encodeRfc5987Value(value) {
  return encodeURIComponent(String(value))
    .replace(/['()*]/g, (character) => "%" + character.charCodeAt(0).toString(16).toUpperCase());
}

function appTargetForKey(key) {
  const match = String(key || "").match(/^apps\/([^/]+)\/([^/]+)$/);
  if (!match) return null;
  const target = classifyAppAssetUploadName(match[2]);
  return target?.key === key ? target : null;
}

export function mutableAssetKey(value) {
  const key = String(value || "");
  if (MANAGED_KEY.test(key)) return { key, kind: "managed", target: null };
  const target = appTargetForKey(key);
  if (target) return { key, kind: "app", target };
  return null;
}

export function resolveAssetUploadTarget(rawName, options = {}) {
  const originalName = safeAssetName(rawName);
  if (!originalName) return { error: "Ogiltigt filnamn." };

  const app = String(options.app || "").trim().toLowerCase();
  const theme = String(options.theme || "").trim();
  const size = String(options.size || "").trim();
  const hasExplicitTarget = Boolean(app || theme || size);

  if (!hasExplicitTarget) {
    return { name: originalName, originalName, explicit: false, target: classifyAppAssetUploadName(originalName) };
  }
  if (!app || !theme || !size) {
    return { error: "App, tema och storlek måste anges tillsammans." };
  }

  const pixelSize = Number(size);
  const candidate = pixelSize === 1254
    ? `${app}-${theme}.png`
    : `${app}-${theme}-${pixelSize}.png`;
  const target = classifyAppAssetUploadName(candidate);
  if (!target) return { error: "Ogiltig app, tema eller storlek." };

  return { name: target.canonicalName, originalName, explicit: true, target };
}

export async function listAssetLibrary(bucket) {
  const assets = await listPublicAssets(bucket);
  return assets.map((asset) => ({
    ...asset,
    mutable: Boolean(mutableAssetKey(asset.key)),
  }));
}

export async function assetMetadata(bucket, key) {
  const mutation = mutableAssetKey(key);
  if (!mutation) return null;
  const object = await bucket.head(mutation.key);
  if (!object) return null;
  const asset = publicAssetRecord(object);
  if (!asset) return null;
  return {
    ...asset,
    mutable: true,
  };
}

export async function deleteAsset(bucket, key) {
  const mutation = mutableAssetKey(key);
  if (!mutation) return { status: 404, error: "asset_not_found" };
  const current = await bucket.head(mutation.key);
  if (!current) return { status: 404, error: "asset_not_found" };

  if (mutation.kind === "app") {
    await bucket.delete([mutation.key, mutation.target.mirrorKey]);
  } else {
    await bucket.delete(mutation.key);
  }
  return { status: 204 };
}

export async function downloadAsset(bucket, key) {
  const mutation = mutableAssetKey(key);
  if (!mutation) return { response: Response.json({ error: "asset_not_found" }, { status: 404 }) };
  const object = await bucket.get(mutation.key);
  if (!object) return { response: Response.json({ error: "asset_not_found" }, { status: 404 }) };

  const asset = await assetMetadata(bucket, mutation.key);
  const filename = safeAssetName(asset?.name || mutation.key.split("/").pop()) || "asset";
  const headers = new Headers({
    "cache-control": "private, no-store",
    "content-type": normalizedContentType(object.httpMetadata?.contentType, filename),
    "content-disposition": `attachment; filename="asset"; filename*=UTF-8''${encodeRfc5987Value(filename)}`,
    "x-content-type-options": "nosniff",
  });
  return { response: new Response(object.body, { status: 200, headers }) };
}

async function bucketBytesExcluding(bucket, excludedKey) {
  let total = 0;
  let cursor;
  do {
    const page = await bucket.list({ cursor });
    for (const object of page.objects) {
      if (object.key !== excludedKey) total += Number(object.size) || 0;
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return total;
}

export async function replaceAsset(request, bucket, key, limits) {
  const mutation = mutableAssetKey(key);
  if (!mutation) return { response: Response.json({ error: "asset_not_found" }, { status: 404 }) };
  const current = await bucket.head(mutation.key);
  if (!current) return { response: Response.json({ error: "asset_not_found" }, { status: 404 }) };

  if (mutation.kind === "app") {
    return uploadPublicAsset(
      request,
      bucket,
      mutation.target.canonicalName,
      limits,
      { overwriteAppAsset: true },
    );
  }

  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > limits.maxUploadBytes) {
    return { response: new Response("too large\n", { status: 413 }) };
  }
  const body = await request.arrayBuffer();
  if (!body.byteLength) {
    return { response: Response.json({ error: "Tom fil kan inte ersätta asseten." }, { status: 400 }) };
  }
  if (body.byteLength > limits.maxUploadBytes) {
    return { response: new Response("too large\n", { status: 413 }) };
  }
  if (await bucketBytesExcluding(bucket, mutation.key) + body.byteLength > limits.maxBucketBytes) {
    return { response: new Response("asset storage full\n", { status: 507 }) };
  }

  const name = safeAssetName(current.customMetadata?.originalName || mutation.key.split("/").pop()) || "asset";
  const contentType = normalizedContentType(request.headers.get("content-type"), name);
  const now = new Date().toISOString();
  await bucket.put(mutation.key, body, {
    httpMetadata: {
      contentType,
      cacheControl: "public, max-age=300",
    },
    customMetadata: {
      ...current.customMetadata,
      originalName: name,
      contentType,
      kind: current.customMetadata?.kind || "dumpen-upload",
      updatedAt: now,
    },
  });

  const asset = {
    ...(await assetMetadata(bucket, mutation.key)),
    directUrl: encodedDirectUrl(mutation.key),
  };
  return { asset, categorized: false, replaced: true, mirrorKey: null };
}
