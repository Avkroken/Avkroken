const MANAGED_PREFIX = "uploads/";
const ASSET_ID = /^[0-9a-f]{32}$/;
const MAX_NAME_BYTES = 180;
const DIRECT_ORIGIN = "https://logos.denied.se";
const INLINE_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/x-icon",
  "image/vnd.microsoft.icon",
  "image/svg+xml",
]);

function randomHex(byteLength) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return "";
  }
}

function truncateUtf8(value, maxBytes) {
  const encoder = new TextEncoder();
  let output = "";
  let usedBytes = 0;
  for (const character of value) {
    const characterBytes = encoder.encode(character).byteLength;
    if (usedBytes + characterBytes > maxBytes) break;
    output += character;
    usedBytes += characterBytes;
  }
  return output;
}

export function safeAssetName(value) {
  const normalized = String(value || "").normalize("NFKC").trim();
  if (!normalized || normalized === "." || normalized === "..") return null;
  const cleaned = normalized
    .replace(/[\\/\u0000-\u001f\u007f]+/g, "_")
    .replace(/^\.+/, "");
  return truncateUtf8(cleaned, MAX_NAME_BYTES) || null;
}

function contentTypeFromName(name) {
  const ext = name.toLowerCase().split(".").pop();
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
  const type = String(value || "").split(";", 1)[0].trim().toLowerCase();
  return type || contentTypeFromName(name);
}

function directUrl(key) {
  const encoded = String(key)
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  return `${DIRECT_ORIGIN}/${encoded}`;
}

function managedAssetId(key) {
  if (!String(key || "").startsWith(MANAGED_PREFIX)) return null;
  const rest = key.slice(MANAGED_PREFIX.length);
  const slash = rest.indexOf("/");
  const id = slash > 0 ? rest.slice(0, slash) : "";
  return ASSET_ID.test(id) ? id : null;
}

const APP_SOURCE_PIXEL_SIZE = 1254;

const APP_LABELS = {
  dozzle: "Dozzle",
  maintainerr: "Maintainerr",
  plex: "Plex",
  prowlarr: "Prowlarr",
  qbittorrent: "qBittorrent",
  radarr: "Radarr",
  sonarr: "Sonarr",
  tautulli: "Tautulli",
};

function appAssetMetadata(key) {
  const mirror = key.startsWith("hotlink-ok/");
  const logicalKey = mirror ? key.slice("hotlink-ok/".length) : key;
  const parts = logicalKey.split("/");
  if (parts.length !== 3 || parts[0] !== "apps") return { mirror, logicalKey };

  const app = parts[1];
  const file = parts[2];
  const escapedApp = app.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const sized = file.match(new RegExp("^" + escapedApp + "-(\\d+)-(256|512)\\.png$", "i"));
  const original = file.match(new RegExp("^" + escapedApp + "-(\\d+)\\.png$", "i"));

  if (sized) {
    const pixelSize = Number(sized[2]);
    return {
      mirror, logicalKey, app, appCategory: app,
      appLabel: APP_LABELS[app] || app,
      theme: sized[1], themeLabel: "Tema " + sized[1],
      pixelSize, pixelLabel: pixelSize + "×" + pixelSize,
      variant: "resized", legacy: false,
    };
  }
  if (original && original[1] !== "256") {
    return {
      mirror, logicalKey, app, appCategory: app,
      appLabel: APP_LABELS[app] || app,
      theme: original[1], themeLabel: "Tema " + original[1],
      pixelSize: APP_SOURCE_PIXEL_SIZE,
      pixelLabel: APP_SOURCE_PIXEL_SIZE + "×" + APP_SOURCE_PIXEL_SIZE,
      variant: "original", legacy: false,
    };
  }
  const legacy = original?.[1] === "256";
  return {
    mirror, logicalKey, app: app || null, appCategory: app || null,
    appLabel: app ? (APP_LABELS[app] || app) : null,
    theme: null, themeLabel: null,
    pixelSize: legacy ? 256 : null,
    pixelLabel: legacy ? "256×256" : null,
    variant: legacy ? "legacy" : "unclassified", legacy,
  };
}

function assetRecord(object) {
  const key = String(object.key || "");
  if (!key) return null;
  const fallbackName = key.split("/").pop() || key;
  const name = object.customMetadata?.originalName || fallbackName;
  const contentType = normalizedContentType(
    object.httpMetadata?.contentType || object.customMetadata?.contentType,
    name,
  );
  const managedId = managedAssetId(key);
  const appMetadata = appAssetMetadata(key);
  return {
    key,
    ...appMetadata,
    managedId,
    managed: Boolean(managedId),
    name,
    size: Number(object.size) || 0,
    uploadedAt: new Date(object.uploaded).toISOString(),
    contentType,
    image: INLINE_IMAGE_TYPES.has(contentType),
    directUrl: directUrl(key),
  };
}

async function listAll(bucket, options = {}) {
  const objects = [];
  let cursor;
  do {
    const page = await bucket.list({
      ...options,
      cursor,
      include: ["httpMetadata", "customMetadata"],
    });
    objects.push(...page.objects);
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return objects;
}

export async function listPublicAssets(bucket) {
  const objects = await listAll(bucket);
  return objects
    .map(assetRecord)
    .filter((asset) => asset && !asset.mirror && !asset.legacy)
    .sort((a, b) => {
      if (a.app && b.app) {
        const appOrder = a.appLabel.localeCompare(b.appLabel, "sv");
        if (appOrder) return appOrder;
        const themeOrder = Number(a.theme || 0) - Number(b.theme || 0);
        if (themeOrder) return themeOrder;
        const sizeRank = (asset) => asset.variant === "original" ? 0 : Number(asset.pixelSize || 9999);
        return sizeRank(a) - sizeRank(b);
      }
      if (a.app) return -1;
      if (b.app) return 1;
      return new Date(b.uploadedAt) - new Date(a.uploadedAt);
    });
}
export async function uploadPublicAsset(request, bucket, rawName, limits) {
  const name = safeAssetName(safeDecode(rawName));
  if (!name) return { response: new Response("invalid filename\n", { status: 400 }) };

  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > limits.maxUploadBytes) {
    return { response: new Response("too large\n", { status: 413 }) };
  }

  const body = await request.arrayBuffer();
  if (body.byteLength > limits.maxUploadBytes) {
    return { response: new Response("too large\n", { status: 413 }) };
  }

  const existing = await listAll(bucket);
  const usedBytes = existing.reduce((sum, object) => sum + (Number(object.size) || 0), 0);
  if (usedBytes + body.byteLength > limits.maxBucketBytes) {
    return { response: new Response("asset storage full\n", { status: 507 }) };
  }

  const id = randomHex(16);
  const key = `${MANAGED_PREFIX}${id}/${name}`;
  const contentType = normalizedContentType(request.headers.get("content-type"), name);
  await bucket.put(key, body, {
    httpMetadata: {
      contentType,
      cacheControl: "max-age=31536000",
    },
    customMetadata: {
      originalName: name,
      contentType,
      kind: "dumpen-upload",
    },
  });

  return {
    asset: {
      key,
      managedId: id,
      managed: true,
      name,
      size: body.byteLength,
      uploadedAt: new Date().toISOString(),
      contentType,
      image: INLINE_IMAGE_TYPES.has(contentType),
      directUrl: directUrl(key),
    },
  };
}
