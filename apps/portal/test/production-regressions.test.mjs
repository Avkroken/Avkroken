import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const worker = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const css = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");
const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const docsClient = await readFile(new URL("../public/docs.js", import.meta.url), "utf8");

test("documentation and releases prefer Skvallerbyttans authenticated public GitHub RPCs", () => {
  assert.match(worker, /getPublicDocumentationIndex/);
  assert.match(worker, /getPublicRepositoryReleases/);
  assert.match(worker, /github-docs-v5/);
  assert.match(worker, /serviceTrees\.get\(repo\.name\)/);
  assert.match(worker, /serviceTreeCoversAppSource\(serviceTree, appSource\)/);
  assert.match(worker, /return fallbackTree\(repo\)/);
  assert.match(worker, /serviceReleases\?\.has\(repoName\)/);
});

test("portal HTML does not render escaped newlines between script tags", () => {
  assert.doesNotMatch(html, /<\/script>\\n\s*<script/);
});

test("documentation client bypasses the previous edge-cached catalog generation", () => {
  assert.match(docsClient, /const docsCatalogUrl = "\/api\/docs\?catalog=v5"/);
  assert.match(docsClient, /fetch\(docsCatalogUrl/);
});

test("service cards open their Portal project page while explicit service actions stay available", () => {
  assert.match(app, /function projectCard\(project, \{ service = false \} = \{\}\)/);
  assert.match(app, /const cardTarget = project\.portalUrl/);
  assert.match(app, /class="card-hit-area" data-portal-route/);
  assert.match(app, /target === serviceGrid/);
  assert.match(app, />Öppna tjänst<\/a>/);
  assert.match(css, /\.card-hit-area\s*\{/);
  assert.match(css, /\.card-hit-area:focus-visible\s*\{/);
});
