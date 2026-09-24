import assert from "node:assert/strict";
import test from "node:test";
import type { Env } from "../src/env";
import type { CapabilityObservation } from "../src/capabilities";
import { getProviderHealth } from "../src/provider-health";

function configuredEnv(): Env {
  return {
    GAMNACKEN_GITHUB_APP_CLIENT_ID: "app",
    GAMNACKEN_GITHUB_APP_PRIVATE_KEY: "key",
    CLOUDFLARE_ACCOUNT_ID: "account",
    CLOUDFLARE_API_TOKEN_R1: "r1",
    CLOUDFLARE_API_TOKEN_R2: "r2",
    CLOUDFLARE_API_TOKEN_R3: "r3",
  } as Env;
}

function observedGitHub(
  status: "available" | "permission_denied" = "available",
  httpStatus = status === "available" ? 200 : 403,
): CapabilityObservation {
  return {
    key: "github.avkroken.repositories",
    name: "Repositories",
    provider: "github",
    scope: "organization",
    implemented: true,
    providerSupport: "supported",
    endpoint: "GET /orgs/{org}/repos",
    permission: "Metadata / repository access",
    permissionLevel: "read",
    supports: ["list"],
    cacheTtlMs: 60_000,
    status,
    permissionState: status === "available" ? "granted" : "permission_denied",
    dataState: status === "available" ? "available" : "unavailable",
    freshness: "fresh",
    lastAttemptAt: "2026-09-21T20:01:00.000Z",
    lastSuccessAt: status === "available" ? "2026-09-21T20:01:00.000Z" : null,
    lastHttpStatus: httpStatus,
    lastError: status === "available" ? null : "github-http-403",
    acceptedPermissions: null,
    scopeCoverage: null,
  };
}

function observedCloudflare(
  key: string,
  status: "available" | "permission_denied" = "available",
  httpStatus = status === "available" ? 200 : 403,
): CapabilityObservation {
  return {
    key,
    name: key,
    provider: "cloudflare",
    scope: "account",
    implemented: true,
    providerSupport: "supported",
    endpoint: "GET /test",
    permission: "read",
    permissionLevel: "read",
    supports: [],
    cacheTtlMs: 60_000,
    status,
    permissionState: status === "available" ? "granted" : "permission_denied",
    dataState: status === "available" ? "available" : "unavailable",
    freshness: "fresh",
    lastAttemptAt: "2026-09-21T19:46:00.000Z",
    lastSuccessAt: status === "available" ? "2026-09-21T19:46:00.000Z" : null,
    lastHttpStatus: httpStatus,
    lastError: status === "available" ? null : "cloudflare-http-403",
    acceptedPermissions: null,
    scopeCoverage: null,
  };
}

test("provider health does not claim unobserved credentials are live", () => {
  const state = getProviderHealth(configuredEnv()) as any;

  assert.equal(state.providers.github.status, "not_observed");
  assert.equal(state.providers.cloudflare.status, "not_observed");
  assert.equal(state.providers.github.reconciliation.status, "unknown");
});

test("GitHub provider health uses persisted readiness instead of an unrelated capability response", () => {
  const state = getProviderHealth(configuredEnv(), [observedGitHub()]) as any;

  assert.equal(state.providers.github.status, "available");
  assert.equal(state.providers.github.auth.lastObservedAt, "2026-09-21T20:01:00.000Z");
  assert.equal(state.providers.github.auth.lastStatus, 200);
});

test("persisted GitHub permission denial is surfaced by provider health", () => {
  const state = getProviderHealth(
    configuredEnv(),
    [observedGitHub("permission_denied", 403)],
  ) as any;

  assert.equal(state.providers.github.status, "permission_denied");
  assert.equal(state.providers.github.auth.lastStatus, 403);
});

test("Cloudflare provider health survives Worker isolate boundaries through persisted readiness probes", () => {
  const capabilities = [
    observedCloudflare("cloudflare.avkroken.zones"),
    observedCloudflare("cloudflare.avkroken.account"),
    observedCloudflare("cloudflare.avkroken.zero_trust.tunnels"),
  ];

  const state = getProviderHealth(configuredEnv(), capabilities) as any;

  assert.equal(state.providers.cloudflare.status, "available");
  assert.equal(state.providers.cloudflare.auth.lastObservedAt, "2026-09-21T19:46:00.000Z");
  assert.equal(state.providers.cloudflare.auth.lastStatus, 200);
});

test("persisted Cloudflare permission denial is surfaced instead of not_observed", () => {
  const capabilities = [
    observedCloudflare("cloudflare.avkroken.zones"),
    observedCloudflare("cloudflare.avkroken.account"),
    observedCloudflare("cloudflare.avkroken.zero_trust.tunnels", "permission_denied", 403),
  ];

  const state = getProviderHealth(configuredEnv(), capabilities) as any;

  assert.equal(state.providers.cloudflare.status, "permission_denied");
});
