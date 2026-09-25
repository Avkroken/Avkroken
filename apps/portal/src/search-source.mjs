import { documentationPath } from "./portal-routes.mjs";

const REPOSITORY = /^Avkroken\/[A-Za-z0-9._-]+$/;
const EXTERNAL_KINDS = new Set(["repository", "document", "wiki"]);
const MAX_EXTERNAL_ENTRIES = 2000;
const MAX_ENTRY_TEXT = 120000;
const MAX_TITLE = 300;
const MAX_SOURCE_PATH = 500;
const MAX_ID = 500;
const PROTECTED_APP_SLUG = "jobb";
const PROTECTED_APP_PATH = "apps/jobb";

function boundedText(value, maxLength, { allowEmpty = false } = {}) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized && !allowEmpty) return null;
  if (normalized.length > maxLength) return null;
  return normalized;
}

function safeSourcePath(value) {
  if (value === null || value === undefined) return null;
  const path = boundedText(value, MAX_SOURCE_PATH);
  if (!path || path.startsWith("/") || path.includes("\\") || /[\u0000-\u001f]/.test(path)) {
    return null;
  }
  const segments = path.split("/");
  if (segments.some(segment => !segment || segment === "." || segment === "..")) return null;
  return segments.join("/");
}

function canonicalGitHubUrl(value, repository) {
  const raw = boundedText(value, 1000);
  if (!raw || !REPOSITORY.test(repository)) return null;

  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.hostname !== "github.com") return null;

    const [owner, repo] = repository.split("/");
    const prefix = "/" + encodeURIComponent(owner) + "/" + encodeURIComponent(repo);
    if (url.pathname !== prefix && !url.pathname.startsWith(prefix + "/")) return null;
    if (url.username || url.password || url.port) return null;

    return url.href;
  } catch {
    return null;
  }
}

function portalUrlForExternal(entry) {
  if (entry.kind !== "document" || !entry.sourcePath) return null;
  const [, repositoryName] = entry.repository.split("/");
  return documentationPath(repositoryName, entry.sourcePath);
}

function fold(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("sv-SE")
    .replace(/\s+/g, " ")
    .trim();
}

function protectedApp(value) {
  const normalized = String(value || "").trim().toLocaleLowerCase("en-US");
  return normalized === PROTECTED_APP_SLUG ||
    normalized === PROTECTED_APP_PATH ||
    normalized.startsWith(PROTECTED_APP_PATH + "/");
}

