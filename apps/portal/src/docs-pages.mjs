const MARKDOWN_EXTENSION = /\.(md|markdown)$/i;

export function pageLabel(path) {
  const value = String(path || "");
  if (/(^|\/)README\.(md|markdown)$/i.test(value)) return "Översikt";
  if (/(^|\/)docs\/index\.(md|markdown)$/i.test(value)) return "Dokumentation";

  const parts = value.split("/");
  const name = parts.pop() || value;
  const stem = name.replace(MARKDOWN_EXTENSION, "");
  if (stem.toLowerCase() === "index") {
    const parent = String(parts.pop() || "").toLowerCase();
    if (parent === "organization") return "Organisation";
    return parent
      ? parent.replace(/[-_]+/g, " ").replace(/\b\w/g, char => char.toUpperCase())
      : "Index";
  }

  const known = {
    README: "Översikt",
    architecture: "Arkitektur",
    operations: "Drift",
    security: "Säkerhet",
    "project-context": "Projektkontext",
    "engineering-context": "Engineering context",
    deployment: "Deployment",
    authentication: "Autentisering",
    automation: "Automation",
    discovery: "Discovery",
    providers: "Providers"
  };
  return known[stem] || stem.replace(/[-_]+/g, " ").replace(/\b\w/g, char => char.toUpperCase());
}

export function treeMarkdownPages(tree, root, maxDepth = 2) {
  if (!Array.isArray(tree)) return [];
  const prefix = String(root || "").replace(/\/+$/, "") + "/";
  return tree
    .filter(item => {
      if (item?.type !== "blob" || typeof item.path !== "string") return false;
      if (!item.path.startsWith(prefix) || !MARKDOWN_EXTENSION.test(item.path)) return false;
      const relative = item.path.slice(prefix.length);
      return relative && relative.split("/").length - 1 <= maxDepth;
    })
    .map(item => ({ path: item.path, label: pageLabel(item.path) }));
}

export function treeReadmePage(tree) {
  if (!Array.isArray(tree)) return null;
  const candidates = tree
    .filter(item => item?.type === "blob" && typeof item.path === "string")
    .map(item => item.path)
    .filter(path => /^README\.(md|markdown)$/i.test(path))
    .sort((a, b) => a.localeCompare(b, "sv"));
  return candidates.length ? { path: candidates[0], label: "Översikt" } : null;
}

export function treeFilePage(tree, path, label) {
  if (!Array.isArray(tree) || !MARKDOWN_EXTENSION.test(path || "")) return null;
  const found = tree.some(item => item?.type === "blob" && item.path === path);
  return found ? { path, label } : null;
}

export function pageSort(a, b) {
  const rank = value => {
    if (/^README\.(md|markdown)$/i.test(value.path)) return 0;
    if (/^docs\/index\.(md|markdown)$/i.test(value.path)) return 1;
    return 2;
  };
  const diff = rank(a) - rank(b);
  if (diff !== 0) return diff;
  return a.path.localeCompare(b.path, "sv");
}
