import test from "node:test";
import assert from "node:assert/strict";
import { isRetiredRepository } from "../src/repository-policy.mjs";

test("retired source repositories are excluded from portal discovery", () => {
  for (const name of ["Skvallerbyttan", "Krosa-Maja", "Jobb", "Dumpen"]) {
    assert.equal(isRetiredRepository(name), true, name);
  }
});

test("active repositories remain discoverable", () => {
  for (const name of ["Bastion", "Produkter", "Politiker", "Klarsprak"]) {
    assert.equal(isRetiredRepository(name), false, name);
  }
});
