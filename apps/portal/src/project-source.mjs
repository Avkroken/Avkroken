import { documentationPath, projectPath } from "./portal-routes.mjs";
import { isRetiredRepository } from "./repository-policy.mjs";

const RESERVED_REPOSITORIES = new Set([".github"]);
const INDEPENDENT_PRODUCTS = new Set(["Politiker", "Klarsprak", "Produkter"]);
const CATEGORY_TOPICS = {
  tool: "Verktyg",
  project: "Projekt",
  docs: "Dokumentation",
  service: "Tjänst",
  experiment: "Experiment"
};
const ACCENT_TOPICS = ["cyan", "blue", "violet", "magenta", "pink"];

function normalizedTopicName(topic) {
  if (typeof topic !== "string") return "";
  return topic.startsWith("portal-") ? topic.slice("portal-".length) : topic;
}

function categoryFromTopics(topics = []) {
  for (const topic of topics) {
    const name = normalizedTopicName(topic);
    if (CATEGORY_TOPICS[name]) return CATEGORY_TOPICS[name];
  }
  return "Projekt";
}

function accentFromTopics(topics = []) {
  for (const topic of topics) {
    const name = normalizedTopicName(topic);
    if (ACCENT_TOPICS.includes(name)) return name;
  }
  return "blue";
}

function hasPortalCategory(topics = []) {
  return topics.some(topic => Boolean(CATEGORY_TOPICS[normalizedTopicName(topic)]));
}

function publicHomepage(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url;
  } catch {
    return null;
  }
}

function repositoryUrl(repo) {
  if (typeof repo?.html_url === "string" && repo.html_url.startsWith("https://github.com/")) {
    return repo.html_url;
  }
  return "https://github.com/Avkroken/" + encodeURIComponent(String(repo?.name || ""));
}

export function normalizePublicRepository(repo) {
  const name = String(repo?.name || "");
  if (!name) return null;
  if (repo?.visibility !== "public" || repo?.archived === true) return null;
  if (isRetiredRepository(name) || RESERVED_REPOSITORIES.has(name)) return null;

  const topics = Array.isArray(repo?.topics) ? repo.topics : [];
  const homepage = publicHomepage(repo?.homepage);
  const canonicalRepository = repositoryUrl(repo);

  return {
    id: "repository:" + name.toLowerCase(),
    type: "repository",
    slug: name,
    name,
    description: typeof repo?.description === "string" ? repo.description : "",
    category: categoryFromTopics(topics),
    accent: accentFromTopics(topics),
    independentProduct: INDEPENDENT_PRODUCTS.has(name),
    portalPublished: Boolean(homepage && hasPortalCategory(topics)),
    url: homepage?.href || null,
    host: homepage?.host || null,
    repository: canonicalRepository,
    issues: canonicalRepository + "/issues",
    discussions: repo?.has_discussions === true ? canonicalRepository + "/discussions" : null,
    releases: canonicalRepository + "/releases",
    portalUrl: projectPath(name),
    documentation: documentationPath(name),
    pages: repo?.has_pages === true
      ? "https://avkroken.github.io/" + encodeURIComponent(name) + "/"
      : null,
    language: typeof repo?.language === "string" ? repo.language : null,
    repoSizeKb: Number.isFinite(repo?.size) ? repo.size : null,
    updatedAt: repo?.pushed_at || repo?.updated_at || null,
    stars: Number.isFinite(repo?.stargazers_count) ? repo.stargazers_count : 0,
    source: {
      provider: "github",
      kind: "repository",
      repository: repo?.full_name || "Avkroken/" + name,
      ref: repo?.default_branch || "main"
    }
  };
}

export function normalizePublicRepositories(repositories) {
  if (!Array.isArray(repositories)) return [];
  return repositories
    .map(normalizePublicRepository)
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name, "sv"));
}


const PUBLIC_APP_SLUG = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

function safeText(value, maxLength) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text || text.length > maxLength) return null;
  return text;
}

function sourceTreeUrl(repository, ref, sourcePath) {
  return repository + "/tree/" + encodeURIComponent(ref) + "/" +
    String(sourcePath).split("/").filter(Boolean).map(encodeURIComponent).join("/");
}

export function normalizePublicAppManifest(manifest, context = {}) {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) return null;
  if (manifest.schemaVersion !== 1) return null;

  const slug = safeText(manifest.slug, 64);
  const name = safeText(manifest.name, 80);
  const description = safeText(manifest.description, 280);
  const categoryKey = safeText(manifest.category, 32);
  const accent = safeText(manifest.accent, 32);

  if (!slug || !PUBLIC_APP_SLUG.test(slug)) return null;
  if (!name || !description) return null;
  if (!categoryKey || !CATEGORY_TOPICS[categoryKey]) return null;
  if (!accent || !ACCENT_TOPICS.includes(accent)) return null;

  const sourcePath = safeText(context.sourcePath, 240);
  const repositoryName = safeText(context.repositoryName, 120);
  const ref = safeText(context.ref, 120);
  const repository = safeText(context.repository, 240);

  if (!sourcePath || !sourcePath.startsWith("apps/")) return null;
  if (!repositoryName || !ref || !repository || !repository.startsWith("https://github.com/")) {
    return null;
  }

  const homepage = publicHomepage(manifest.publicUrl);

  return {
    id: "app:" + repositoryName.toLowerCase() + ":" + slug,
    type: "app",
    slug,
    name,
    description,
    category: CATEGORY_TOPICS[categoryKey],
    accent,
    independentProduct: false,
    portalPublished: Boolean(homepage),
    url: homepage?.href || null,
    host: homepage?.host || null,
    repository,
    sourceUrl: sourceTreeUrl(repository, ref, sourcePath),
    issues: repository + "/issues",
    discussions: context.hasDiscussions === true ? repository + "/discussions" : null,
    releases: repository + "/releases",
    portalUrl: projectPath(slug),
    documentation: documentationPath(slug),
    pages: null,
    language: null,
    repoSizeKb: null,
    updatedAt: context.updatedAt || null,
    stars: Number.isFinite(context.stars) ? context.stars : 0,
    source: {
      provider: "github",
      kind: "monorepo_app",
      repository: repositoryName,
      ref,
      path: sourcePath
    }
  };
}

export function mergePublicProjectCatalog(repositoryProjects, appProjects) {
  const projects = [
    ...(Array.isArray(repositoryProjects) ? repositoryProjects : []),
    ...(Array.isArray(appProjects) ? appProjects : [])
  ];

  const unique = new Map();
  for (const project of projects) {
    if (!project || typeof project.id !== "string" || unique.has(project.id)) continue;
    unique.set(project.id, project);
  }

  return [...unique.values()].sort((a, b) => a.name.localeCompare(b.name, "sv"));
}