export function searchableMarkdown(markdown) {
  let text = String(markdown || "");
  text = text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
  text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1");
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  text = text.replace(/<[^>]+>/g, " ");
  text = text.replace(/[#>*_`~|]/g, " ");
  text = text.replace(/\s+/g, " ").trim();
  return text.slice(0, MAX_ENTRY_TEXT);
}

export function validateExternalSearchIndex(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  if (payload.schemaVersion !== 1 || payload.organization !== "Avkroken") return null;
  if (payload.generatedMirror !== true || !Array.isArray(payload.entries)) return null;
  if (payload.entries.length > MAX_EXTERNAL_ENTRIES) return null;

  const generatedAt = boundedText(payload.generatedAt, 80);
  if (!generatedAt || !Number.isFinite(Date.parse(generatedAt))) return null;

  const entries = [];
  for (const raw of payload.entries) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;

    const id = boundedText(raw.id, MAX_ID);
    const kind = boundedText(raw.kind, 40);
    const repository = boundedText(raw.repository, 180);
    const title = boundedText(raw.title, MAX_TITLE);
    const text = boundedText(raw.text, MAX_ENTRY_TEXT, { allowEmpty: true });

    if (!id || !kind || !repository || !title || text === null) return null;
    if (!EXTERNAL_KINDS.has(kind) || !REPOSITORY.test(repository)) return null;

    // The generic Pages index must never carry the mixed-access monorepo.
    if (repository === "Avkroken/Avkroken") return null;

    const canonicalUrl = canonicalGitHubUrl(raw.canonicalUrl, repository);
    if (!canonicalUrl) return null;

    let sourcePath = null;
    if (raw.sourcePath !== null && raw.sourcePath !== undefined) {
      sourcePath = safeSourcePath(raw.sourcePath);
      if (!sourcePath) return null;
    }

    const ref = raw.ref === null || raw.ref === undefined
      ? null
      : boundedText(raw.ref, 160);
    if (raw.ref !== null && raw.ref !== undefined && !ref) return null;

    const entry = {
      id: "external:" + id,
      kind,
      sourceKind: "generated_public_mirror",
      repository,
      sourceKey: null,
      sourcePath,
      ref,
      title,
      text,
      canonicalUrl,
      portalUrl: null
    };
    entry.portalUrl = portalUrlForExternal(entry);
    entries.push(entry);
  }

  return {
    generatedAt,
    entries
  };
}

export function projectSearchEntries(projects) {
  if (!Array.isArray(projects)) return [];

  const entries = [];
  for (const project of projects.slice(0, 250)) {
    const slug = boundedText(project?.slug, 120);
    const title = boundedText(project?.name, 160);
    const repository = boundedText(project?.source?.repository, 180) ||
      boundedText(project?.repository, 500);

    if (!slug || !title || !repository) continue;
    if (protectedApp(slug) || protectedApp(project?.source?.path)) continue;

    const description = typeof project?.description === "string"
      ? project.description.trim().slice(0, 1200)
      : "";
    const category = typeof project?.category === "string"
      ? project.category.trim().slice(0, 120)
      : "";
    const language = typeof project?.language === "string"
      ? project.language.trim().slice(0, 120)
      : "";

    const canonicalUrl = typeof project?.repository === "string" &&
      project.repository.startsWith("https://github.com/Avkroken/")
      ? project.repository
      : null;
    const portalUrl = typeof project?.portalUrl === "string" &&
      project.portalUrl.startsWith("/projekt/")
      ? project.portalUrl
      : "/projekt/" + encodeURIComponent(slug);

    entries.push({
      id: "project:" + slug.toLocaleLowerCase("en-US"),
      kind: "project",
      sourceKind: project?.source?.kind || "project_catalog",
      repository: project?.source?.repository || null,
      sourceKey: slug,
      sourcePath: project?.source?.path || null,
      ref: project?.source?.ref || null,
      title,
      text: [description, category, language].filter(Boolean).join(" "),
      canonicalUrl,
      portalUrl
    });
  }

  return entries;
}

export function appDocumentSearchEntry(entry, page, markdown, canonicalUrl) {
  if (entry?.sourceKind !== "app") return null;

  const sourceKey = boundedText(entry.key, 120);
  const title = boundedText(page?.label || page?.path, MAX_TITLE);
  const path = safeSourcePath(page?.path);
  const sourceRepository = boundedText(entry.sourceRepository, 120);
  const sourcePath = boundedText(entry.sourcePath, 300);
  const ref = boundedText(entry.defaultBranch, 160);

  if (!sourceKey || !title || !path || !sourceRepository || !sourcePath || !ref) return null;
  if (protectedApp(sourceKey) || protectedApp(sourcePath)) return null;

  const repository = "Avkroken/" + sourceRepository;
  if (!REPOSITORY.test(repository)) return null;

  const canonical = canonicalGitHubUrl(canonicalUrl, repository);
  if (!canonical) return null;

  return {
    id: "app-document:" + sourceKey.toLocaleLowerCase("en-US") + ":" + path,
    kind: "document",
    sourceKind: "public_app_manifest",
    repository,
    sourceKey,
    sourcePath: sourcePath + "/" + path,
    ref,
    title,
    text: searchableMarkdown(markdown),
    canonicalUrl: canonical,
    portalUrl: documentationPath(sourceKey, path)
  };
}

export function mergeSearchEntries(...collections) {
  const entries = [];
  const ids = new Set();

  for (const collection of collections) {
    if (!Array.isArray(collection)) continue;
    for (const entry of collection) {
      if (!entry || typeof entry.id !== "string" || ids.has(entry.id)) continue;
      ids.add(entry.id);
      entries.push(entry);
    }
  }

  return entries;
}

function snippetFor(entry, terms) {
  const source = String(entry.text || "").replace(/\s+/g, " ").trim();
  if (!source) return "";

  const folded = fold(source);
  let index = Number.POSITIVE_INFINITY;
  for (const term of terms) {
    const found = folded.indexOf(term);
    if (found >= 0) index = Math.min(index, found);
  }
  if (!Number.isFinite(index)) index = 0;

  const start = Math.max(0, index - 80);
  const end = Math.min(source.length, start + 240);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < source.length ? "…" : "";
  return prefix + source.slice(start, end).trim() + suffix;
}

function scoreEntry(entry, query, terms) {
  const title = fold(entry.title);
  const repository = fold(entry.repository);
  const path = fold(entry.sourcePath);
  const text = fold(entry.text);
  const combined = [title, repository, path, text].join(" ");

  if (!terms.every(term => combined.includes(term))) return null;

  let score = 0;
  if (title === query) score += 40;
  else if (title.startsWith(query)) score += 24;
  else if (title.includes(query)) score += 16;

  if (repository.includes(query)) score += 10;
  if (path.includes(query)) score += 7;
  if (text.includes(query)) score += 4;

  for (const term of terms) {
    if (title.includes(term)) score += 10;
    if (repository.includes(term)) score += 5;
    if (path.includes(term)) score += 4;
    if (text.includes(term)) score += 1;
  }

  if (entry.kind === "project") score += 2;
  return score;
}

export function searchEntries(entries, query, limit = 20) {
  const normalizedQuery = fold(query).slice(0, 120);
  const terms = normalizedQuery.split(" ").filter(Boolean).slice(0, 8);
  if (!normalizedQuery || !terms.length || !Array.isArray(entries)) return [];

  const boundedLimit = Math.min(Math.max(Number(limit) || 20, 1), 30);
  const scored = [];

  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const score = scoreEntry(entry, normalizedQuery, terms);
    if (score === null) continue;
    scored.push({
      score,
      result: {
        id: entry.id,
        kind: entry.kind,
        sourceKind: entry.sourceKind,
        title: entry.title,
        repository: entry.repository || null,
        sourcePath: entry.sourcePath || null,
        ref: entry.ref || null,
        portalUrl: entry.portalUrl || null,
        canonicalUrl: entry.canonicalUrl || null,
        snippet: snippetFor(entry, terms)
      }
    });
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return String(a.result.title || "").localeCompare(String(b.result.title || ""), "sv");
  });

  return scored.slice(0, boundedLimit).map(item => item.result);
}
