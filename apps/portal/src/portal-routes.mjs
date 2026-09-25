const STATIC_PORTAL_ROUTES = new Set([
  "/",
  "/projekt",
  "/dokumentation",
  "/tjanster",
  "/auth",
  "/drift",
  "/changelog",
  "/aktivitet",
  "/om",
  "/sok"
]);

export function normalizePortalPath(pathname) {
  const value = String(pathname || "/").split("?")[0].split("#")[0] || "/";
  if (value === "/") return "/";
  return value.replace(/\/+$/, "") || "/";
}

export function documentationPath(repositoryName = null, sourcePath = null) {
  const repo = String(repositoryName || "").trim();
  const base = repo
    ? "/projekt/" + encodeURIComponent(repo) + "/dokumentation"
    : "/dokumentation";

  if (!sourcePath) return base;

  const encoded = String(sourcePath)
    .split("/")
    .filter(Boolean)
    .map(segment => encodeURIComponent(segment))
    .join("/");

  return encoded ? base + "/" + encoded : base;
}

export function isPortalDocumentRoute(pathname) {
  const path = normalizePortalPath(pathname);
  if (STATIC_PORTAL_ROUTES.has(path)) return true;

  if (/^\/projekt\/[^/]+$/.test(path)) return true;
  if (/^\/projekt\/[^/]+\/(?:dokumentation|wiki|issues|releases|builds|aktivitet)(?:\/.*)?$/.test(path)) {
    return true;
  }

  if (/^\/dokumentation(?:\/.*)?$/.test(path)) return true;
  if (/^\/drift(?:\/.*)?$/.test(path)) return true;
  if (/^\/auth(?:\/.*)?$/.test(path)) return true;

  return false;
}
