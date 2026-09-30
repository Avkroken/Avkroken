import test from "node:test";
import assert from "node:assert/strict";
import {
  pageLabel,
  pageSort,
  treeMarkdownPages,
  treeReadmePage,
} from "../src/docs-pages.mjs";

const tree = [
  { type: "blob", path: "README.md" },
  { type: "blob", path: "docs/index.md" },
  { type: "blob", path: "docs/architecture.md" },
  { type: "blob", path: "docs/guide/deep.md" },
  { type: "blob", path: "docs/guide/deeper/too-deep.md" },
  { type: "blob", path: "src/README.md" },
];

test("documentation labels distinguish overview, docs index and nested indexes", () => {
  assert.equal(pageLabel("README.md"), "Översikt");
  assert.equal(pageLabel("docs/index.md"), "Dokumentation");
  assert.equal(pageLabel("apps/skvallerbyttan/README.md"), "Översikt");
  assert.equal(pageLabel("apps/skvallerbyttan/docs/index.md"), "Dokumentation");
  assert.equal(pageLabel("docs/organization/index.md"), "Organisation");
  assert.equal(pageLabel("docs/architecture.md"), "Arkitektur");
});

test("repository docs keep root README and bounded docs pages without duplicate overview", () => {
  const pages = treeMarkdownPages(tree, "docs", 2);
  const readme = treeReadmePage(tree);
  if (readme) pages.push(readme);
  pages.sort(pageSort);

  assert.deepEqual(pages.map(page => page.path), [
    "README.md",
    "docs/index.md",
    "docs/architecture.md",
    "docs/guide/deep.md",
    "docs/guide/deeper/too-deep.md",
  ]);
  assert.deepEqual(pages.map(page => page.label).slice(0, 2), [
    "Översikt",
    "Dokumentation",
  ]);
  assert.equal(pages.filter(page => page.label === "Översikt").length, 1);
});
