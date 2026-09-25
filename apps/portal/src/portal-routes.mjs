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

const PROTECTED_JOBB_ORIGIN = "https://jobb.denied.se/";

export function normalizePortalPath(pathname) {
  const value = String(pathname || "/").split("?")[0].split("#")[0] || "/";
  if (value === "/") return "/";
  return value.replace(/\/+$/, "") || "/";
}

export function projectPath(projectSlug) {
  const slug = String(projectSlug || "").trim();
  return slug ? "/projekt/" + encodeURIComponent(slug) : "/projekt";
}

export function wikiPath(projectSlug) {
  const slug = String(projectSlug || "").trim();
  return slug ? "/projekt/" + encodeURIComponent(slug) + "/wiki" : "/projekt";
}

export function projectReleasesPath(projectSlug) {
  const slug = String(projectSlug || "").trim();
  return slug ? "/projekt/" + encodeURIComponent(slug) + "/releases" : "/projekt";
}

export function projectIssuesPath(projectSlug) {
  const slug = String(projectSlug || "").trim();
  return slug ? "/projekt/" + encodeURIComponent(slug) + "/issues" : "/projekt";
}

export function projectBuildsPath(projectSlug) {
  const slug = String(projectSlug || "").trim();
  return slug ? "/projekt/" + encodeURIComponent(slug) + "/builds" : "/projekt";
}

export function projectActivityPath(projectSlug) {
  const slug = String(projectSlug || "").trim();
  return slug ? "/projekt/" + encodeURIComponent(slug) + "/aktivitet" : "/aktivitet";
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

export function protectedRedirectForPath(pathname) {
  const path = normalizePortalPath(pathname);
  if (path === "/auth/jobb" || path.startsWith("/auth/jobb/")) {
    return PROTECTED_JOBB_ORIGIN;
  }
  return null;
}

export function isPortalDocumentRoute(pathname) {
  const path = normalizePortalPath(pathname);
  if (protectedRedirectForPath(path)) return false;
  if (STATIC_PORTAL_ROUTES.has(path)) return true;

  if (/^\/projekt\/[^/]+$/.test(path)) return true;
  if (/^\/projekt\/[^/]+\/(?:dokumentation|wiki|issues|releases|builds|aktivitet)(?:\/.*)?$/.test(path)) {
    return true;
  }

  if (/^\/dokumentation(?:\/.*)?$/.test(path)) return true;
  if (/^\/drift(?:\/.*)?$/.test(path)) return true;

  return false;
}
