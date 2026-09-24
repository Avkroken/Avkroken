import assert from "node:assert/strict";
import test from "node:test";
import { normalizeRuleset } from "../src/github-governance";

test("ruleset provenance distinguishes repository direct from inherited organization state", () => {
  const inherited = normalizeRuleset({
    id: 123,
    name: "main-node",
    source_type: "Organization",
    source: "Avkroken",
    enforcement: "active",
    rules: [{ type: "workflows", parameters: { workflows: [{ repository_id: 1, path: ".github/workflows/node.yml" }] } }],
  }, "2026-09-19T08:00:00.000Z") as any;
  assert.equal(inherited.provenance.inherited, true);
  assert.equal(inherited.provenance.direct, false);
  assert.equal(inherited.provenance.derived, false);
});


