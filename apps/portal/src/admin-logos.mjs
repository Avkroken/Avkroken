import { authorizeLogoAdmin } from "./access-auth.mjs";
import {
  LOGO_ASSET_ID_PATTERN,
  PUBLIC_LOGO_CONTENT_TYPES,
  STORAGE_LOGO_KEY_PREFIX,
  logoStorageKey
} from "./logo-assets.mjs";

export const MAX_LOGO_BYTES = 5 * 1024 * 1024;
const ADMIN_PAGE_PREFIX = "/admin/logos";
const ADMIN_API_PREFIX = "/api/admin/logos";
const ADMIN_HEADERS = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff"
};
const ADMIN_PAGE_HEADERS = {
  ...ADMIN_HEADERS,
  "Content-Security-Policy": "default-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'; img-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY"
};

export function isAdminLogoPage(pathname) {
  const path = String(pathname || "");
  return path === ADMIN_PAGE_PREFIX || path === `${ADMIN_PAGE_PREFIX}/` ||
    path.startsWith(`${ADMIN_PAGE_PREFIX}/`);
}

export function isAdminLogoApi(pathname) {
  const path = String(pathname || "");
  return path === ADMIN_API_PREFIX || path === `${ADMIN_API_PREFIX}/` ||
    path.startsWith(`${ADMIN_API_PREFIX}/`);
}

function adminJson(value, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      ...ADMIN_HEADERS,
      "Content-Type": "application/json; charset=utf-8",
      ...extraHeaders
    }
  });
}

function deniedResponse(auth, html) {
  if (html && auth.status !== 503) {
    return new Response(null, {
      status: 302,
      headers: {
        ...ADMIN_PAGE_HEADERS,
        Location: "https://avkroken.denied.se/access-denied/identity/"
      }
    });
  }
  return adminJson({ status: "error", error: auth.error }, auth.status);
}

function storageUnavailable() {
  return adminJson({ status: "error", error: "logo_storage_not_configured" }, 503);
}

function normalizedContentType(value) {
  return String(value || "").split(";", 1)[0].trim().toLowerCase();
}

function safeOriginalName(value) {
  const parts = String(value || "logo")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .split(/[\\/]/);
  return (parts.at(-1) || "logo").trim().slice(0, 255) || "logo";
}

function bytesStartWith(bytes, expected) {
  return expected.every((value, index) => bytes[index] === value);
}

function ascii(bytes, start, length) {
  return String.fromCharCode(...bytes.slice(start, start + length));
}

function validSvg(bytes) {
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return false;
  }
  const normalized = text.trimStart().replace(/^<\?xml[^>]*>\s*/i, "");
  if (!normalized.startsWith("<svg") && !normalized.startsWith("<!--")) return false;
  if (!/<svg(?:\s|>)/i.test(normalized)) return false;
  return !/<(?:script|iframe|object|embed)\b|\son[a-z]+\s*=|(?:href|src)\s*=\s*["']\s*(?:javascript:|data:text\/html)/i.test(normalized);
}

export function contentMatchesType(bytes, contentType) {
  if (contentType === "image/png") {
    return bytesStartWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  }
  if (contentType === "image/jpeg") return bytesStartWith(bytes, [0xff, 0xd8, 0xff]);
  if (contentType === "image/gif") return ascii(bytes, 0, 6) === "GIF87a" || ascii(bytes, 0, 6) === "GIF89a";
  if (contentType === "image/webp") return ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP";
  if (contentType === "image/avif") {
    return ascii(bytes, 4, 4) === "ftyp" && /^(?:avif|avis|mif1|msf1)$/.test(ascii(bytes, 8, 4));
  }
  if (contentType === "image/svg+xml") return validSvg(bytes);
  return false;
}

function assetIdFromApiPath(pathname) {
  const suffix = String(pathname || "").slice(ADMIN_API_PREFIX.length);
  const match = suffix.match(/^\/([^/]+)(?:\/(download))?\/?$/);
  if (!match || !LOGO_ASSET_ID_PATTERN.test(match[1])) return null;
  return { id: match[1], download: match[2] === "download" };
}

