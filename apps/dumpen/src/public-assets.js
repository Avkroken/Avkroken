import { APP_THEME_APPS, APP_THEME_IDS, appThemeLabel } from "./app-theme-contract.js";

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

const APP_LABELS = Object.assign(Object.create(null), {
  dozzle: "Dozzle",
  maintainerr: "Maintainerr",
  plex: "Plex",
  prowlarr: "Prowlarr",
  qbittorrent: "qBittorrent",
  radarr: "Radarr",
  sonarr: "Sonarr",
  tautulli: "Tautulli",
});
const APP_THEME_APP_SET = new Set(APP_THEME_APPS);
const APP_THEME_ID_SET = new Set(APP_THEME_IDS.map(String));
const APP_UPLOAD_SIZES = new Set([APP_SOURCE_PIXEL_SIZE, 512, 256]);

function canonicalAppAssetName(app, theme, pixelSize) {
  return pixelSize === APP_SOURCE_PIXEL_SIZE
    ? `${app}-${theme}.png`
    : `${app}-${theme}-${pixelSize}.png`;
}

export function classifyAppAssetUploadName(value) {
  const name = String(value || "").trim().toLowerCase();
  let match = name.match(/^([a-z0-9-]+)-([1-7])(?:-(256|512))?\.png$/i);
  let app;
  let theme;
  let pixelSize;

  if (match) {
    [, app, theme] = match;
    pixelSize = match[3] ? Number(match[3]) : APP_SOURCE_PIXEL_SIZE;
  } else {
    match = name.match(/^([a-z0-9-]+)-t?([1-7])-(1254|512|256)x(1254|512|256)\.png$/i);
    if (!match || match[3] !== match[4]) return null;
    [, app, theme] = match;
    pixelSize = Number(match[3]);
  }

  if (!APP_THEME_APP_SET.has(app)
      || !APP_THEME_ID_SET.has(theme)
      || !APP_UPLOAD_SIZES.has(pixelSize)) {
    return null;
  }

  const canonicalName = canonicalAppAssetName(app, theme, pixelSize);
  const key = `apps/${app}/${canonicalName}`;
  return {
    app,
    appLabel: APP_LABELS[app] || app,
    theme,
    themeLabel: appThemeLabel(theme),
    pixelSize,
    pixelLabel: pixelSize + "×" + pixelSize,
    canonicalName,
    key,
    mirrorKey: `hotlink-ok/${key}`,
  };
}

