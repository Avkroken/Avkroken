import assert from "node:assert/strict";
import test from "node:test";
import type { Env } from "../src/env";
import {
  reportRuntimeHeartbeat,
  runtimeReadiness,
  type RuntimeReadinessProbes,
} from "../src/runtime-heartbeat";

function env(overrides: Partial<Env> = {}): Env {
  return {
    ASSETS: { fetch: async () => new Response("asset") },
    GAMNACKEN_GITHUB_APP_CLIENT_ID: "skvallerbyttan",
    GAMNACKEN_GITHUB_APP_PRIVATE_KEY: "private-key",
    KROSA_MAJA_GITHUB_CLIENT_ID: "krosa",
    KROSA_MAJA_CLIENT_SECRET: "krosa-secret",
    SKVALLERBYTTAN_SESSION_SECRET: "session-secret",
    SKVALLERBYTTAN_ALLOWED_GITHUB_IDS: "36226327",
    SKVALLERBYTTAN_ORG: "Avkroken",
    ...overrides,
  };
}

function probes(value = true): RuntimeReadinessProbes {
  return {
    d1: async () => value,
    secrets: async () => value,
    github: async () => value,
    cloudflareR1: async () => value,
    cloudflareR2: async () => value,
    cloudflareR3: async () => value,
  };
}

test("runtime readiness requires all local and provider probes", async () => {
  const state = await runtimeReadiness(
    env({
      AVKROKEN_OPERATIONS: {
        postHeartbeat: async () => ({
          ok: true,
          service: "skvallerbyttan",
          receivedAt: new Date().toISOString(),
          ready: true,
        }),
      },
    }),
    probes(true),
  );

  assert.equal(state.ready, true);
  assert.deepEqual(state.checks, {
    config: true,
    d1: true,
    secrets: true,
    github: true,
    cloudflareR1: true,
    cloudflareR2: true,
    cloudflareR3: true,
  });
});

test("heartbeat is delivered even when readiness is false", async () => {
  let delivered: any = null;
  const mixed: RuntimeReadinessProbes = {
    ...probes(true),
    cloudflareR3: async () => false,
  };

  const result = await reportRuntimeHeartbeat(
    env({
      AVKROKEN_OPERATIONS: {
        postHeartbeat: async (report) => {
          delivered = report;
          return {
            ok: true,
            service: report.service,
            receivedAt: new Date().toISOString(),
            ready: report.ready,
          };
        },
      },
    }),
    mixed,
  );

  assert.equal(result.sent, true);
  assert.equal(result.ready, false);
  assert.equal(delivered.service, "skvallerbyttan");
  assert.equal(delivered.ready, false);
  assert.equal(delivered.checks.cloudflareR3, false);
});

test("missing receiver binding is not reported as a successful heartbeat", async () => {
  const result = await reportRuntimeHeartbeat(env(), probes(true));
  assert.equal(result.sent, false);
  assert.equal(result.ready, false);
  assert.equal(result.checks.config, false);
});
