import { documentationPath } from "./portal-routes.mjs";
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
    return url.protocol === "https:" ? url : null;
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
