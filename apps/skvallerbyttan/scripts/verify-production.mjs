import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export function validateDeploymentContract(config) {
  const requiredSecrets = new Set(config?.secrets?.required ?? []);
  for (const name of [
    "GAMNACKEN_GITHUB_APP_CLIENT_ID",
    "GAMNACKEN_GITHUB_APP_PRIVATE_KEY",
    "SKVALLERBYTTAN_SESSION_SECRET",
    "SKVALLERBYTTAN_WEBHOOK_SECRET",
  ]) {
    if (!requiredSecrets.has(name)) {
      throw new Error(`${name} must be declared as a required Worker secret`);
    }
  }

  const forbiddenGitHubBindings = [
    "SKVALLERBYTTAN_GITHUB_APP_CLIENT_ID",
    "SKVALLERBYTTAN_GITHUB_APP_PRIVATE_KEY",
    "SKVALLERBYTTAN_GAMNACKE_PRIVATE_KEY",
  ];
  for (const name of forbiddenGitHubBindings) {
    if (requiredSecrets.has(name) || config?.vars?.[name] !== undefined) {
      throw new Error(`legacy Skvallerbyttan GitHub App binding must not be declared: ${name}`);
    }
  }

  const observability = config?.observability;
  if (observability?.enabled !== true) {
    throw new Error("Cloudflare observability must be enabled");
  }
  if (observability?.redact_query_string !== true) {
    throw new Error("Cloudflare observability must redact query strings before persistence");
  }

  const logs = observability?.logs;
  if (
    logs?.enabled !== true ||
    logs?.persist !== true ||
    logs?.invocation_logs !== true
  ) {
    throw new Error("Cloudflare native logs must be enabled and persisted with invocation logs");
  }

  const traces = observability?.traces;
  if (traces?.enabled !== true || traces?.persist !== true) {
    throw new Error("Cloudflare native traces must be enabled and persisted");
  }

  if ((observability?.head_sampling_rate ?? 1) > 0.1) {
    throw new Error("Cloudflare observability sampling must not exceed 10%");
  }
  if ((logs?.head_sampling_rate ?? observability?.head_sampling_rate ?? 1) > 0.1) {
    throw new Error("Cloudflare log sampling must not exceed 10%");
  }
  if ((traces?.head_sampling_rate ?? 1) > 0.01) {
    throw new Error("Cloudflare trace sampling must not exceed 1%");
  }

  const traceDestinations = traces?.destinations ?? [];
  const logDestinations = logs?.destinations ?? [];
  if (traceDestinations.length > 0 || logDestinations.length > 0) {
    throw new Error("external observability destinations are not allowed in the free-first production contract");
  }

  const crons = new Set(config?.triggers?.crons ?? []);
  if (!crons.has("*/15 * * * *")) {
    throw new Error("heartbeat cron */15 * * * * is not configured");
  }

  const operations = (config?.services ?? []).find(
    (binding) => binding?.binding === "AVKROKEN_OPERATIONS",
  );

  if (
    !operations ||
    operations.service !== "avkroken" ||
    operations.entrypoint !== "OperationalHeartbeatService"
  ) {
    throw new Error(
      "AVKROKEN_OPERATIONS must bind avkroken/OperationalHeartbeatService",
    );
  }
}

export async function verifyProductionContract() {
  const raw = await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8");
  const config = JSON.parse(raw);
  validateDeploymentContract(config);
  console.log(
    "skvallerbyttan: Cloudflare-only observability and push heartbeat contracts are configured; runtime liveness is receiver-observed",
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  verifyProductionContract().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  });
}
