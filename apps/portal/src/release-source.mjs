const PUBLIC_REPOSITORY = /^Avkroken\/[A-Za-z0-9._-]+$/;

function safeText(value, maxLength) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text || text.length > maxLength) return null;
  return text;
}

function validDate(value) {
  const text = safeText(value, 64);
  return text && Number.isFinite(Date.parse(text)) ? text : null;
}

function canonicalReleaseUrl(repository, value) {
  const url = safeText(value, 320);
  if (!url) return null;

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.host !== "github.com") return null;
    const prefix = "/" + repository + "/releases/tag/";
    if (!parsed.pathname.startsWith(prefix)) return null;
    if (parsed.search || parsed.hash || parsed.username || parsed.password) return null;
    return parsed.href;
  } catch {
    return null;
  }
}

export function eligibleReleaseProjects(projects, limit = 24) {
  if (!Array.isArray(projects)) return [];

  const maximum = Math.max(1, Math.min(Number(limit) || 24, 100));

  return projects
    .filter(project =>
      project?.type === "repository" &&
      project?.source?.provider === "github" &&
      project?.source?.kind === "repository" &&
      typeof project?.source?.repository === "string" &&
      PUBLIC_REPOSITORY.test(project.source.repository) &&
      typeof project?.portalUrl === "string"
    )
    .slice(0, maximum);
}

export function normalizePublicRelease(project, release) {
  if (
    project?.type !== "repository" ||
    project?.source?.provider !== "github" ||
    project?.source?.kind !== "repository"
  ) {
    return null;
  }

  const repository = safeText(project.source.repository, 160);
  if (!repository || !PUBLIC_REPOSITORY.test(repository)) return null;
  if (!release || typeof release !== "object" || Array.isArray(release)) return null;
  if (release.draft === true) return null;

  const tag = safeText(release.tag_name, 120);
  const publishedAt = validDate(release.published_at);
  const url = canonicalReleaseUrl(repository, release.html_url);
  const releaseId = Number.isFinite(release.id) ? String(release.id) : safeText(release.id, 64);

  if (!tag || !publishedAt || !url || !releaseId) return null;

  const projectSlug = safeText(project.slug, 120);
  const projectName = safeText(project.name, 160);
  const projectUrl = safeText(project.portalUrl, 240);
  if (!projectSlug || !projectName || !projectUrl) return null;

  return {
    id: "release:" + projectSlug.toLowerCase() + ":" + releaseId,
    projectSlug,
    projectName,
    projectUrl,
    repository,
    tag,
    name: safeText(release.name, 180) || tag,
    publishedAt,
    url,
    prerelease: release.prerelease === true
  };
}

export function normalizePublicReleases(project, releases) {
  if (!Array.isArray(releases)) return [];

  return releases
    .map(release => normalizePublicRelease(project, release))
    .filter(Boolean);
}

export function sortPublicReleases(releases, limit = 40) {
  if (!Array.isArray(releases)) return [];
  const maximum = Math.max(1, Math.min(Number(limit) || 40, 100));

  return [...releases]
    .sort((left, right) =>
      Date.parse(right.publishedAt) - Date.parse(left.publishedAt) ||
      left.projectName.localeCompare(right.projectName, "sv") ||
      left.tag.localeCompare(right.tag, "sv")
    )
    .slice(0, maximum);
}
