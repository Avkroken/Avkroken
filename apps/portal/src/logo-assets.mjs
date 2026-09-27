const PUBLIC_LOGO_ROUTE_PREFIX = "/media/logos";
const STORAGE_LOGO_KEY_PREFIX = "logos/";
const LOGO_ASSET_ID_PATTERN = /^[a-z0-9](?:[a-z0-9_-]{0,62}[a-z0-9])?$/;
const PUBLIC_LOGO_CONTENT_TYPES = new Set([
  "image/avif",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/svg+xml",
  "image/webp"
]);

function responseHeaders(cacheControl = "no-store") {
  return {
    "Cache-Control": cacheControl,
    "X-Content-Type-Options": "nosniff"
  };
}

function logoError(status, message, extraHeaders = {}) {
  return new Response(message, {
    status,
    headers: {
      ...responseHeaders(),
      ...extraHeaders
    }
  });
}

export function isPublicLogoRoute(pathname) {
  const path = String(pathname || "");
  return path === PUBLIC_LOGO_ROUTE_PREFIX || path.startsWith(PUBLIC_LOGO_ROUTE_PREFIX + "/");
}

export function logoAssetIdFromPath(pathname) {
  const path = String(pathname || "");
  const match = path.match(/^\/media\/logos\/([^/]+)$/);
  if (!match) return null;

  const assetId = match[1];
  return LOGO_ASSET_ID_PATTERN.test(assetId) ? assetId : null;
}

export function logoStorageKey(assetId) {
  if (!LOGO_ASSET_ID_PATTERN.test(String(assetId || ""))) return null;
  return STORAGE_LOGO_KEY_PREFIX + assetId;
}

function logoContentType(object) {
  const value = String(object?.httpMetadata?.contentType || "").toLowerCase().trim();
  return PUBLIC_LOGO_CONTENT_TYPES.has(value) ? value : null;
}

function parseEntityTagList(value) {
  const tags = [];
  let start = 0;
  let quoted = false;

  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === '"') quoted = !quoted;
    if (value[index] === "," && !quoted) {
      tags.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }

  tags.push(value.slice(start).trim());
  return tags.filter(Boolean);
}

function weakEntityTag(tag) {
  const value = String(tag || "").trim();
  return value.startsWith("W/") ? value.slice(2).trim() : value;
}

function ifNoneMatchMatches(headerValue, currentEtag) {
  if (!headerValue || !currentEtag) return false;

  const current = weakEntityTag(currentEtag);
  return parseEntityTagList(String(headerValue)).some(candidate => {
    if (candidate === "*") return true;
    return weakEntityTag(candidate) === current;
  });
}

export async function servePublicLogo(request, bucket) {
  const url = new URL(request.url);
  if (!isPublicLogoRoute(url.pathname)) return null;

  if (request.method !== "GET" && request.method !== "HEAD") {
    return logoError(405, "Method Not Allowed", { Allow: "GET, HEAD" });
  }

  const assetId = logoAssetIdFromPath(url.pathname);
  const objectKey = logoStorageKey(assetId);
  if (!assetId || !objectKey) {
    return logoError(404, "Not Found");
  }

  if (!bucket || typeof bucket.get !== "function") {
    return logoError(503, "Logo storage is not configured");
  }

  let object;
  try {
    object = await bucket.get(objectKey);
  } catch {
    return logoError(502, "Logo storage is unavailable");
  }

  if (!object) {
    return logoError(404, "Not Found");
  }

  const contentType = logoContentType(object);
  if (!contentType) {
    return logoError(415, "Unsupported Media Type");
  }

  const headers = new Headers(responseHeaders("public, max-age=300, stale-while-revalidate=60"));
  if (typeof object.writeHttpMetadata === "function") {
    object.writeHttpMetadata(headers);
  }
  headers.set("Cache-Control", "public, max-age=300, stale-while-revalidate=60");
  headers.set("Content-Type", contentType);
  headers.set("X-Content-Type-Options", "nosniff");

  if (object.httpEtag) {
    headers.set("ETag", object.httpEtag);
  }

  if (contentType === "image/svg+xml") {
    headers.set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; sandbox");
  }

  if (ifNoneMatchMatches(request.headers.get("If-None-Match"), object.httpEtag)) {
    return new Response(null, {
      status: 304,
      headers
    });
  }

  return new Response(request.method === "HEAD" ? null : object.body, {
    status: 200,
    headers
  });
}
