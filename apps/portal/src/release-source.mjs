import { isOwnedGitHubRepository } from "./github-scope.mjs";

const RELEASE_CATEGORY_HEADINGS = new Map([
  ["feature", "features"],
  ["features", "features"],
  ["bug fix", "fixes"],
  ["bug fixes", "fixes"],
  ["fix", "fixes"],
  ["fixes", "fixes"],
  ["security", "security"],
  ["security fix", "security"],
  ["security fixes", "security"],
  ["security update", "security"],
  ["security updates", "security"],
  ["documentation", "documentation"],
  ["docs", "documentation"]
]);

export function releaseCategories(body) {
  const categories = new Set(["releases"]);
  if (typeof body !== "string" || !body.trim()) return [...categories];

  for (const line of body.split(/\r?\n/)) {
    const match = line.match(/^#{2,3}\s+(.+?)\s*#*\s*$/);
    if (!match) continue;

    const heading = match[1]
      .replace(/[*_`]/g, "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");

    const category = RELEASE_CATEGORY_HEADINGS.get(heading);
    if (category) categories.add(category);
  }

  return [...categories];
}

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

function canonicalCommit(repository, sha, releaseTarget = false) {
  const normalized = typeof sha === "string" ? sha.toLowerCase() : "";
  if (!/^[0-9a-f]{40}$/.test(normalized)) return null;
  return {
    sha: normalized,
    shortSha: normalized.slice(0, 7),
    url: "https://github.com/" + repository + "/commit/" + normalized,
    releaseTarget,
    source: releaseTarget ? "target_commitish" : "release_note_commit_url",
    derived: true
  };
}

function releasePreviousTag(body) {
  if (typeof body !== "string") return null;
  const match = body.match(/^Changes since ([A-Za-z0-9][A-Za-z0-9._+-]{0,119})\.\s*$/m);
  return match ? match[1] : null;
}

export function releaseCorrelation(repository, body, targetCommitish) {
  if (typeof repository !== "string" || !isOwnedGitHubRepository(repository)) return null;

  const commits = new Map();
  const pullRequests = new Map();
  const prefix = "https://github.com/" + repository + "/commit/";

  if (typeof body === "string") {
    for (const line of body.split(/\r?\n/)) {
      if (!line.trimStart().startsWith("-")) continue;

      let cursor = 0;
      while (cursor < line.length) {
        const start = line.indexOf(prefix, cursor);
        if (start < 0) break;
        const sha = line.slice(start + prefix.length, start + prefix.length + 40);
        const commit = canonicalCommit(repository, sha, false);
        if (commit && !commits.has(commit.sha) && commits.size < 20) {
          commits.set(commit.sha, commit);
        }
        cursor = start + prefix.length + Math.max(40, sha.length);
      }

      if (line.includes(prefix)) {
        for (const match of line.matchAll(/\(#([1-9][0-9]{0,8})\)/g)) {
          const number = Number(match[1]);
          if (!Number.isSafeInteger(number) || pullRequests.has(number) || pullRequests.size >= 20) continue;
          pullRequests.set(number, {
            number,
            url: "https://github.com/" + repository + "/pull/" + number,
            source: "release_note_reference",
            derived: true
          });
        }
      }
    }
  }

  const target = canonicalCommit(repository, targetCommitish, true);
  if (target) {
    const existing = commits.get(target.sha);
    commits.set(target.sha, existing ? { ...existing, releaseTarget: true } : target);
  }

  const previousTag = releasePreviousTag(body);
  if (!previousTag && commits.size === 0 && pullRequests.size === 0) return null;

  return {
    source: "release_metadata",
    derived: true,
    previousTag,
    commits: [...commits.values()],
    pullRequests: [...pullRequests.values()]
  };
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
      isOwnedGitHubRepository(project.source.repository) &&
      typeof project?.portalUrl === "string"
    )
    .slice(0, maximum);
}

function normalizedReleaseCategories(value, body) {
  const allowed = new Set(["releases", "features", "fixes", "security", "documentation"]);
  if (Array.isArray(value)) {
    const categories = [...new Set(value.filter(item => typeof item === "string" && allowed.has(item)))];
    if (!categories.includes("releases")) categories.unshift("releases");
    return categories;
  }
  return releaseCategories(body);
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
  if (!repository || !isOwnedGitHubRepository(repository)) return null;
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

  const correlation = releaseCorrelation(
    repository,
    release.body,
    release.target_commitish
  );

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
    categories: normalizedReleaseCategories(release.categories, release.body),
    prerelease: release.prerelease === true,
    ...(correlation ? { correlation } : {})
  };
}

export function normalizePublicReleases(project, releases) {
  if (!Array.isArray(releases)) return [];

  return releases
    .map(release => normalizePublicRelease(project, release))
    .filter(Boolean);
}

export function releaseDeploymentRequests(releases, repositoryLimit = 8) {
  if (!Array.isArray(releases)) return [];
  const maximum = Math.max(1, Math.min(Number(repositoryLimit) || 8, 8));
  const repositories = new Map();

  for (const release of releases) {
    if (
      !release ||
      typeof release.repository !== "string" ||
      !isOwnedGitHubRepository(release.repository) ||
      !Array.isArray(release.correlation?.commits)
    ) {
      continue;
    }

    const repoName = release.repository.split("/")[1];
    if (!repoName) continue;
    if (!repositories.has(repoName) && repositories.size >= maximum) continue;

    const shas = repositories.get(repoName) || new Set();
    for (const commit of release.correlation.commits) {
      if (shas.size >= 20) break;
      const sha = typeof commit?.sha === "string" ? commit.sha.toLowerCase() : "";
      if (/^[0-9a-f]{40}$/.test(sha)) shas.add(sha);
    }
    if (shas.size) repositories.set(repoName, shas);
  }

  return [...repositories.entries()].map(([repository, shas]) => ({
    repository,
    commitShas: [...shas]
  }));
}

export function attachReleaseDeployments(releases, snapshot) {
  if (!Array.isArray(releases)) return [];
  const observations = new Map();

  if (snapshot?.schemaVersion === 1 && Array.isArray(snapshot.repositories)) {
    for (const observation of snapshot.repositories) {
      if (typeof observation?.repository !== "string") continue;
      observations.set(observation.repository.toLowerCase(), observation);
    }
  }

  return releases.map(release => {
    const commits = Array.isArray(release?.correlation?.commits)
      ? release.correlation.commits
      : [];
    if (!commits.length || typeof release.repository !== "string") return release;

    const observation = observations.get(release.repository.toLowerCase());
    let status = "unavailable";
    let truncated = false;
    let matches = [];

    if (observation?.status === "not_observed") {
      status = "not_observed";
    } else if (observation?.status === "available" && Array.isArray(observation.matches)) {
      truncated = observation.truncated === true;
      const shas = new Set(commits.map(commit => commit.sha));
      matches = observation.matches.flatMap(match => {
        if (!match || typeof match.sha !== "string") return [];
        const sha = match.sha.toLowerCase();
        if (!/^[0-9a-f]{40}$/.test(sha) || !shas.has(sha)) return [];
        return [{
          sha,
          environment: safeText(match.environment, 120),
          createdAt: validDate(match.createdAt),
          updatedAt: validDate(match.updatedAt)
        }];
      }).slice(0, 50);
      status = matches.length
        ? "available"
        : truncated
          ? "unknown"
          : "not_observed";
    }

    return {
      ...release,
      correlation: {
        ...release.correlation,
        deployments: {
          source: "github_deployments",
          status,
          truncated,
          matches
        }
      }
    };
  });
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
