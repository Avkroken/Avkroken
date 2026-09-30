import {
  GITHUB_OWNER,
  isOwnedGitHubRepository,
  repositoryNameFromOwnedFullName,
} from "./github-scope.mjs";

const MAX_WIKI_PAGE_NAME = 120;
const MAX_WIKI_NAVIGATION = 24;
const WIKI_PAGE_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N} ._()+,&:'’\-]{0,119}$/u;

export function normalizeWikiPage(value, fallback = "Home") {
  const raw = typeof value === "string" ? value.trim() : "";
  const candidate = raw || fallback;
  let decoded;
  try {
    decoded = decodeURIComponent(candidate);
  } catch {
    return null;
  }

  const page = decoded.replace(/\.md$/i, "").trim();
  if (
    !page ||
    page.length > MAX_WIKI_PAGE_NAME ||
    page === "." ||
    page === ".." ||
    page.includes("/") ||
    page.includes("\\") ||
    !WIKI_PAGE_PATTERN.test(page)
  ) {
    return null;
  }
  return page;
}

export function wikiRawUrl(repository, page) {
  if (!isOwnedGitHubRepository(repository)) return null;
  const repoName = repositoryNameFromOwnedFullName(repository);
  const safePage = page === "_Sidebar" || page === "_Footer"
    ? page
    : normalizeWikiPage(page, "");
  if (!repoName || !safePage) return null;

  return "https://raw.githubusercontent.com/wiki/" +
    encodeURIComponent(GITHUB_OWNER) + "/" +
    encodeURIComponent(repoName) + "/" +
    encodeURIComponent(safePage) + ".md";
}

export function wikiCanonicalUrl(repository, page) {
  if (!isOwnedGitHubRepository(repository)) return null;
  const repoName = repositoryNameFromOwnedFullName(repository);
  const safePage = normalizeWikiPage(page, "");
  if (!repoName || !safePage) return null;

  return "https://github.com/" +
    encodeURIComponent(GITHUB_OWNER) + "/" +
    encodeURIComponent(repoName) + "/wiki/" +
    encodeURIComponent(safePage);
}

function relativeWikiTarget(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (
    !trimmed ||
    trimmed.startsWith("#") ||
    /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ||
    trimmed.startsWith("//")
  ) {
    return null;
  }

  const withoutFragment = trimmed.split("#")[0].split("?")[0];
  return normalizeWikiPage(withoutFragment, "");
}

export function wikiNavigation(sidebarMarkdown) {
  if (typeof sidebarMarkdown !== "string") return [];

  const navigation = [];
  const seen = new Set();
  const pattern = /\[([^\]]{1,100})\]\(([^)]+)\)/g;

  for (const match of sidebarMarkdown.matchAll(pattern)) {
    const label = match[1].trim();
    const page = relativeWikiTarget(match[2]);
    if (!label || !page) continue;

    const key = page.toLocaleLowerCase("en-US");
    if (seen.has(key)) continue;
    seen.add(key);
    navigation.push({ label, page });

    if (navigation.length >= MAX_WIKI_NAVIGATION) break;
  }

  return navigation;
}

export function ensureWikiNavigation(navigation, currentPage) {
  const page = normalizeWikiPage(currentPage);
  if (!page) return [];

  const values = Array.isArray(navigation)
    ? navigation.filter(item =>
      item &&
      typeof item.label === "string" &&
      normalizeWikiPage(item.page, "")
    )
    : [];

  const result = [];
  const seen = new Set();

  const add = (label, candidate) => {
    const normalized = normalizeWikiPage(candidate, "");
    if (!normalized) return;
    const key = normalized.toLocaleLowerCase("en-US");
    if (seen.has(key)) return;
    seen.add(key);
    result.push({ label: String(label || normalized).slice(0, 100), page: normalized });
  };

  add("Home", "Home");
  for (const item of values) add(item.label, item.page);
  add(page, page);

  return result.slice(0, MAX_WIKI_NAVIGATION);
}
