export type LivePreflightDeploymentPlanV1 = {
  schemaVersion: number;
  status: "planned";
  proxy: {
    workerName: string;
    main: string;
    compatibilityDate: string;
    accountId: string;
    workersDev: boolean;
    previewUrls: boolean;
    routes: string[];
    secret: {
      binding: string;
      storeId: string;
      secretName: string;
    };
    providerMethods: string[];
    resourceBindings: {
      d1: string[];
      queues: string[];
      kv: string[];
      r2: string[];
      services: string[];
    };
  };
  operator: {
    mode: string;
    serviceBinding: {
      binding: string;
      service: string;
      entrypoint: string;
      remote: boolean;
    };
  };
  providerMutationAllowed: boolean;
  providerDestinationsMayChange: boolean;
  teardown: {
    required: boolean;
    deleteProxyWorker: boolean;
    verifyNoRoutes: boolean;
    verifyNoResidualBindings: boolean;
  };
};

function addReason(reasons: string[], reason: string): void {
  if (!reasons.includes(reason)) reasons.push(reason);
}

function requireEqual(
  actual: unknown,
  expected: unknown,
  field: string,
  reasons: string[],
): void {
  if (actual !== expected) addReason(reasons, `${field} must equal ${String(expected)}`);
}

function requireEmpty(
  value: readonly unknown[],
  field: string,
  reasons: string[],
): void {
  if (value.length !== 0) addReason(reasons, `${field} must be empty`);
}

export function validateLivePreflightDeploymentPlanV1(
  plan: LivePreflightDeploymentPlanV1,
): string[] {
  const reasons: string[] = [];

  requireEqual(plan.schemaVersion, 1, "schemaVersion", reasons);
  requireEqual(plan.status, "planned", "status", reasons);

  requireEqual(
    plan.proxy.workerName,
    "events-staging-inventory-proxy",
    "proxy.workerName",
    reasons,
  );
  requireEqual(
    plan.proxy.main,
    "control-plane/cloudflare-staging-inventory-proxy-entrypoint.ts",
    "proxy.main",
    reasons,
  );
  requireEqual(
    plan.proxy.compatibilityDate,
    "2026-10-08",
    "proxy.compatibilityDate",
    reasons,
  );
  requireEqual(
    plan.proxy.accountId,
    "b74f8c0c6a92f3006483840cf27372fd",
    "proxy.accountId",
    reasons,
  );
  requireEqual(plan.proxy.workersDev, false, "proxy.workersDev", reasons);
  requireEqual(plan.proxy.previewUrls, false, "proxy.previewUrls", reasons);
  requireEmpty(plan.proxy.routes, "proxy.routes", reasons);

  requireEqual(
    plan.proxy.secret.binding,
    "CLOUDFLARE_API_TOKEN_W1",
    "proxy.secret.binding",
    reasons,
  );
  requireEqual(
    plan.proxy.secret.storeId,
    "293e79006fa649b8b182ef105a6b46d1",
    "proxy.secret.storeId",
    reasons,
  );
  requireEqual(
    plan.proxy.secret.secretName,
    "CLOUDFLARE_API_TOKEN_W1",
    "proxy.secret.secretName",
    reasons,
  );

  if (
    plan.proxy.providerMethods.length !== 1
    || plan.proxy.providerMethods[0] !== "GET"
  ) {
    addReason(reasons, "proxy.providerMethods must contain only GET");
  }

  requireEmpty(plan.proxy.resourceBindings.d1, "proxy.resourceBindings.d1", reasons);
  requireEmpty(
    plan.proxy.resourceBindings.queues,
    "proxy.resourceBindings.queues",
    reasons,
  );
  requireEmpty(plan.proxy.resourceBindings.kv, "proxy.resourceBindings.kv", reasons);
  requireEmpty(plan.proxy.resourceBindings.r2, "proxy.resourceBindings.r2", reasons);
  requireEmpty(
    plan.proxy.resourceBindings.services,
    "proxy.resourceBindings.services",
    reasons,
  );

  requireEqual(
    plan.operator.mode,
    "local_remote_service_binding",
    "operator.mode",
    reasons,
  );
  requireEqual(
    plan.operator.serviceBinding.binding,
    "CLOUDFLARE_STAGING_INVENTORY",
    "operator.serviceBinding.binding",
    reasons,
  );
  requireEqual(
    plan.operator.serviceBinding.service,
    plan.proxy.workerName,
    "operator.serviceBinding.service",
    reasons,
  );
  requireEqual(
    plan.operator.serviceBinding.entrypoint,
    "CloudflareStagingInventoryProxyEntrypoint",
    "operator.serviceBinding.entrypoint",
    reasons,
  );
  requireEqual(
    plan.operator.serviceBinding.remote,
    true,
    "operator.serviceBinding.remote",
    reasons,
  );

  requireEqual(
    plan.providerMutationAllowed,
    false,
    "providerMutationAllowed",
    reasons,
  );
  requireEqual(
    plan.providerDestinationsMayChange,
    false,
    "providerDestinationsMayChange",
    reasons,
  );

  requireEqual(plan.teardown.required, true, "teardown.required", reasons);
  requireEqual(
    plan.teardown.deleteProxyWorker,
    true,
    "teardown.deleteProxyWorker",
    reasons,
  );
  requireEqual(
    plan.teardown.verifyNoRoutes,
    true,
    "teardown.verifyNoRoutes",
    reasons,
  );
  requireEqual(
    plan.teardown.verifyNoResidualBindings,
    true,
    "teardown.verifyNoResidualBindings",
    reasons,
  );

  return reasons;
}
