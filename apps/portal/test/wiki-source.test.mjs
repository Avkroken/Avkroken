import test from "node:test";
import assert from "node:assert/strict";
import {
  ensureWikiNavigation,
  normalizeWikiPage,
  wikiCanonicalUrl,
  wikiNavigation,
  wikiRawUrl,
} from "../src/wiki-source.mjs";

test("normalizes bounded Wiki page names and rejects traversal or arbitrary paths", () => {
  assert.equal(normalizeWikiPage("Home"), "Home");
  assert.equal(normalizeWikiPage("Drift & Säkerhet"), "Drift & Säkerhet");
  assert.equal(normalizeWikiPage("Manual-Guide.md"), "Manual-Guide");
  assert.equal(normalizeWikiPage(""), "Home");
  assert.equal(normalizeWikiPage("../README"), null);
  assert.equal(normalizeWikiPage("docs/index"), null);
  assert.equal(normalizeWikiPage("https://example.com"), null);
  assert.equal(normalizeWikiPage(".".repeat(121)), null);
});

test("builds only current-owner raw and canonical Wiki URLs", () => {
  assert.equal(
    wikiRawUrl("Avkroken/Bastion", "Home"),
    "https://raw.githubusercontent.com/wiki/Avkroken/Bastion/Home.md",
  );
  assert.equal(
    wikiCanonicalUrl("Avkroken/Bastion", "Manual Guide"),
    "https://github.com/Avkroken/Bastion/wiki/Manual%20Guide",
  );
  assert.equal(wikiRawUrl("Other/Bastion", "Home"), null);
  assert.equal(wikiCanonicalUrl("Avkroken/Bastion", "../Home"), null);
});

test("parses only bounded internal Wiki links from sidebar markdown", () => {
  const sidebar = [
    "**Navigation**",
    "- [Home](Home)",
    "- [Manual guide](Manual-Guide)",
    "- [Manual guide duplicate](Manual-Guide)",
    "- [External](https://example.com/)",
    "- [Fragment](#top)",
    "- [Traversal](../README)",
    "- [Encoded](Drift%20Guide)",
  ].join("\n");

  assert.deepEqual(wikiNavigation(sidebar), [
    { label: "Home", page: "Home" },
    { label: "Manual guide", page: "Manual-Guide" },
    { label: "Encoded", page: "Drift Guide" },
  ]);
});

test("navigation always includes Home and the current page without duplicates", () => {
  assert.deepEqual(
    ensureWikiNavigation([
      { label: "Startsida", page: "Home" },
      { label: "Manual", page: "Manual" },
    ], "Manual"),
    [
      { label: "Home", page: "Home" },
      { label: "Manual", page: "Manual" },
    ],
  );

  assert.deepEqual(
    ensureWikiNavigation([], "Runbook"),
    [
      { label: "Home", page: "Home" },
      { label: "Runbook", page: "Runbook" },
    ],
  );
});
