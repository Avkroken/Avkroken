import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [html, client, pkg] = await Promise.all([
  readFile(new URL("../public/index.html", import.meta.url), "utf8"),
  readFile(new URL("../public/home-dashboard.js", import.meta.url), "utf8"),
  readFile(new URL("../package.json", import.meta.url), "utf8")
]);

test("home renders a bounded public-safe control surface", () => {
  for (const id of [
    "home-control-title",
    "home-project-count",
    "home-provider-status",
    "home-attention-count",
    "home-activity-count",
    "home-dashboard-freshness",
    "home-attention-list",
    "home-recent-activity",
    "home-dashboard-error"
  ]) {
    assert.match(html, new RegExp('id="' + id + '"'));
  }

  assert.match(html, /src="\/home-dashboard\.js"/);
});

test("home client reads only existing Portal APIs", () => {
  assert.ok(client.includes('readJson("/api/projects")'));
  assert.ok(client.includes('readJson("/api/operations")'));
  assert.ok(client.includes('readJson("/api/activity?days=7")'));

  assert.equal(client.includes("api.github.com"), false);
  assert.equal(client.includes("skvallerbyttan.denied.se"), false);
  assert.equal(client.includes("/auth/jobb"), false);
  assert.equal(client.includes("authorization"), false);
  assert.equal(client.includes("Bearer "), false);
  assert.equal(client.includes("/api/changelog"), false);
});

test("home client renders provider values through DOM text", () => {
  assert.ok(client.includes("textContent"));
  assert.equal(client.includes("innerHTML"), false);
});

test("portal test command syntax-checks the home dashboard client", () => {
  const parsed = JSON.parse(pkg);
  assert.match(parsed.scripts.test, /node --check public\/home-dashboard\.js/);
});
