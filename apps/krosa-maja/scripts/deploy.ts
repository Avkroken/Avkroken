import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import {
  D1_BINDING,
  D1_DATABASE_NAME,
  parseD1ListJson,
  removeGeneratedWranglerConfig,
  selectDatabaseId,
  writeGeneratedWranglerConfig,
} from "./wrangler-config.ts";

const wranglerExecutable = resolve(
  process.platform === "win32" ? "node_modules/.bin/wrangler.cmd" : "node_modules/.bin/wrangler",
);

interface RunOptions {
  captureStdout?: boolean;
  allowFailure?: boolean;
}

interface RunResult {
  status: number;
  stdout: string;
}

function runWrangler(args: readonly string[], options: RunOptions = {}): RunResult {
  const result = spawnSync(wranglerExecutable, [...args], {
    encoding: "utf8",
    stdio: options.captureStdout ? ["ignore", "pipe", "inherit"] : "inherit",
  });

  if (result.error) throw result.error;
  const status = result.status ?? 1;
  if (status !== 0 && !options.allowFailure) {
    throw new Error(`wrangler ${args.join(" ")} failed with exit code ${status}`);
  }
  return {
    status,
    stdout: typeof result.stdout === "string" ? result.stdout : "",
  };
}

function listDatabaseId(): string | null {
  const output = runWrangler(["d1", "list", "--json"], { captureStdout: true }).stdout;
  return selectDatabaseId(parseD1ListJson(output));
}

function ensureDatabaseId(): string {
  const existing = listDatabaseId();
  if (existing) {
    console.log(`Using existing D1 database ${D1_DATABASE_NAME}`);
    return existing;
  }

  console.log(`Creating D1 database ${D1_DATABASE_NAME}`);
  const created = runWrangler(["d1", "create", D1_DATABASE_NAME], { allowFailure: true });
  if (created.status !== 0) {
    console.warn("D1 creation command did not succeed; checking whether another deployment created it concurrently");
  }

  const afterCreate = listDatabaseId();
  if (!afterCreate) {
    throw new Error(`D1 database ${D1_DATABASE_NAME} was not found after creation attempt`);
  }
  return afterCreate;
}

const databaseId = ensureDatabaseId();
const configPath = writeGeneratedWranglerConfig(databaseId);

try {
  console.log(`Applying D1 migrations to ${D1_DATABASE_NAME} before Worker activation`);
  runWrangler([
    "d1",
    "migrations",
    "apply",
    D1_BINDING,
    "--remote",
    "--config",
    configPath,
  ]);

  console.log("Deploying Krösa-Maja");
  runWrangler(["deploy", "--config", configPath]);
} finally {
  removeGeneratedWranglerConfig();
}
