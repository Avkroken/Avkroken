import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import {
  removeGeneratedWranglerConfig,
  VALIDATION_DATABASE_ID,
  writeGeneratedWranglerConfig,
} from "./wrangler-config.ts";

const wranglerExecutable = resolve(
  process.platform === "win32" ? "node_modules/.bin/wrangler.cmd" : "node_modules/.bin/wrangler",
);
const configPath = writeGeneratedWranglerConfig(VALIDATION_DATABASE_ID);

try {
  const result = spawnSync(
    wranglerExecutable,
    ["deploy", "--dry-run", "--config", configPath],
    { encoding: "utf8", stdio: "inherit" },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Worker dry-run failed with exit code ${result.status ?? 1}`);
  }
} finally {
  removeGeneratedWranglerConfig();
}
