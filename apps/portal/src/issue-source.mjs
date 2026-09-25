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

function canonicalIssueUrl(repository, issueNumber, value) {
  const url = safeText(value, 320);
  if (!url) return null;

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.host !== "github.com") return null;
    const expected = "/" + repository + "/issues/" + issueNumber;
    if (parsed.pathname !== expected) return null;
    if (parsed.search || parsed.hash || parsed.username || parsed.password) return null;
    return parsed.href;
  } catch {
    return null;
  }
}

export function eligibleIssueProjects(projects, limit = 100) {
  if (!Array.isArray(projects)) return [];

  const maximum = Math.max(1, Math.min(Number(limit) || 100, 100));

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

export function normalizePublicIssue(project, issue) {
  if (
    project?.type !== "repository" ||
    project?.source?.provider !== "github" ||
    project?.source?.kind !== "repository"
  ) {
    return null;
  }

  const repository = safeText(project.source.repository, 160);
  if (!repository || !PUBLIC_REPOSITORY.test(repository)) return null;
  if (!issue || typeof issue !== "object" || Array.isArray(issue)) return null;
  if (issue.pull_request) return null;
  if (issue.state !== "open") return null;

  const number = Number(issue.number);
  if (!Number.isSafeInteger(number) || number <= 0) return null;

  const title = safeText(issue.title, 240);
  const createdAt = validDate(issue.created_at);
  const updatedAt = validDate(issue.updated_at);
  const url = canonicalIssueUrl(repository, number, issue.html_url);

  const projectSlug = safeText(project.slug, 120);
  const projectName = safeText(project.name, 160);
  const projectUrl = safeText(project.portalUrl, 240);

  if (!title || !createdAt || !updatedAt || !url || !projectSlug || !projectName || !projectUrl) {
    return null;
  }

  return {
    id: "issue:" + projectSlug.toLowerCase() + ":" + number,
    projectSlug,
    projectName,
    projectUrl,
    repository,
    number,
    title,
    createdAt,
    updatedAt,
    url
  };
}

export function normalizePublicIssues(project, issues) {
  if (!Array.isArray(issues)) return [];
  return issues
    .map(issue => normalizePublicIssue(project, issue))
    .filter(Boolean);
}

export function sortPublicIssues(issues, limit = 50) {
  if (!Array.isArray(issues)) return [];
  const maximum = Math.max(1, Math.min(Number(limit) || 50, 100));

  return [...issues]
    .sort((left, right) =>
      Date.parse(right.updatedAt) - Date.parse(left.updatedAt) ||
      left.number - right.number
    )
    .slice(0, maximum);
}