export function pngDimensions(body) {
  const bytes = body instanceof Uint8Array ? body : new Uint8Array(body);
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (bytes.byteLength < 24 || !signature.every((value, index) => bytes[index] === value)) {
    return null;
  }
  if (bytes[12] !== 73 || bytes[13] !== 72 || bytes[14] !== 68 || bytes[15] !== 82) {
    return null;
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return {
    width: view.getUint32(16, false),
    height: view.getUint32(20, false),
  };
}

function appAssetMetadata(key) {
  const mirror = key.startsWith("hotlink-ok/apps/");
  const logicalKey = mirror ? key.slice("hotlink-ok/".length) : key;
  const parts = logicalKey.split("/");
  if (parts.length !== 3 || parts[0] !== "apps") return { mirror, logicalKey };

  const app = parts[1];
  const file = parts[2];
  const prefix = app + "-";
  const suffix = file.toLowerCase().startsWith(prefix.toLowerCase())
    ? file.slice(prefix.length)
    : "";
  const sized = suffix.match(/^(\d+)-(256|512)\.png$/i);
  const original = suffix.match(/^(\d+)\.png$/i);

  if (sized) {
    const pixelSize = Number(sized[2]);
    return {
      mirror, logicalKey, app, appCategory: app,
      appLabel: APP_LABELS[app] || app,
      theme: sized[1], themeLabel: appThemeLabel(sized[1]),
      pixelSize, pixelLabel: pixelSize + "×" + pixelSize,
      variant: "resized", legacy: false,
    };
  }
  if (original && original[1] !== "256") {
    return {
      mirror, logicalKey, app, appCategory: app,
      appLabel: APP_LABELS[app] || app,
      theme: original[1], themeLabel: appThemeLabel(original[1]),
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
  const uploadedAt = new Date(object.uploaded).toISOString();
  const stableUrl = directUrl(key);
  return {
    key,
    ...appMetadata,
    managedId,
    managed: Boolean(managedId),
    name,
    size: Number(object.size) || 0,
    uploadedAt,
    contentType,
    image: INLINE_IMAGE_TYPES.has(contentType),
    directUrl: stableUrl,
    previewUrl: stableUrl + "?v=" + encodeURIComponent(uploadedAt),
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
    .filter((asset) => asset && !asset.mirror && !asset.legacy && !asset.key.startsWith("staging/"))
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
export async function uploadPublicAsset(
  request,
  bucket,
  rawName,
  limits,
  { overwriteAppAsset = false } = {},
) {
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

  const target = classifyAppAssetUploadName(name);
  const existing = await listAll(bucket);
  const usedBytes = existing.reduce((sum, object) => sum + (Number(object.size) || 0), 0);

  if (target) {
    const dimensions = pngDimensions(body);
    if (!dimensions) {
      return {
        response: Response.json(
          { error: "Kategoriserade appbilder måste vara giltiga PNG-filer.", key: target.key },
          { status: 415 },
        ),
      };
    }
    if (dimensions.width !== target.pixelSize || dimensions.height !== target.pixelSize) {
      return {
        response: Response.json({
          error: `Fel pixelmått: ${name} måste vara ${target.pixelLabel}.`,
          key: target.key,
          expected: target.pixelLabel,
          observed: dimensions.width + "×" + dimensions.height,
        }, { status: 422 }),
      };
    }

    const targetKeys = [target.key, target.mirrorKey];
    const existingByKey = new Map(existing.map((object) => [object.key, object]));
    const collisions = targetKeys.filter((key) => existingByKey.has(key));
    if (collisions.length && !overwriteAppAsset) {
      return {
        response: Response.json({
          error: "Appbilden finns redan. Välj ersättning för att skriva över den.",
          key: target.key,
          existing: collisions,
        }, { status: 409 }),
      };
    }

    const replacedBytes = collisions.reduce(
      (sum, key) => sum + (Number(existingByKey.get(key)?.size) || 0),
      0,
    );
    const projectedBytes = usedBytes - replacedBytes + body.byteLength * targetKeys.length;
    if (projectedBytes > limits.maxBucketBytes) {
      return { response: new Response("asset storage full\n", { status: 507 }) };
    }

    const metadata = {
      httpMetadata: {
        contentType: "image/png",
        cacheControl: "public, max-age=300",
      },
      customMetadata: {
        originalName: target.canonicalName,
        sourceName: name,
        contentType: "image/png",
        kind: "dumpen-categorized-app-upload",
        app: target.app,
        theme: target.theme,
        pixelSize: String(target.pixelSize),
      },
    };

    const conditional = overwriteAppAsset
      ? metadata
      : { ...metadata, onlyIf: new Headers({ "if-none-match": "*" }) };

    const mirrorResult = await bucket.put(target.mirrorKey, body, conditional);
    if (mirrorResult === null) {
      return {
        response: Response.json({
          error: "Appbildens spegel finns redan. Läs om inventoryt och försök igen.",
          key: target.key,
        }, { status: 409 }),
      };
    }

    const canonicalResult = await bucket.put(target.key, body, conditional);
    if (canonicalResult === null) {
      if (!overwriteAppAsset) await bucket.delete(target.mirrorKey);
      return {
        response: Response.json({
          error: "Appbilden skapades av en annan uppladdning. Läs om inventoryt och försök igen.",
          key: target.key,
        }, { status: 409 }),
      };
    }

    const object = await bucket.head(target.key);
    const asset = object
      ? assetRecord(object)
      : {
          key: target.key,
          ...appAssetMetadata(target.key),
          managedId: null,
          managed: false,
          name: target.canonicalName,
          size: body.byteLength,
          uploadedAt: new Date().toISOString(),
          contentType: "image/png",
          image: true,
          directUrl: directUrl(target.key),
          previewUrl: directUrl(target.key) + "?v=" + encodeURIComponent(new Date().toISOString()),
        };
    return {
      asset,
      categorized: true,
      replaced: collisions.length > 0,
      mirrorKey: target.mirrorKey,
    };
  }

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
    categorized: false,
    replaced: false,
  };
}
