import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const worker = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const css = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");

test("documentation and releases prefer Skvallerbyttans authenticated public GitHub RPCs", () => {
  assert.match(worker, /getPublicDocumentationIndex/);
  assert.match(worker, /getPublicRepositoryReleases/);
  assert.match(worker, /github-docs-v4/);
  assert.match(worker, /serviceTrees\.has\(repo\.name\)/);
  assert.match(worker, /serviceReleases\?\.has\(repoName\)/);
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
