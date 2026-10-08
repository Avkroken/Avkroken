import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  validateLivePreflightDeploymentPlanV1,
  type LivePreflightDeploymentPlanV1,
} from "../control-plane/live-preflight-deployment-gate.ts";

/** Load the canonical live-preflight deployment plan fixture. */
async function plan(): Promise<LivePreflightDeploymentPlanV1> {
  return JSON.parse(
    await readFile(new URL("../live-preflight-deployment.v1.json", import.meta.url), "utf8"),
  ) as LivePreflightDeploymentPlanV1;
}

test("live preflight deployment plan is private, temporary and W1-bound server-side", async () => {
  const value = await plan();
  assert.deepEqual(validateLivePreflightDeploymentPlanV1(value), []);
  assert.equal(value.proxy.workerName, "events-staging-inventory-proxy");
  assert.equal(value.proxy.workersDev, false);
  assert.equal(value.proxy.previewUrls, false);
  assert.deepEqual(value.proxy.routes, []);
  assert.equal(value.proxy.accountId, "b74f8c0c6a92f3006483840cf27372fd");
  assert.deepEqual(value.proxy.secret, {
    binding: "CLOUDFLARE_API_TOKEN_W1",
    storeId: "293e79006fa649b8b182ef105a6b46d1",
    secretName: "CLOUDFLARE_API_TOKEN_W1",
  });
  assert.equal(value.operator.serviceBinding.remote, true);
  assert.equal(
    value.operator.serviceBinding.entrypoint,
    "CloudflareStagingInventoryProxyEntrypoint",
  );
  assert.equal(value.teardown.required, true);
});

test("deployment gate rejects public exposure, provider writes and staging resource bindings", async () => {
  const value = await plan();
  value.proxy.workersDev = true;
  value.proxy.previewUrls = true;
  value.proxy.routes = ["events-preflight.denied.se/*"];
  value.proxy.providerMethods = ["GET", "POST"];
  value.proxy.resourceBindings.d1 = ["EVENTS_DB"];
  value.proxy.resourceBindings.queues = ["EVENTS_QUEUE"];
  value.proxy.resourceBindings.services = ["PROD_SERVICE"];
  value.providerMutationAllowed = true;
  value.providerDestinationsMayChange = true;
  value.teardown.required = false;

  const reasons = validateLivePreflightDeploymentPlanV1(value);
  for (const fragment of [
    "proxy.workersDev",
    "proxy.previewUrls",
    "proxy.routes",
    "proxy.providerMethods",
    "proxy.resourceBindings.d1",
    "proxy.resourceBindings.queues",
    "proxy.resourceBindings.services",
    "providerMutationAllowed",
    "providerDestinationsMayChange",
    "teardown.required",
  ]) {
    assert.ok(reasons.some((reason) => reason.includes(fragment)), fragment);
  }
});

test("operator binding must target the exact temporary proxy named entrypoint remotely", async () => {
  const value = await plan();
  value.operator.serviceBinding.service = "skvallerbyttan";
  value.operator.serviceBinding.entrypoint = "default";
  value.operator.serviceBinding.remote = false;

  const reasons = validateLivePreflightDeploymentPlanV1(value);
  assert.ok(reasons.some((reason) => reason.includes("operator.serviceBinding.service")));
  assert.ok(reasons.some((reason) => reason.includes("operator.serviceBinding.entrypoint")));
  assert.ok(reasons.some((reason) => reason.includes("operator.serviceBinding.remote")));
});


test("deployment gate rejects malformed array fields without throwing", async () => {
  const value = await plan();
  const malformed = value.proxy as unknown as { routes: unknown };

  malformed.routes = "";
  assert.ok(
    validateLivePreflightDeploymentPlanV1(value).some((reason) =>
      reason.includes("proxy.routes")
    ),
  );

  malformed.routes = null;
  assert.ok(
    validateLivePreflightDeploymentPlanV1(value).some((reason) =>
      reason.includes("proxy.routes")
    ),
  );

  const malformedMethods = value.proxy as unknown as { providerMethods: unknown };
  malformedMethods.providerMethods = null;
  assert.ok(
    validateLivePreflightDeploymentPlanV1(value).some((reason) =>
      reason.includes("proxy.providerMethods")
    ),
  );
});
