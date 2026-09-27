import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [
  issues,
  releases,
  builds,
  activity,
  search,
  home
] = await Promise.all([
  readFile(new URL("../public/project-issues.js", import.meta.url), "utf8"),
  readFile(new URL("../public/project-releases.js", import.meta.url), "utf8"),
  readFile(new URL("../public/project-builds.js", import.meta.url), "utf8"),
  readFile(new URL("../public/activity.js", import.meta.url), "utf8"),
  readFile(new URL("../public/search.js", import.meta.url), "utf8"),
  readFile(new URL("../public/home-dashboard.js", import.meta.url), "utf8")
]);

const DIRECT_GITHUB_API_HOST = ["api", "github", "com"].join(".");

function section(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.notEqual(from, -1, start);
  assert.notEqual(to, -1, end);
  return source.slice(from, to);
}

function failureHandler(source, loaderStart, loaderEnd) {
  const loader = section(source, loaderStart, loaderEnd);
  const failure = section(loader, "} catch (error) {", "console.error(error);");
  return { loader, failure };
}

test("project Issues clears previously rendered state when upstream is unavailable", () => {
  const { loader, failure } = failureHandler(
    issues,
    "async function loadProjectIssues()",
    'window.addEventListener("portal:routechange"'
  );

  assert.ok(loader.includes('if (payload.status !== "available") throw new Error("project Issues unavailable")'));
  assert.ok(failure.includes('status.textContent = "Otillgänglig"'));
  assert.ok(failure.includes('generated.textContent = ""'));
  assert.ok(failure.includes("clear()"));
  assert.ok(failure.includes("original.hidden = true"));
  assert.ok(failure.includes("errorState.hidden = false"));
});

test("project Releases clears previously rendered state when upstream is unavailable", () => {
  const { loader, failure } = failureHandler(
    releases,
    "async function loadProjectReleases()",
    'window.addEventListener("portal:routechange"'
  );

  assert.ok(loader.includes('if (payload.status !== "available") throw new Error("project releases unavailable")'));
  assert.ok(failure.includes('status.textContent = "Otillgänglig"'));
  assert.ok(failure.includes('generated.textContent = ""'));
  assert.ok(failure.includes("clear()"));
  assert.ok(failure.includes("original.hidden = true"));
  assert.ok(failure.includes("errorState.hidden = false"));
});

test("project Builds resets sampled CI state when observations are unavailable", () => {
  const { loader, failure } = failureHandler(
    builds,
    "async function loadProjectBuilds()",
    'window.addEventListener("portal:routechange"'
  );

  assert.ok(loader.includes('if (payload.status !== "available") throw new Error("project Builds unavailable")'));
  assert.ok(failure.includes('status.textContent = "Otillgänglig"'));
  assert.ok(failure.includes('generated.textContent = ""'));
  assert.ok(failure.includes("resetStates()"));
  assert.ok(failure.includes("original.hidden = true"));
  assert.ok(failure.includes("errorState.hidden = false"));
});

test("Activity clears event rows and exposes explicit unavailable state", () => {
  const { loader, failure } = failureHandler(
    activity,
    "async function loadActivity()",
    'for (const button of periodButtons)'
  );

  assert.ok(loader.includes('if (payload.status !== "available") throw new Error("activity unavailable")'));
  assert.ok(failure.includes('status.textContent = "Otillgänglig"'));
  assert.ok(failure.includes('generated.textContent = ""'));
  assert.ok(failure.includes('observedCount.textContent = "—"'));
  assert.ok(failure.includes('repositoryCount.textContent = "—"'));
  assert.ok(failure.includes('coverageSummary.textContent = "—"'));
  assert.ok(failure.includes("clear()"));
  assert.ok(failure.includes("original.hidden = true"));
  assert.ok(failure.includes("errorState.hidden = false"));
});

test("Search fails closed to an empty public result state without protected fallback", () => {
  const { failure } = failureHandler(
    search,
    "async function runSearch()",
    'form?.addEventListener("submit"'
  );

  assert.ok(failure.includes('status.textContent = "Sök otillgänglig"'));
  assert.ok(failure.includes('freshness.textContent = ""'));
  assert.ok(failure.includes("emptyState("));
  assert.ok(failure.includes('"Sökindexet kunde inte läsas."'));
  assert.ok(failure.includes("Ingen skyddad källa används som fallback."));
  assert.equal(search.includes("/auth/jobb"), false);
  assert.equal(search.includes("Bearer "), false);
  assert.equal(search.includes(DIRECT_GITHUB_API_HOST), false);
});

test("home dashboard degrades public sources independently instead of fabricating state", () => {
  const loader = section(
    home,
    "async function loadHomeDashboard({ force = false } = {})",
    'window.addEventListener("portal:routechange"'
  );

  assert.ok(loader.includes("Promise.allSettled(["));
  assert.ok(loader.includes('readJson("/api/projects")'));
  assert.ok(loader.includes('readJson("/api/operations")'));
  assert.ok(loader.includes('readJson("/api/activity?days=7")'));

  assert.ok(loader.includes('failedCard(projectCount, projectCopy, "Projektkatalogen är tillfälligt otillgänglig.")'));
  assert.ok(loader.includes('failedCard(providerStatus, providerCopy, "Driftöversikten är tillfälligt otillgänglig.")'));
  assert.ok(loader.includes('failedCard(activityCount, activityCopy, "Aktivitetsunderlaget är tillfälligt otillgängligt.")'));
  assert.ok(home.includes('"Portalen fabricerar inte provider- eller capability-status."'));
  assert.ok(loader.includes('"Ingen aktivitet antas när observationskällan saknas."'));

  assert.equal(home.includes(DIRECT_GITHUB_API_HOST), false);
  assert.equal(home.includes("skvallerbyttan.denied.se"), false);
  assert.equal(home.includes("/auth/jobb"), false);
  assert.equal(home.includes("Bearer "), false);
});
