import { isOwnedGitHubRepository } from "./github-scope.mjs";

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

function canonicalIssueUrl(repository, number, value) {
  const url = safeText(value, 320);
  if (!url || !Number.isInteger(number) || number < 1) return null;

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.host !== "github.com") return null;
    if (parsed.pathname !== "/" + repository + "/issues/" + number) return null;
    if (parsed.search || parsed.hash || parsed.username || parsed.password) return null;
    return parsed.href;
  } catch {
    return null;
  }
}

function normalizeLabels(labels) {
  if (!Array.isArray(labels)) return [];

  const unique = new Set();
  for (const label of labels) {
    const name = typeof label === "string"
      ? safeText(label, 80)
      : safeText(label?.name, 80);
    if (name) unique.add(name);
    if (unique.size >= 8) break;
  }

  return [...unique];
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
      isOwnedGitHubRepository(project.source.repository) &&
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
  if (!repository || !isOwnedGitHubRepository(repository)) return null;
  if (!issue || typeof issue !== "object" || Array.isArray(issue)) return null;
  if (issue.pull_request) return null;

  const number = Number(issue.number);
  if (!Number.isInteger(number) || number < 1) return null;

  const title = safeText(issue.title, 240);
  const state = issue.state === "open" || issue.state === "closed" ? issue.state : null;
  const createdAt = validDate(issue.created_at);
  const updatedAt = validDate(issue.updated_at);
  const url = canonicalIssueUrl(repository, number, issue.html_url);

  const projectSlug = safeText(project.slug, 120);
  const projectName = safeText(project.name, 160);
  const projectUrl = safeText(project.portalUrl, 240);

  if (!title || !state || !createdAt || !updatedAt || !url || !projectSlug || !projectName || !projectUrl) {
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
    state,
    createdAt,
    updatedAt,
    comments: Number.isFinite(issue.comments) ? Math.max(0, Math.trunc(issue.comments)) : 0,
    labels: normalizeLabels(issue.labels),
    url
  };
}

export function normalizePublicIssues(project, issues) {
  if (!Array.isArray(issues)) return [];

  return issues
    .map(issue => normalizePublicIssue(project, issue))
    .filter(Boolean);
}

export function sortPublicIssues(issues, limit = 30) {
  if (!Array.isArray(issues)) return [];
  const maximum = Math.max(1, Math.min(Number(limit) || 30, 100));

  return [...issues]
    .sort((left, right) =>
      Date.parse(right.updatedAt) - Date.parse(left.updatedAt) ||
      left.number - right.number
    )
    .slice(0, maximum);
}
