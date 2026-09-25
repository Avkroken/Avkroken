import { documentationPath } from "./portal-routes.mjs";
import { isRetiredRepository } from "./repository-policy.mjs";

const INDEPENDENT_PRODUCTS = new Set([
  "Politiker",
  "Klarsprak",
  "Produkter"
]);

const PORTAL_EXCLUDED_REPOSITORIES = new Set([
  ".github"
]);

const KIND_TOPICS = new Map([
  ["project", "project"],
  ["tool", "tool"],
  ["service", "service"],
  ["docs", "documentation"],
  ["experiment", "experiment"]
]);

const KIND_LABELS = {
  platform: "Plattform",
  project: "Projekt",
  tool: "Verktyg",
  product: "Produkt",
  service: "Tjänst",
  documentation: "Dokumentation",
  experiment: "Experiment"
};

const ACCENT_TOPICS = new Set(["cyan", "blue", "violet", "magenta", "pink"]);

function normalizedTopic(topic) {
  const value = String(topic || "").trim().toLowerCase();
  return value.startsWith("portal-") ? value.slice("portal-".length) : value;
}

function safeHttpsUrl(value) {
  if (typeof value !== "string" || value.trim() === "") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

export function isProjectCatalogRepository(repo) {
  return Boolean(
    repo &&
    repo.visibility === "public" &&
    repo.archived === false &&
    repo.fork !== true &&
    typeof repo.name === "string" &&
    repo.name.length > 0 &&
    !PORTAL_EXCLUDED_REPOSITORIES.has(repo.name) &&
    !isRetiredRepository(repo.name)
  );
}

export function projectPresentation(repo) {
  const name = String(repo?.name || "");
  const topics = Array.isArray(repo?.topics) ? repo.topics.map(normalizedTopic) : [];

  if (INDEPENDENT_PRODUCTS.has(name)) {
    return {
      kind: "product",
      kindLabel: KIND_LABELS.product,
      kindSource: "portal_policy",
      independentProduct: true
    };
  }

  if (name === "Avkroken") {
    return {
      kind: "platform",
      kindLabel: KIND_LABELS.platform,
      kindSource: "portal_policy",
      independentProduct: false
    };
  }

  for (const topic of topics) {
    const kind = KIND_TOPICS.get(topic);
    if (kind) {
      return {
        kind,
        kindLabel: KIND_LABELS[kind],
        kindSource: "topic",
        independentProduct: false
      };
    }
  }

  return {
    kind: "project",
    kindLabel: KIND_LABELS.project,
    kindSource: "default",
    independentProduct: false
  };
}

export function projectAccent(repo) {
  const topics = Array.isArray(repo?.topics) ? repo.topics.map(normalizedTopic) : [];
  for (const topic of topics) {
    if (ACCENT_TOPICS.has(topic)) return topic;
  }
  return "blue";
}

export function buildProjectEntry(repo) {
  const presentation = projectPresentation(repo);
  const name = String(repo.name);
  const repository = String(repo.html_url || "https://github.com/Avkroken/" + encodeURIComponent(name));
  const overview = "/projekt/" + encodeURIComponent(name);
  const documentation = documentationPath(name);
  const homepage = safeHttpsUrl(repo.homepage);
  const pages = repo.has_pages === true
    ? "https://avkroken.github.io/" + encodeURIComponent(name) + "/"
    : null;

  return {
    id: repo.id == null ? name : String(repo.id),
    slug: name,
    name,
    description: repo.description || "",
    ...presentation,
    accent: projectAccent(repo),
    repository,
    homepage,
    documentation,
    defaultBranch: repo.default_branch || null,
    language: repo.language || null,
    repoSizeKb: Number.isFinite(repo.size) ? repo.size : null,
    updatedAt: repo.pushed_at || repo.updated_at || null,
    pushedAt: repo.pushed_at || null,
    stars: Number.isFinite(repo.stargazers_count) ? repo.stargazers_count : 0,
    forks: Number.isFinite(repo.forks_count) ? repo.forks_count : 0,
    topics: Array.isArray(repo.topics) ? repo.topics.map(String) : [],
    features: {
      issues: repo.has_issues === true,
      discussions: repo.has_discussions === true,
      wiki: repo.has_wiki === true,
      pages: repo.has_pages === true
    },
    links: {
      overview,
      documentation,
      homepage,
      repository,
      issues: repo.has_issues === true ? repository + "/issues" : null,
      discussions: repo.has_discussions === true ? repository + "/discussions" : null,
      releases: repository + "/releases",
      actions: repository + "/actions",
      commits: repository + "/commits/" + encodeURIComponent(repo.default_branch || "main"),
      wiki: repo.has_wiki === true ? repository + "/wiki" : null,
      pages
    }
  };
}

export function sortProjectEntries(entries) {
  const kindRank = {
    platform: 0,
    project: 1,
    tool: 2,
    product: 3,
    service: 4,
    documentation: 5,
    experiment: 6
  };

  return [...entries].sort((a, b) => {
    const rank = (kindRank[a.kind] ?? 99) - (kindRank[b.kind] ?? 99);
    if (rank !== 0) return rank;
    return a.name.localeCompare(b.name, "sv");
  });
}
