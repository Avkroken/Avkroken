export type PortalPublicRelease = {
  id: string;
  tag_name: string;
  name: string | null;
  html_url: string;
  published_at: string;
  prerelease: boolean;
  categories: string[];
};

const CATEGORY_HEADINGS = new Map([
  ["feature", "features"],
  ["features", "features"],
  ["bug fix", "fixes"],
  ["bug fixes", "fixes"],
  ["fix", "fixes"],
  ["fixes", "fixes"],
  ["security", "security"],
  ["security fix", "security"],
  ["security fixes", "security"],
  ["documentation", "documentation"],
  ["docs", "documentation"],
]);

function safeText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text && text.length <= maxLength ? text : null;
}

function validDate(value: unknown): string | null {
  const text = safeText(value, 64);
  return text && Number.isFinite(Date.parse(text)) ? text : null;
}

function releaseCategories(body: unknown): string[] {
  const categories = new Set(["releases"]);
  if (typeof body !== "string") return [...categories];

  for (const line of body.split(/\r?\n/)) {
    const match = line.match(/^#{2,3}\s+(.+?)\s*#*\s*$/);
    if (!match) continue;
    const heading = match[1].replace(/[*_`]/g, "").trim().toLowerCase().replace(/\s+/g, " ");
    const category = CATEGORY_HEADINGS.get(heading);
    if (category) categories.add(category);
  }
  return [...categories];
}

export function normalizePortalPublicRelease(
  value: unknown,
  repositoryFullName: string,
): PortalPublicRelease | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (row.draft === true) return null;

  const id = Number.isFinite(row.id) ? String(row.id) : safeText(row.id, 64);
  const tag = safeText(row.tag_name, 120);
  const publishedAt = validDate(row.published_at);
  const url = safeText(row.html_url, 320);
  if (!id || !tag || !publishedAt || !url) return null;

  try {
    const parsed = new URL(url);
    const prefix = "/" + repositoryFullName + "/releases/tag/";
    if (
      parsed.protocol !== "https:" ||
      parsed.host !== "github.com" ||
      !parsed.pathname.startsWith(prefix) ||
      parsed.search ||
      parsed.hash ||
      parsed.username ||
      parsed.password
    ) {
      return null;
    }
  } catch {
    return null;
  }

  return {
    id,
    tag_name: tag,
    name: safeText(row.name, 180),
    html_url: url,
    published_at: publishedAt,
    prerelease: row.prerelease === true,
    categories: releaseCategories(row.body),
  };
}
