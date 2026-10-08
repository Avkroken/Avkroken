import assert from "node:assert/strict";
import test from "node:test";
import {
  OBSERVATION_STATUSES,
  SERVICE_IDS,
  clampPageLimit,
  effectiveStatus,
  freshnessFromTimestamp,
  isFlatMetadata,
  isObservationStatus,
  statusFromHttp,
} from "../../../packages/observability-contracts/src/index.ts";

test("shared status vocabulary preserves current Skvallerbyttan semantics", () => {
  assert.deepEqual(OBSERVATION_STATUSES, [
    "available",
    "unavailable",
    "permission_denied",
    "not_configured",
    "not_supported",
    "not_exposed_by_provider",
    "unknown",
    "not_observed",
    "stale",
    "error",
  ]);
  for (const status of OBSERVATION_STATUSES) assert.equal(isObservationStatus(status), true);
  assert.equal(isObservationStatus("partial"), false);
});

test("shared service IDs include the explicit current-state module", () => {
  assert.equal(SERVICE_IDS.includes("state"), true);
  assert.equal(SERVICE_IDS.includes("skvallerbyttan"), true);
});

test("shared HTTP classification preserves permission and provider epistemics", () => {
  assert.equal(statusFromHttp(403).status, "permission_denied");
  assert.equal(statusFromHttp(503).status, "error");
  assert.equal(statusFromHttp(404).status, "unknown");
  assert.equal(statusFromHttp(200).status, "available");
});

test("shared freshness never turns missing state green", () => {
  assert.equal(freshnessFromTimestamp(null, 60_000), "unknown");
  assert.equal(freshnessFromTimestamp("2026-10-07T08:00:00.000Z", 60_000, Date.parse("2026-10-07T08:00:30.000Z")), "fresh");
  assert.equal(freshnessFromTimestamp("2026-10-07T08:00:00.000Z", 60_000, Date.parse("2026-10-07T08:02:00.000Z")), "stale");
});

test("shared effective status keeps unsupported separate from denied", () => {
  assert.equal(effectiveStatus({
    implemented: true,
    providerSupport: "not_exposed_by_provider",
    permissionState: "unknown",
    dataState: "unknown",
    freshness: "unknown",
  }), "not_exposed_by_provider");
  assert.equal(effectiveStatus({
    implemented: true,
    providerSupport: "not_supported",
    permissionState: "unknown",
    dataState: "unknown",
    freshness: "unknown",
  }), "not_supported");
  assert.equal(effectiveStatus({
    implemented: true,
    providerSupport: "supported",
    permissionState: "granted",
    dataState: "available",
    freshness: "stale",
  }), "stale");
});

test("page limits clamp untrusted values", () => {
  assert.equal(clampPageLimit(undefined), 50);
  assert.equal(clampPageLimit(0), 1);
  assert.equal(clampPageLimit(999), 100);
  assert.equal(clampPageLimit(17.9), 17);
});

test("retired Krösa-Maja auth issuer and claim evaluator are not exported", async () => {
  const contracts = await import("../../../packages/observability-contracts/src/index.ts");
  assert.equal("AUTH_ISSUER_V1" in contracts, false);
  assert.equal("authClaimsAllow" in contracts, false);
});

test("event metadata stays flat instead of carrying raw provider payloads", () => {
  assert.equal(isFlatMetadata({ action: "opened", count: 2, derived: false, note: null }), true);
  assert.equal(isFlatMetadata({ nested: { raw: "payload" } }), false);
  assert.equal(isFlatMetadata({ list: ["payload"] }), false);
});