function metadataForObject(id, object) {
  return {
    id,
    publicUrl: `/media/logos/${encodeURIComponent(id)}`,
    originalName: safeOriginalName(object.customMetadata?.originalName),
    createdAt: object.customMetadata?.createdAt || null,
    updatedAt: object.customMetadata?.updatedAt || null,
    size: Number(object.size || 0),
    etag: object.httpEtag || (object.etag ? `"${object.etag}"` : null),
    contentType: normalizedContentType(object.httpMetadata?.contentType)
  };
}

async function listAssets(bucket) {
  const objects = [];
  let cursor;
  do {
    const page = await bucket.list({
      prefix: STORAGE_LOGO_KEY_PREFIX,
      limit: 1000,
      cursor,
      include: ["httpMetadata", "customMetadata"]
    });
    objects.push(...page.objects);
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor && objects.length < 10000);

  const assets = objects
    .filter(object => object.key.startsWith(STORAGE_LOGO_KEY_PREFIX))
    .map(object => ({
      id: object.key.slice(STORAGE_LOGO_KEY_PREFIX.length),
      object
    }))
    .filter(item => LOGO_ASSET_ID_PATTERN.test(item.id))
    .map(item => metadataForObject(item.id, item.object));

  return adminJson({ status: "available", assets });
}

async function readUpload(request) {
  const contentType = normalizedContentType(request.headers.get("Content-Type"));
  if (!PUBLIC_LOGO_CONTENT_TYPES.has(contentType)) {
    return { error: adminJson({ status: "error", error: "unsupported_media_type" }, 415) };
  }

  const declaredLength = Number(request.headers.get("Content-Length") || 0);
  if (declaredLength > MAX_LOGO_BYTES) {
    return { error: adminJson({ status: "error", error: "logo_too_large" }, 413) };
  }

  const buffer = await request.arrayBuffer();
  if (buffer.byteLength === 0) {
    return { error: adminJson({ status: "error", error: "empty_logo" }, 400) };
  }
  if (buffer.byteLength > MAX_LOGO_BYTES) {
    return { error: adminJson({ status: "error", error: "logo_too_large" }, 413) };
  }

  const bytes = new Uint8Array(buffer);
  if (!contentMatchesType(bytes, contentType)) {
    return { error: adminJson({ status: "error", error: "content_type_mismatch" }, 415) };
  }

  return {
    buffer,
    contentType,
    originalName: safeOriginalName(request.headers.get("X-File-Name"))
  };
}

async function uploadAsset(request, bucket) {
  const upload = await readUpload(request);
  if (upload.error) return upload.error;

  const id = crypto.randomUUID().toLowerCase();
  const now = new Date().toISOString();
  const key = logoStorageKey(id);
  await bucket.put(key, upload.buffer, {
    httpMetadata: { contentType: upload.contentType },
    customMetadata: { originalName: upload.originalName, createdAt: now, updatedAt: now }
  });
  const object = await bucket.head(key);
  return adminJson({ status: "created", asset: metadataForObject(id, object) }, 201, {
    Location: `/api/admin/logos/${id}`
  });
}

async function getMetadata(bucket, id) {
  const object = await bucket.head(logoStorageKey(id));
  if (!object) return adminJson({ status: "error", error: "logo_not_found" }, 404);
  return adminJson({ status: "available", asset: metadataForObject(id, object) });
}

