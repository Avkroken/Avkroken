export type PortalPublicDocumentationSnapshot = {
  schemaVersion: 1;
  generatedAt: string;
  status: "available";
  repository: string;
  defaultBranch: string;
  sourcePath: string | null;
  paths: string[];
};

const MARKDOWN = /\.(?:md|markdown)$/i;
const PUBLIC_APP_SOURCE_PATHS = new Set(["apps/skvallerbyttan"]);

function normalizedSourcePath(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string") return null;
  const sourcePath = value.trim().replace(/\/+$/, "");
  return PUBLIC_APP_SOURCE_PATHS.has(sourcePath) ? sourcePath : null;
}

function rootDocumentationPath(path: string): boolean {
  if (/^README\.(?:md|markdown)$/i.test(path)) return true;
  if (!/^docs\//i.test(path) || !MARKDOWN.test(path)) return false;
  const relative = path.slice("docs/".length);
  return Boolean(relative) && relative.split("/").length <= 3;
}

function appDocumentationPath(path: string, sourcePath: string): boolean {
  if (path === sourcePath + "/README.md" || path === sourcePath + "/README.markdown") return true;
  const prefix = sourcePath + "/docs/";
  if (!path.startsWith(prefix) || !MARKDOWN.test(path)) return false;
  const relative = path.slice(prefix.length);
  return Boolean(relative) && relative.split("/").length <= 3;
}

export function portalDocumentationPaths(
  tree: unknown,
  sourcePathInput: unknown = null,
): string[] {
  if (!Array.isArray(tree)) return [];
  const sourcePath = normalizedSourcePath(sourcePathInput);
  if (sourcePathInput != null && sourcePath === null) return [];

  const paths = new Set<string>();
  for (const item of tree) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const row = item as Record<string, unknown>;
    if (row.type !== "blob" || typeof row.path !== "string") continue;
    const path = row.path.trim();
    const allowed = sourcePath
      ? appDocumentationPath(path, sourcePath)
      : rootDocumentationPath(path);
    if (allowed) paths.add(path);
    if (paths.size >= 128) break;
  }
  return [...paths].sort((a, b) => a.localeCompare(b, "sv"));
}

export function buildPortalPublicDocumentationSnapshot(input: {
  generatedAt: string;
  repository: string;
  defaultBranch: string;
  sourcePath?: string | null;
  tree: unknown;
}): PortalPublicDocumentationSnapshot {
  const sourcePath = normalizedSourcePath(input.sourcePath ?? null);
  if (input.sourcePath != null && sourcePath === null) {
    throw new Error("unsupported public app documentation source");
  }

  return {
    schemaVersion: 1,
    generatedAt: input.generatedAt,
    status: "available",
    repository: input.repository,
    defaultBranch: input.defaultBranch,
    sourcePath,
    paths: portalDocumentationPaths(input.tree, sourcePath),
  };
}
