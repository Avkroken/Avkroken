const TOP_LEVEL_PORTAL_PATHS = new Set([
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

const NESTED_PORTAL_PREFIXES = [
  "/projekt/",
  "/dokumentation/",
  "/drift/"
];

export function normalizePortalPath(pathname) {
  if (typeof pathname !== "string" || pathname.length === 0) return "/";
  const withLeadingSlash = pathname.startsWith("/") ? pathname : "/" + pathname;
  if (withLeadingSlash === "/") return "/";
  return withLeadingSlash.replace(/\/+$/, "") || "/";
}

export function isPortalShellPath(pathname) {
  const path = normalizePortalPath(pathname);
  if (TOP_LEVEL_PORTAL_PATHS.has(path)) return true;
  return NESTED_PORTAL_PREFIXES.some(prefix => path.startsWith(prefix));
}

export function protectedRedirectForPath(pathname) {
  const path = normalizePortalPath(pathname);
  if (path === "/auth/jobb" || path.startsWith("/auth/jobb/")) {
    return "https://jobb.denied.se/";
  }
  return null;
}
