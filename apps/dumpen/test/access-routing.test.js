import assert from "node:assert/strict";
import test from "node:test";

import worker, { accessRoute } from "../src/access.js";

test("public root is served without bucket metadata", () => {
  assert.deepEqual(accessRoute("/", "GET"), { type: "public-page", pathname: "/" });
  assert.deepEqual(accessRoute("/", "HEAD"), { type: "public-page", pathname: "/" });
});

test("crawler control endpoints are handled before the app", () => {
  assert.deepEqual(accessRoute("/robots.txt", "GET"), { type: "robots", pathname: "/robots.txt" });
  assert.deepEqual(accessRoute("/sitemap.xml", "GET"), { type: "not-found", pathname: "/sitemap.xml" });
});

test("public root is explicitly noindex", async () => {
  const response = await worker.fetch(new Request("https://dumpen.denied.se/"), {}, {});
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-robots-tag"), "noindex, nofollow, noarchive");
  assert.match(html, /<meta name="robots" content="noindex,nofollow,noarchive">/);
});

test("robots allows crawling so noindex can be observed", async () => {
  const response = await worker.fetch(new Request("https://dumpen.denied.se/robots.txt"), {}, {});
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "text/plain; charset=utf-8");
  assert.equal(response.headers.get("x-robots-tag"), "noindex, nofollow, noarchive");
  assert.equal(await response.text(), "User-agent: *\nAllow: /\n");
});

test("Dumpen does not advertise a sitemap", async () => {
  const response = await worker.fetch(new Request("https://dumpen.denied.se/sitemap.xml"), {}, {});
  assert.equal(response.status, 404);
  assert.equal(response.headers.get("x-robots-tag"), "noindex, nofollow, noarchive");
});

test("privileged admin APIs live under /admin/api", () => {
  assert.deepEqual(accessRoute("/admin/api/objects"), { type: "rewrite", pathname: "/api/objects" });
  assert.deepEqual(accessRoute("/admin/api/tickets"), { type: "rewrite", pathname: "/api/tickets" });
  assert.deepEqual(accessRoute("/admin/api/download/example"), { type: "rewrite", pathname: "/api/download/example" });
});

test("legacy privileged API paths redirect into the protected admin namespace", () => {
  assert.deepEqual(accessRoute("/api/objects"), { type: "redirect", pathname: "/admin/api/objects" });
  assert.deepEqual(accessRoute("/api/tickets"), { type: "redirect", pathname: "/admin/api/tickets" });
  assert.deepEqual(accessRoute("/api/download/example"), { type: "redirect", pathname: "/admin/api/download/example" });
});

test("public capability uploads remain public", () => {
  assert.deepEqual(accessRoute("/api/upload/token"), { type: "pass", pathname: "/api/upload/token" });
});

test("legacy token upload routes remain unchanged for existing automation", () => {
  assert.deepEqual(accessRoute("/backup-name"), { type: "pass", pathname: "/backup-name" });
});
