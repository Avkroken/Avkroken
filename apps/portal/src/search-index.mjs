import { documentationPath } from "./portal-routes.mjs";

function normalized(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("sv-SE")
    .replace(/\s+/g, " ")
    .trim();
}

export function searchableMarkdown(markdown) {
  return String(markdown || "")
    .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/<https?:\/\/[^>]+>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/^[#>*+-]+\s*/gm, "")
    .replace(/[\x60*_~|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function snippet(value, maxLength = 240) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return text.slice(0, Math.max(0, maxLength - 1)).trimEnd() + "…";
}

function safeSource(source) {
  if (!source || typeof source !== "object") return null;
  return {
    provider: source.provider || "github",
    kind: source.kind || null,
    repository: source.repository || null,
    ref: source.ref || null,
    path: source.path || null
  };
}

export function filterSearchableDocs(projects, docsCatalog) {
  if (!Array.isArray(projects) || !Array.isArray(docsCatalog)) return [];

  const allowed = new Set(
    projects
      .map(project => normalized(project?.slug))
      .filter(Boolean)
  );

  return docsCatalog.filter(entry => {
    const key = normalized(entry?.key || entry?.name);
    return key && allowed.has(key);
  });
}

export function buildProjectSearchEntries(projects) {
  if (!Array.isArray(projects)) return [];

  const entries = [];
  for (const project of projects) {
    if (!project || typeof project.slug !== "string" || typeof project.portalUrl !== "string") {
      continue;
    }

    const source = safeSource(project.source);
    const description = String(project.description || "").trim();
    const projectText = [
      project.name,
      project.slug,
      project.category,
      description,
      project.host,
      source?.repository
    ].filter(Boolean).join(" ");

    entries.push({
      id: "project:" + project.id,
      kind: "project",
      title: project.name || project.slug,
      subtitle: project.category || "Projekt",
      snippet: snippet(description || "Avkroken-projekt."),
      url: project.portalUrl,
      canonicalUrl: project.repository || null,
      source,
      searchText: projectText
    });

    if (project.wiki && project.wikiPortalUrl) {
      entries.push({
        id: "wiki:" + project.id,
        kind: "wiki",
        title: (project.name || project.slug) + " Wiki",
        subtitle: "Wiki",
        snippet: snippet(
          "Navigations- och presentationslager för repositoryägd README och versionsstyrd dokumentation."
        ),
        url: project.wikiPortalUrl,
        canonicalUrl: project.wiki,
        source,
        searchText: [
          project.name,
          project.slug,
          "wiki",
          "dokumentation",
          description,
          source?.repository
        ].filter(Boolean).join(" ")
      });
    }
  }

  return entries;
}

export function buildDocumentSearchEntry(entry, page, markdown, canonicalUrl) {
  if (
    !entry ||
    !page ||
    typeof entry.key !== "string" ||
    typeof page.path !== "string" ||
    typeof canonicalUrl !== "string"
  ) {
    return null;
  }

  const body = searchableMarkdown(markdown);
  const title = (entry.name || entry.key) + " · " + (page.label || page.path);
  const sourcePath = entry.sourceKind === "app" && entry.sourcePath
    ? entry.sourcePath + "/" + page.path
    : page.path;

  return {
    id: "document:" + entry.key + ":" + page.path,
    kind: "document",
    title,
    subtitle: page.path,
    snippet: snippet(body || entry.description || ""),
    url: documentationPath(entry.key, page.path),
    canonicalUrl,
    source: {
      provider: "github",
      kind: entry.sourceKind || "repository",
      repository: entry.sourceRepository || null,
      ref: entry.defaultBranch || null,
      path: sourcePath
    },
    searchText: [
      entry.name,
      entry.key,
      page.label,
      page.path,
      entry.description,
      body
    ].filter(Boolean).join(" ")
  };
}

function queryTerms(query) {
  return normalized(query)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(term => term.length >= 2)
    .slice(0, 12);
}

function occurrences(haystack, needle, cap = 4) {
  if (!needle) return 0;
  let count = 0;
  let index = 0;
  while (count < cap) {
    index = haystack.indexOf(needle, index);
    if (index < 0) break;
    count += 1;
    index += needle.length;
  }
  return count;
}

export function searchEntries(entries, query, limit = 24) {
  if (!Array.isArray(entries)) return [];

  const fullQuery = normalized(query);
  const terms = queryTerms(query);
  if (fullQuery.length < 2 || terms.length === 0) return [];

  const ranked = [];
  for (const entry of entries) {
    if (!entry || typeof entry.title !== "string" || typeof entry.url !== "string") continue;

    const title = normalized(entry.title);
    const subtitle = normalized(entry.subtitle);
    const body = normalized(entry.searchText);
    let score = 0;

    if (title === fullQuery) score += 1000;
    if (title.includes(fullQuery)) score += 260;
    if (subtitle.includes(fullQuery)) score += 90;
    if (body.includes(fullQuery)) score += 35;

    for (const term of terms) {
      if (title.includes(term)) score += 70;
      if (subtitle.includes(term)) score += 28;
      score += occurrences(body, term) * 7;
    }

    if (score <= 0) continue;

    ranked.push({
      score,
      id: entry.id,
      kind: entry.kind,
      title: entry.title,
      subtitle: entry.subtitle || "",
      snippet: entry.snippet || "",
      url: entry.url,
      canonicalUrl: entry.canonicalUrl || null,
      source: entry.source || null
    });
  }

  ranked.sort((a, b) =>
    b.score - a.score ||
    a.title.localeCompare(b.title, "sv") ||
    String(a.id).localeCompare(String(b.id), "sv")
  );

  return ranked.slice(0, Math.max(1, Math.min(Number(limit) || 24, 50)));
}
