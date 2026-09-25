import { isMixedScopeRepository } from "./repository-policy.mjs";

const PUBLIC_REPOSITORY = /^Avkroken\/[A-Za-z0-9._-]+$/;
const EVENT_TYPES = new Set([
  "PushEvent",
  "PullRequestEvent",
  "IssuesEvent",
  "ReleaseEvent",
  "CreateEvent",
  "DeleteEvent"
]);

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

function repositoryName(fullName) {
  const value = safeText(fullName, 160);
  if (!value || !PUBLIC_REPOSITORY.test(value)) return null;
  return value.split("/")[1] || null;
}

function canonicalRepositoryUrl(project) {
  const value = safeText(project?.repository, 320);
  if (!value) return null;

  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.host !== "github.com") return null;
    if (url.pathname !== "/" + project.source.repository) return null;
    if (url.search || url.hash || url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

function canonicalResourceUrl(repository, expectedPath, value) {
  const text = safeText(value, 360);
  if (!text) return null;

  try {
    const url = new URL(text);
    if (url.protocol !== "https:" || url.host !== "github.com") return null;
    if (url.pathname !== "/" + repository + expectedPath) return null;
    if (url.search || url.hash || url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

function integer(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function actionLabel(type, action) {
  const value = safeText(action, 48);

  if (type === "PullRequestEvent") {
    return {
      opened: "öppnad",
      closed: "stängd",
      reopened: "återöppnad",
      synchronize: "uppdaterad",
      ready_for_review: "redo för granskning",
      converted_to_draft: "gjord till utkast"
    }[value] || "uppdaterad";
  }

  if (type === "IssuesEvent") {
    return {
      opened: "öppnad",
      closed: "stängd",
      reopened: "återöppnad",
      labeled: "etiketterad",
      unlabeled: "etikett borttagen"
    }[value] || "uppdaterad";
  }

  return null;
}

export function eligibleActivityProjects(projects, limit = 50) {
  if (!Array.isArray(projects)) return [];

  const maximum = Math.max(1, Math.min(Number(limit) || 50, 100));

  return projects
    .filter(project => {
      if (
        project?.type !== "repository" ||
        project?.source?.provider !== "github" ||
        project?.source?.kind !== "repository" ||
        typeof project?.source?.repository !== "string" ||
        !PUBLIC_REPOSITORY.test(project.source.repository)
      ) {
        return false;
      }

      const name = repositoryName(project.source.repository);
      return Boolean(name) && !isMixedScopeRepository(name);
    })
    .slice(0, maximum);
}

export function normalizePublicActivityEvent(project, event) {
  if (
    !project ||
    project.type !== "repository" ||
    project?.source?.provider !== "github" ||
    project?.source?.kind !== "repository" ||
    !EVENT_TYPES.has(event?.type) ||
    event?.public !== true
  ) {
    return null;
  }

  const repository = safeText(project.source.repository, 160);
  if (!repository || !PUBLIC_REPOSITORY.test(repository)) return null;

  const name = repositoryName(repository);
  if (!name || isMixedScopeRepository(name)) return null;
  if (event?.repo?.name !== repository) return null;

  const id = safeText(event.id, 80);
  const occurredAt = validDate(event.created_at);
  const projectSlug = safeText(project.slug, 120);
  const projectName = safeText(project.name, 160);
  const projectUrl = safeText(project.portalUrl, 240);
  const repositoryUrl = canonicalRepositoryUrl(project);

  if (!id || !occurredAt || !projectSlug || !projectName || !projectUrl || !repositoryUrl) {
    return null;
  }

  let kind = null;
  let summary = null;
  let url = repositoryUrl;

  if (event.type === "PushEvent") {
    kind = "push";
    summary = "Kod pushad";
  } else if (event.type === "CreateEvent") {
    kind = "repository";
    summary = "Git-referens skapad";
  } else if (event.type === "DeleteEvent") {
    kind = "repository";
    summary = "Git-referens borttagen";
  } else if (event.type === "PullRequestEvent") {
    const number = integer(event?.payload?.pull_request?.number);
    if (!number) return null;
    url = canonicalResourceUrl(
      repository,
      "/pull/" + number,
      event?.payload?.pull_request?.html_url
    );
    if (!url) return null;
    kind = "pull_request";
    summary = "Pull request #" + number + " " +
      actionLabel(event.type, event?.payload?.action);
  } else if (event.type === "IssuesEvent") {
    const number = integer(event?.payload?.issue?.number);
    if (!number) return null;
    url = canonicalResourceUrl(
      repository,
      "/issues/" + number,
      event?.payload?.issue?.html_url
    );
    if (!url) return null;
    kind = "issue";
    summary = "Issue #" + number + " " +
      actionLabel(event.type, event?.payload?.action);
  } else if (event.type === "ReleaseEvent") {
    const releaseUrl = safeText(event?.payload?.release?.html_url, 360);
    if (!releaseUrl) return null;

    try {
      const parsed = new URL(releaseUrl);
      if (
        parsed.protocol !== "https:" ||
        parsed.host !== "github.com" ||
        !parsed.pathname.startsWith("/" + repository + "/releases/tag/") ||
        parsed.search ||
        parsed.hash ||
        parsed.username ||
        parsed.password
      ) {
        return null;
      }
      url = parsed.href;
    } catch {
      return null;
    }

    kind = "release";
    summary = "Release publicerad";
  }

  if (!kind || !summary || !url) return null;

  return {
    id: "github-event:" + id,
    kind,
    projectSlug,
    projectName,
    projectUrl,
    repository,
    summary,
    occurredAt,
    url
  };
}

export function normalizePublicActivity(projects, events) {
  if (!Array.isArray(projects) || !Array.isArray(events)) return [];

  const eligible = eligibleActivityProjects(projects);
  const byRepository = new Map(
    eligible.map(project => [project.source.repository, project])
  );

  const unique = new Map();
  for (const event of events) {
    const project = byRepository.get(event?.repo?.name);
    if (!project) continue;

    const item = normalizePublicActivityEvent(project, event);
    if (!item || unique.has(item.id)) continue;
    unique.set(item.id, item);
  }

  return [...unique.values()];
}

export function sortPublicActivity(items, limit = 40) {
  if (!Array.isArray(items)) return [];
  const maximum = Math.max(1, Math.min(Number(limit) || 40, 100));

  return [...items]
    .sort((left, right) =>
      Date.parse(right.occurredAt) - Date.parse(left.occurredAt) ||
      left.id.localeCompare(right.id, "sv")
    )
    .slice(0, maximum);
}
