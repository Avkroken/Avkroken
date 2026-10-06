#!/usr/bin/env node
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

function run(command, args, { env = process.env, capture = false } = {}) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env,
    stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit",
    encoding: "utf8",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}`);
  }
  return capture ? String(result.stdout || "") : "";
}

export function deployedVersionId(ndjson) {
  let versionId = null;
  for (const rawLine of String(ndjson || "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    if (entry?.type === "deploy" && entry.version_id) {
      versionId = String(entry.version_id);
    }
  }
  if (!versionId) throw new Error("Wrangler deploy output did not contain a version_id");
  return versionId;
}

function versionArray(value, depth = 0) {
  if (!value || depth > 4) return null;
  if (Array.isArray(value?.versions)) return value.versions;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = versionArray(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (typeof value === "object") {
    for (const key of ["deployment", "result", "data"]) {
      const found = versionArray(value[key], depth + 1);
      if (found) return found;
    }
  }
  return null;
}

export function activeDeploymentVersions(status) {
  const parsed = typeof status === "string" ? JSON.parse(status) : status;
  const versions = versionArray(parsed);
  if (!versions?.length) {
    throw new Error("Wrangler deployment status did not contain active versions");
  }
  return versions.map((version) => ({
    versionId: String(version?.version_id || ""),
    percentage: Number(version?.percentage),
  }));
}

export function deploymentIsActive(status, versionId) {
  return activeDeploymentVersions(status).some(
    (version) => version.versionId === versionId && version.percentage >= 99.99,
  );
}

export function main(env = process.env) {
  if (env.WORKERS_CI !== "1") {
    throw new Error("deploy:workers-builds may only run inside Cloudflare Workers Builds");
  }
  if (env.WORKERS_CI_BRANCH !== "main") {
    console.log(
      `Skipping Dumpen production deployment for non-main branch ${env.WORKERS_CI_BRANCH || "<unset>"}.`,
    );
    return;
  }

  run("npm", ["run", "check"], { env });

  const dir = mkdtempSync(join(tmpdir(), "dumpen-wrangler-"));
  const outputPath = join(dir, "deploy.ndjson");
  try {
    run("npm", ["run", "deploy"], {
      env: { ...env, WRANGLER_OUTPUT_FILE_PATH: outputPath },
    });
    const versionId = deployedVersionId(readFileSync(outputPath, "utf8"));
    const status = run("npx", ["wrangler", "deployments", "status", "--json"], {
      env,
      capture: true,
    });
    if (!deploymentIsActive(status, versionId)) {
      throw new Error(`Dumpen deployed version ${versionId} is not active at 100% production traffic`);
    }
    console.log(`dumpen: verified active production version ${versionId}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
