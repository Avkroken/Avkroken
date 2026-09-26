export const GITHUB_OWNER = "blixten85";

const REPOSITORY_NAME = /^[A-Za-z0-9._-]+$/;

export function githubRepositoryFullName(name) {
  const repositoryName = String(name || "").trim();
  if (!REPOSITORY_NAME.test(repositoryName)) return null;
  return GITHUB_OWNER + "/" + repositoryName;
}

export function isOwnedGitHubRepository(value) {
  if (typeof value !== "string") return false;
  const parts = value.trim().split("/");
  return parts.length === 2 &&
    parts[0].toLowerCase() === GITHUB_OWNER.toLowerCase() &&
    REPOSITORY_NAME.test(parts[1]);
}

export function repositoryNameFromOwnedFullName(value) {
  return isOwnedGitHubRepository(value) ? value.trim().split("/")[1] : null;
}

export function githubUserRepositoriesApi() {
  return "https://api.github.com/users/" + encodeURIComponent(GITHUB_OWNER) +
    "/repos?type=owner&per_page=100&sort=full_name&direction=asc";
}

export function githubRepositoryApiBase(name) {
  const repositoryName = String(name || "").trim();
  if (!REPOSITORY_NAME.test(repositoryName)) {
    throw new Error("invalid GitHub repository name");
  }
  return "https://api.github.com/repos/" + encodeURIComponent(GITHUB_OWNER) + "/" +
    encodeURIComponent(repositoryName);
}

export function githubPagesUrl(name) {
  const repositoryName = String(name || "").trim();
  if (!REPOSITORY_NAME.test(repositoryName)) return null;
  return "https://" + GITHUB_OWNER.toLowerCase() + ".github.io/" +
    encodeURIComponent(repositoryName) + "/";
}
