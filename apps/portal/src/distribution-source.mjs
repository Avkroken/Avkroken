const ALLOWED_DISPLAY = new Set(["standalone", "minimal-ui", "fullscreen"]);
const STORE_HOSTS = new Map([
  ["apps.apple.com", "App Store"],
  ["play.google.com", "Google Play"],
  ["apps.microsoft.com", "Microsoft Store"]
]);

function publicDeniedOrigin(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    if (!(url.hostname === "denied.se" || url.hostname.endsWith(".denied.se"))) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function distributionEndpoints(project) {
  if (project?.independentProduct !== true) return null;
  const origin = publicDeniedOrigin(project?.url);
  if (!origin) return null;
  return {
    origin,
    manifestUrl: origin + "/site.webmanifest",
    serviceWorkerUrl: origin + "/service-worker.js"
  };
}

function iconSizes(icons) {
  if (!Array.isArray(icons)) return [];
  return icons
    .map(icon => typeof icon?.sizes === "string" ? icon.sizes.trim() : "")
    .filter(Boolean);
}

function storeLinks(applications) {
  if (!Array.isArray(applications)) return [];

  const links = [];
  const seen = new Set();

  for (const application of applications) {
    if (!application || typeof application !== "object" || Array.isArray(application)) continue;
    if (typeof application.url !== "string") continue;

    let url;
    try {
      url = new URL(application.url);
    } catch {
      continue;
    }

    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      !STORE_HOSTS.has(url.hostname) ||
      seen.has(url.href)
    ) {
      continue;
    }

    seen.add(url.href);
    links.push({
      label: STORE_HOSTS.get(url.hostname),
      url: url.href
    });

    if (links.length >= 3) break;
  }

  return links;
}

export function normalizeInstallableManifest(manifest, origin) {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) return null;
  if (!publicDeniedOrigin(origin)) return null;

  const display = typeof manifest.display === "string" ? manifest.display.trim() : "";
  if (!ALLOWED_DISPLAY.has(display)) return null;

  const startUrl = typeof manifest.start_url === "string" ? manifest.start_url.trim() : "";
  const scope = typeof manifest.scope === "string" ? manifest.scope.trim() : "";
  if (!startUrl || !scope) return null;

  let resolvedStart;
  let resolvedScope;
  try {
    resolvedStart = new URL(startUrl, origin);
    resolvedScope = new URL(scope, origin);
  } catch {
    return null;
  }
  if (resolvedStart.origin !== origin || resolvedScope.origin !== origin) return null;

  const sizes = iconSizes(manifest.icons);
  if (!sizes.includes("192x192") || !sizes.includes("512x512")) return null;

  return {
    display,
    startUrl: resolvedStart.href,
    scope: resolvedScope.href,
    iconSizes: ["192x192", "512x512"],
    storeLinks: storeLinks(manifest.related_applications)
  };
}
