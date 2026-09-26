import test from "node:test";
import assert from "node:assert/strict";
import {
  validateDeploymentContract,
  verifyProductionContract,
} from "../scripts/verify-production.mjs";

function config() {
  return {
    secrets: {
      required: [
        "GAMNACKEN_GITHUB_APP_CLIENT_ID",
        "GAMNACKEN_GITHUB_APP_PRIVATE_KEY",
        "SKVALLERBYTTAN_SESSION_SECRET",
        "SKVALLERBYTTAN_WEBHOOK_SECRET",
      ],
    },
    observability: {
      enabled: true,
      head_sampling_rate: 0.1,
      redact_query_string: true,
      traces: {
        enabled: true,
        head_sampling_rate: 0.01,
        persist: true,
      },
      logs: {
        enabled: true,
        head_sampling_rate: 0.1,
        invocation_logs: true,
        persist: true,
      },
    },
    triggers: { crons: ["0 */6 * * *", "*/15 * * * *"] },
    services: [
      {
        binding: "AVKROKEN_OPERATIONS",
        service: "avkroken",
        entrypoint: "OperationalHeartbeatService",
      },
    ],
  };
}

test("accepts Cloudflare-only observability and push heartbeat deployment contract", () => {
  assert.doesNotThrow(() => validateDeploymentContract(config()));
});

test("rejects disabled telemetry query redaction", () => {
  const value = config();
  value.observability.redact_query_string = false;
  assert.throws(
    () => validateDeploymentContract(value),
    /redact query strings/,
  );
});

test("rejects external trace destinations", () => {
  const value = config();
  value.observability.traces.destinations = ["external-traces"];
  assert.throws(
    () => validateDeploymentContract(value),
    /external observability destinations/,
  );
});

test("rejects external log destinations", () => {
  const value = config();
  value.observability.logs.destinations = ["external-logs"];
  assert.throws(
    () => validateDeploymentContract(value),
    /external observability destinations/,
  );
});

test("rejects trace sampling above one percent", () => {
  const value = config();
  value.observability.traces.head_sampling_rate = 0.1;
  assert.throws(
    () => validateDeploymentContract(value),
    /trace sampling/,
  );
});

test("rejects log sampling above ten percent", () => {
  const value = config();
  value.observability.logs.head_sampling_rate = 1;
  assert.throws(
    () => validateDeploymentContract(value),
    /log sampling/,
  );
});

test("rejects missing Gamnacken GitHub App private-key binding", () => {
  const value = config();
  value.secrets.required = value.secrets.required.filter(
    (name) => name !== "GAMNACKEN_GITHUB_APP_PRIVATE_KEY",
  );
  assert.throws(
    () => validateDeploymentContract(value),
    /GAMNACKEN_GITHUB_APP_PRIVATE_KEY/,
  );
});

test("rejects missing Gamnacken GitHub App client-id binding", () => {
  const value = config();
  value.secrets.required = value.secrets.required.filter(
    (name) => name !== "GAMNACKEN_GITHUB_APP_CLIENT_ID",
  );
  assert.throws(
    () => validateDeploymentContract(value),
    /GAMNACKEN_GITHUB_APP_CLIENT_ID/,
  );
});

test("rejects legacy Skvallerbyttan GitHub App bindings", () => {
  const value = config();
  value.secrets.required.push("SKVALLERBYTTAN_GITHUB_APP_PRIVATE_KEY");
  assert.throws(
    () => validateDeploymentContract(value),
    /legacy Skvallerbyttan GitHub App binding/,
  );
});

test("rejects missing heartbeat cron", () => {
  const value = config();
  value.triggers.crons = ["0 */6 * * *"];
  assert.throws(
    () => validateDeploymentContract(value),
    /heartbeat cron/,
  );
});

test("rejects the wrong receiver entrypoint", () => {
  const value = config();
  value.services[0].entrypoint = "DocsInvalidationService";
  assert.throws(
    () => validateDeploymentContract(value),
    /AVKROKEN_OPERATIONS/,
  );
});

test("repository wrangler config satisfies the deployment contract", async () => {
  await verifyProductionContract();
});


test("repository Preview config uses isolated state and no production provider bindings", async () => {
  const raw = await import("node:fs/promises").then(({ readFile }) =>
    readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8")
  );
  const value = JSON.parse(raw);

  assert.deepEqual(value.previews?.d1_databases, [{ binding: "STATS_DB" }]);
  assert.deepEqual(value.previews?.analytics_engine_datasets, [
    { binding: "OBSERVABILITY", dataset: "skvallerbyttan_preview" }
  ]);
  assert.equal(value.previews?.vars?.SKVALLERBYTTAN_GITHUB_OWNER, "blixten85");
  assert.equal(value.previews?.services, undefined);
  assert.equal(value.previews?.secrets_store_secrets, undefined);
  assert.equal(value.previews?.CLOUDFLARE_ACCOUNT_ID, undefined);
});
