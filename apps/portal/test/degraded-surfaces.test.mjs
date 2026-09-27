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

test("project Issues clears previously rendered state when upstream is unavailable", () => {
  assert.ok(issues.includes('if (payload.status !== "available") throw new Error("project Issues unavailable")'));
  assert.ok(issues.includes('status.textContent = "Otillgänglig"'));
  assert.ok(issues.includes('generated.textContent = ""'));
  assert.ok(issues.includes("clear()"));
  assert.ok(issues.includes("original.hidden = true"));
  assert.ok(issues.includes("errorState.hidden = false"));
});

test("project Releases clears previously rendered state when upstream is unavailable", () => {
  assert.ok(releases.includes('if (payload.status !== "available") throw new Error("project releases unavailable")'));
  assert.ok(releases.includes('status.textContent = "Otillgänglig"'));
  assert.ok(releases.includes('generated.textContent = ""'));
  assert.ok(releases.includes("clear()"));
  assert.ok(releases.includes("original.hidden = true"));
  assert.ok(releases.includes("errorState.hidden = false"));
});

test("project Builds resets sampled CI state when observations are unavailable", () => {
  assert.ok(builds.includes('if (payload.status !== "available") throw new Error("project Builds unavailable")'));
  assert.ok(builds.includes('status.textContent = "Otillgänglig"'));
  assert.ok(builds.includes('generated.textContent = ""'));
  assert.ok(builds.includes("resetStates()"));
  assert.ok(builds.includes("original.hidden = true"));
  assert.ok(builds.includes("errorState.hidden = false"));
});

test("Activity clears event rows and exposes explicit unavailable state", () => {
  assert.ok(activity.includes('if (payload.status !== "available") throw new Error("activity unavailable")'));
  assert.ok(activity.includes('status.textContent = "Otillgänglig"'));
  assert.ok(activity.includes('generated.textContent = ""'));
  assert.ok(activity.includes('observedCount.textContent = "—"'));
  assert.ok(activity.includes('repositoryCount.textContent = "—"'));
  assert.ok(activity.includes('coverageSummary.textContent = "—"'));
  assert.ok(activity.includes("clear()"));
  assert.ok(activity.includes("original.hidden = true"));
  assert.ok(activity.includes("errorState.hidden = false"));
});

test("Search fails closed to an empty public result state without protected fallback", () => {
  assert.ok(search.includes('status.textContent = "Sök otillgänglig"'));
  assert.ok(search.includes('freshness.textContent = ""'));
  assert.ok(search.includes('emptyState('));
  assert.ok(search.includes('"Sökindexet kunde inte läsas."'));
  assert.ok(search.includes('"Ingen skyddad källa används som fallback."'));
  assert.equal(search.includes("/auth/jobb"), false);
  assert.equal(search.includes("Bearer "), false);
  assert.equal(search.includes("api.github.com"), false);
});

test("home dashboard degrades public sources independently instead of fabricating state", () => {
  assert.ok(home.includes("Promise.allSettled(["));
  assert.ok(home.includes('readJson("/api/projects")'));
  assert.ok(home.includes('readJson("/api/operations")'));
  assert.ok(home.includes('readJson("/api/activity?days=7")'));

  assert.ok(home.includes('failedCard(projectCount, projectCopy, "Projektkatalogen är tillfälligt otillgänglig.")'));
  assert.ok(home.includes('failedCard(providerStatus, providerCopy, "Driftöversikten är tillfälligt otillgänglig.")'));
  assert.ok(home.includes('failedCard(activityCount, activityCopy, "Aktivitetsunderlaget är tillfälligt otillgängligt.")'));
  assert.ok(home.includes('"Portalen fabricerar inte provider- eller capability-status."'));
  assert.ok(home.includes('"Ingen aktivitet antas när observationskällan saknas."'));

  assert.equal(home.includes("api.github.com"), false);
  assert.equal(home.includes("skvallerbyttan.denied.se"), false);
  assert.equal(home.includes("/auth/jobb"), false);
  assert.equal(home.includes("Bearer "), false);
});