async function downloadAsset(bucket, id) {
  const object = await bucket.get(logoStorageKey(id));
  if (!object) return adminJson({ status: "error", error: "logo_not_found" }, 404);
  const contentType = normalizedContentType(object.httpMetadata?.contentType);
  if (!PUBLIC_LOGO_CONTENT_TYPES.has(contentType)) {
    return adminJson({ status: "error", error: "unsupported_media_type" }, 415);
  }

  const filename = safeOriginalName(object.customMetadata?.originalName);
  const headers = new Headers(ADMIN_HEADERS);
  headers.set("Content-Type", contentType);
  headers.set("Content-Disposition", `attachment; filename="logo"; filename*=UTF-8''${encodeURIComponent(filename)}`);
  if (object.httpEtag) headers.set("ETag", object.httpEtag);
  return new Response(object.body, { status: 200, headers });
}

async function replaceAsset(request, bucket, id) {
  const key = logoStorageKey(id);
  const current = await bucket.head(key);
  if (!current) return adminJson({ status: "error", error: "logo_not_found" }, 404);

  const upload = await readUpload(request);
  if (upload.error) return upload.error;
  const now = new Date().toISOString();
  await bucket.put(key, upload.buffer, {
    httpMetadata: { contentType: upload.contentType },
    customMetadata: {
      originalName: upload.originalName,
      createdAt: current.customMetadata?.createdAt || now,
      updatedAt: now
    }
  });
  const object = await bucket.head(key);
  return adminJson({ status: "updated", asset: metadataForObject(id, object) });
}

async function deleteAsset(bucket, id) {
  const key = logoStorageKey(id);
  const current = await bucket.head(key);
  if (!current) return adminJson({ status: "error", error: "logo_not_found" }, 404);
  await bucket.delete(key);
  return new Response(null, { status: 204, headers: ADMIN_HEADERS });
}

async function handleAuthorizedApi(request, bucket) {
  if (!bucket || typeof bucket.list !== "function") return storageUnavailable();
  const url = new URL(request.url);
  const target = assetIdFromApiPath(url.pathname);

  try {
    if (url.pathname === ADMIN_API_PREFIX || url.pathname === `${ADMIN_API_PREFIX}/`) {
      if (request.method === "GET") return await listAssets(bucket);
      if (request.method === "POST") return await uploadAsset(request, bucket);
      return adminJson({ status: "error", error: "method_not_allowed" }, 405, { Allow: "GET, POST" });
    }
    if (!target) return adminJson({ status: "error", error: "logo_not_found" }, 404);
    if (target.download) {
      if (request.method !== "GET") {
        return adminJson({ status: "error", error: "method_not_allowed" }, 405, { Allow: "GET" });
      }
      return await downloadAsset(bucket, target.id);
    }
    if (request.method === "GET") return await getMetadata(bucket, target.id);
    if (request.method === "PUT") return await replaceAsset(request, bucket, target.id);
    if (request.method === "DELETE") return await deleteAsset(bucket, target.id);
    return adminJson({ status: "error", error: "method_not_allowed" }, 405, { Allow: "GET, PUT, DELETE" });
  } catch {
    return adminJson({ status: "error", error: "logo_storage_unavailable" }, 502);
  }
}

export async function serveAdminLogoApi(request, env, dependencies = {}) {
  const auth = await (dependencies.authorize || authorizeLogoAdmin)(request, env, dependencies.auth);
  if (!auth.ok) return deniedResponse(auth, false);
  return handleAuthorizedApi(request, env.PORTAL_LOGOS);
}

export async function serveAdminLogoPage(request, env, dependencies = {}) {
  const auth = await (dependencies.authorize || authorizeLogoAdmin)(request, env, dependencies.auth);
  if (!auth.ok) return deniedResponse(auth, true);
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { ...ADMIN_PAGE_HEADERS, Allow: "GET, HEAD" }
    });
  }

  const url = new URL(request.url);
  const assetUrl = url.pathname === ADMIN_PAGE_PREFIX || url.pathname === `${ADMIN_PAGE_PREFIX}/`
    ? new URL("/admin/logos/index.html", url.origin)
    : url;
  const response = await env.ASSETS.fetch(new Request(assetUrl, request));
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(ADMIN_PAGE_HEADERS)) {
    headers.set(name, value);
  }
  return new Response(request.method === "HEAD" ? null : response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
