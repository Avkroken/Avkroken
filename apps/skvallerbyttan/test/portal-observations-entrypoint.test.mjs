import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const entry = await readFile(new URL("../src/entry.ts", import.meta.url), "utf8");
const observations = await readFile(new URL("../src/portal-observations.ts", import.meta.url), "utf8");

test("Skvallerbyttan exports a dedicated Portal observations RPC entrypoint", () => {
  assert.match(
    entry,
    /export \{ PortalObservationsService \} from "\.\/portal-observations";/
  );
  assert.match(
    observations,
    /class PortalObservationsService extends WorkerEntrypoint<Env>/
  );
  assert.match(observations, /getPublicOperationsSummary/);
});

test("Portal observations service does not use HTTP read-token authorization", () => {
  assert.equal(observations.includes("SKVALLERBYTTAN_READ_API_TOKEN"), false);
  assert.equal(observations.includes("authorization"), false);
  assert.equal(observations.includes("Bearer "), false);
  assert.equal(observations.includes("recent:"), false);
});
