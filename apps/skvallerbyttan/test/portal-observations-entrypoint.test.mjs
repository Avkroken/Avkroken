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
  assert.match(observations, /getPublicRepositoryCi/);
  assert.match(observations, /getPublicActivity/);
});

test("Portal observations service does not use HTTP read-token authorization", () => {
  assert.equal(observations.includes("SKVALLERBYTTAN_READ_API_TOKEN"), false);
  assert.equal(observations.includes("authorization"), false);
  assert.equal(observations.includes("Bearer "), false);
  assert.equal(observations.includes("recent:"), false);
  assert.equal(observations.includes("scopeCoverage:"), false);
});


test("Portal repository CI RPC reuses Skvallerbyttan Actions ownership without HTTP auth", () => {
  assert.match(observations, /readSourceCache/);
  assert.match(observations, /buildPortalRepositoryCiSnapshot/);
  assert.match(observations, /publicCiRepository/);
  assert.equal(observations.includes("githubOptionalJson"), false);
  assert.equal(observations.includes("getRepositoryActions"), false);
  assert.equal(observations.includes("/actions/runs"), false);
  assert.equal(observations.includes("SKVALLERBYTTAN_READ_API_TOKEN"), false);
  assert.equal(observations.includes("authorization"), false);
  assert.equal(observations.includes("Bearer "), false);
});


test("Portal activity RPC reads only the internal activity ledger behind a cached public-repository gate", () => {
  assert.match(observations, /getObservedActivity/);
  assert.match(observations, /buildPortalActivitySnapshot/);
  assert.match(observations, /readSourceCache/);
  assert.equal(observations.includes("githubOptionalJson"), false);
  assert.equal(observations.includes("/events"), false);
  assert.equal(observations.includes("/actions/runs"), false);
  assert.equal(observations.includes("SKVALLERBYTTAN_READ_API_TOKEN"), false);
  assert.equal(observations.includes("authorization"), false);
  assert.equal(observations.includes("Bearer "), false);
});
