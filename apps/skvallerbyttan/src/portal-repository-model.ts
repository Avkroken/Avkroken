export type PortalPublicRepository = {
  name: string;
  full_name: string;
  html_url: string;
  visibility: "public";
  archived: false;
  description: string | null;
  topics: string[];
  homepage: string | null;
  has_wiki: boolean;
  has_discussions: boolean;
  has_pages: boolean;
  language: string | null;
  size: number;
  pushed_at: string | null;
  updated_at: string | null;
  stargazers_count: number;
  default_branch: string;
};

export type PortalPublicRepositoriesSnapshot = {
  schemaVersion: 1;
  generatedAt: string;
  status: "available";
  repositories: PortalPublicRepository[];
  truncated: boolean;
};

type RepositoryCandidate = Record<string, unknown>;

const OWNER = /^[A-Za-z0-9_.-]+$/;
const REPOSITORY = /^[A-Za-z0-9._-]+$/;

function safeText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text && text.length <= maxLength ? text : null;
}

function publicHomepage(value: unknown): string | null {
  const text = safeText(value, 500);
  if (!text) return null;

  try {
    const url = new URL(text);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

function timestamp(value: unknown): string | null {
  const text = safeText(value, 64);
  return text && Number.isFinite(Date.parse(text)) ? text : null;
}

function nonNegativeInteger(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.trunc(number)) : 0;
}

function publicTopics(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const topics = new Set<string>();

  for (const item of value) {
    const topic = safeText(item, 50);
    if (topic) topics.add(topic);
    if (topics.size >= 50) break;
  }

  return [...topics];
}

export function normalizePortalPublicRepository(
  value: unknown,
  owner: string,
): PortalPublicRepository | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const row = value as RepositoryCandidate;
  const normalizedOwner = owner.trim();
  const name = safeText(row.name, 100);
  if (!OWNER.test(normalizedOwner) || !name || !REPOSITORY.test(name)) return null;
  if (name === "." || name === "..") return null;

  const expectedFullName = `${normalizedOwner}/${name}`;
  const fullName = safeText(row.full_name, 220);
  if (!fullName || fullName.toLowerCase() !== expectedFullName.toLowerCase()) return null;
  if (row.visibility !== "public" || row.archived === true || row.private === true) return null;

  return {
    name,
    full_name: expectedFullName,
    html_url: `https://github.com/${encodeURIComponent(normalizedOwner)}/${encodeURIComponent(name)}`,
    visibility: "public",
    archived: false,
    description: safeText(row.description, 500),
    topics: publicTopics(row.topics),
    homepage: publicHomepage(row.homepage),
    has_wiki: row.has_wiki === true,
    has_discussions: row.has_discussions === true,
    has_pages: row.has_pages === true,
    language: safeText(row.language, 80),
    size: nonNegativeInteger(row.size),
    pushed_at: timestamp(row.pushed_at),
    updated_at: timestamp(row.updated_at),
    stargazers_count: nonNegativeInteger(row.stargazers_count),
    default_branch: safeText(row.default_branch, 255) || "main",
  };
}

export function buildPortalPublicRepositoriesSnapshot(input: {
  generatedAt: string;
  owner: string;
  repositories: unknown[];
  truncated: boolean;
}): PortalPublicRepositoriesSnapshot {
  const repositories = input.repositories
    .map((row) => normalizePortalPublicRepository(row, input.owner))
    .filter((row): row is PortalPublicRepository => row !== null)
    .sort((a, b) => a.name.localeCompare(b.name, "sv"));

  return {
    schemaVersion: 1,
    generatedAt: timestamp(input.generatedAt) ?? new Date(0).toISOString(),
    status: "available",
    repositories,
    truncated: input.truncated === true,
  };
}
