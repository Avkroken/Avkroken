const REPOSITORY_NAME = /^[A-Za-z0-9._-]+$/;
const APP_SOURCE_PATH = /^apps\/[A-Za-z0-9._-]+$/;

function text(value, maxLength) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) return null;
  return normalized;
}

function githubRepositoryUrl(value) {
  const url = text(value, 240);
  return url && url.startsWith("https://github.com/") ? url : null;
}

export function repositoryDocsSource(repo) {
  const name = text(repo?.name, 120);
  const repository = githubRepositoryUrl(repo?.html_url);
  const defaultBranch = text(repo?.default_branch, 120);

  if (!name || !REPOSITORY_NAME.test(name) || !repository || !defaultBranch) return null;

  return {
    key: name,
    name,
    sourceKind: "repository",
    sourceRepository: name,
    sourcePath: null,
    docsRoot: "docs",
    readmePath: null,
    repository,
    issues: repository + "/issues",
    language: typeof repo?.language === "string" ? repo.language : null,
    updatedAt: repo?.pushed_at || repo?.updated_at || null,
    defaultBranch,
    hasPages: repo?.has_pages === true,
    pagesUrl: repo?.has_pages === true
      ? "https://avkroken.github.io/" + encodeURIComponent(name) + "/"
      : null
  };
}

export function appDocsSource(project) {
  if (project?.type !== "app" || project?.source?.kind !== "monorepo_app") return null;

  const key = text(project.slug, 64);
  const name = text(project.name, 80);
  const repository = githubRepositoryUrl(project.repository);
  const sourceRepositoryFullName = text(project.source.repository, 160);
  const defaultBranch = text(project.source.ref, 120);
  const sourcePath = text(project.source.path, 240);

  if (!key || !name || !repository || !sourceRepositoryFullName || !defaultBranch || !sourcePath) {
    return null;
  }
  if (!APP_SOURCE_PATH.test(sourcePath)) return null;

  const parts = sourceRepositoryFullName.split("/");
  if (parts.length !== 2 || parts[0] !== "Avkroken" || !REPOSITORY_NAME.test(parts[1])) return null;

  return {
    key,
    name,
    sourceKind: "app",
    sourceRepository: parts[1],
    sourcePath,
    docsRoot: sourcePath + "/docs",
    readmePath: sourcePath + "/README.md",
    repository,
    issues: project.issues || repository + "/issues",
    language: project.language || null,
    updatedAt: project.updatedAt || null,
    defaultBranch,
    hasPages: false,
    pagesUrl: null
  };
}

export function docsContentLocation(entry, requestedPath) {
  const path = text(requestedPath, 400);
  if (!entry || !path || !Array.isArray(entry.pages)) return null;
  if (!entry.pages.some(page => page?.path === path)) return null;

  const sourceRepository = text(entry.sourceRepository, 120);
  const ref = text(entry.defaultBranch, 120);
  if (!sourceRepository || !REPOSITORY_NAME.test(sourceRepository) || !ref) return null;

  return { repository: sourceRepository, ref, path };
}

export function canonicalDocUrl(entry, requestedPath) {
  const location = docsContentLocation(entry, requestedPath);
  const repository = githubRepositoryUrl(entry?.repository);
  if (!location || !repository) return null;

  return repository + "/blob/" + encodeURIComponent(location.ref) + "/" +
    location.path.split("/").map(encodeURIComponent).join("/");
}
