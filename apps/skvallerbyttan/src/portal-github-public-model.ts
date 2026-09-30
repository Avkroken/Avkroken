export type PortalDocumentationRepository = {
  repository: string;
  defaultBranch: string;
  paths: string[];
  failed: boolean;
};

export type PortalDocumentationIndexSnapshot = {
  schemaVersion: 1;
  generatedAt: string;
  status: "available";
  repositories: PortalDocumentationRepository[];
};

export type PortalReleaseCandidate = {
  id: number | string;
  tag_name: string;
  name: string | null;
  published_at: string;
  html_url: string;
  body: string;
  prerelease: boolean;
  draft: false;
};

export type PortalReleaseRepository = {
  repository: string;
  releases: PortalReleaseCandidate[];
  failed: boolean;
};

export type PortalReleaseSnapshot = {
  schemaVersion: 1;
  generatedAt: string;
  status: "available";
  repositories: PortalReleaseRepository[];
};

type TreeEntry = {
  path?: unknown;
  type?: unknown;
};

type ReleaseInput = Record<string, unknown>;

const MARKDOWN_PATH = /^(?:README\.(?:md|markdown)|docs\/[A-Za-z0-9._/-]+\.(?:md|markdown)|apps\/skvallerbyttan\/(?:README\.(?:md|markdown)|docs\/[A-Za-z0-9._/-]+\.(?:md|markdown)))$/i;
const SAFE_SEGMENT = /^[A-Za-z0-9._-]+$/;
const MAX_MARKDOWN_PATHS = 400;
const MAX_RELEASE_BODY = 20_000;

function safeText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text && text.length <= maxLength ? text : null;
}

function safeMarkdownPath(value: unknown): string | null {
  const path = safeText(value, 512);
  if (!path || !MARKDOWN_PATH.test(path)) return null;
  const segments = path.split("/");
  if (segments.some(segment => !segment || segment === "." || segment === ".." || !SAFE_SEGMENT.test(segment))) {
    return null;
  }
  return path;
}

export function publicMarkdownPaths(tree: unknown): string[] {
  if (!Array.isArray(tree)) return [];
  const paths = new Set<string>();

  for (const item of tree as TreeEntry[]) {
    if (item?.type !== "blob") continue;
    const path = safeMarkdownPath(item.path);
    if (!path) continue;
    paths.add(path);
    if (paths.size >= MAX_MARKDOWN_PATHS) break;
  }

  return [...paths].sort((a, b) => a.localeCompare(b, "sv"));
}

function canonicalReleaseUrl(owner: string, repository: string, value: unknown): string | null {
  const text = safeText(value, 500);
  if (!text) return null;

  try {
    const url = new URL(text);
    const prefix = `/${owner}/${repository}/releases/tag/`;
    if (
      url.protocol !== "https:" ||
      url.host !== "github.com" ||
      !url.pathname.startsWith(prefix) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      return null;
    }
    return url.href;
  } catch {
    return null;
  }
}

export function normalizePortalReleaseCandidate(
  owner: string,
  repository: string,
  value: unknown,
): PortalReleaseCandidate | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as ReleaseInput;
  if (row.draft === true) return null;

  const tag = safeText(row.tag_name, 120);
  const publishedAt = safeText(row.published_at, 64);
  const url = canonicalReleaseUrl(owner, repository, row.html_url);
  const id =
    typeof row.id === "number" && Number.isFinite(row.id)
      ? row.id
      : safeText(row.id, 64);

  if (!tag || !publishedAt || !Number.isFinite(Date.parse(publishedAt)) || !url || id === null) {
    return null;
  }

  return {
    id,
    tag_name: tag,
    name: safeText(row.name, 180),
    published_at: publishedAt,

    html_url: url,
    body: typeof row.body === "string" ? row.body.slice(0, MAX_RELEASE_BODY) : "",
    prerelease: row.prerelease === true,
    draft: false,
  };
}

export function normalizePortalReleaseCandidates(
  owner: string,
  repository: string,
  values: unknown,
  limit = 10,
): PortalReleaseCandidate[] {
  if (!Array.isArray(values)) return [];
  const maximum = Math.max(1, Math.min(Math.trunc(limit) || 10, 20));
  return values
    .map(value => normalizePortalReleaseCandidate(owner, repository, value))
    .filter((value): value is PortalReleaseCandidate => value !== null)
    .slice(0, maximum);
}
