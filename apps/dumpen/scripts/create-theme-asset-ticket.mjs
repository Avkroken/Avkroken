import { execFile } from "node:child_process";
import { randomBytes, createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import {
  ASSET_TICKET_PREFIX,
  isThemeStagingKey,
} from "../src/asset-upload-ticket.js";

const execFileAsync = promisify(execFile);
const targetKey = process.argv[2];
if (!isThemeStagingKey(targetKey)) {
  console.error("Usage: npm run assets:ticket -- staging/themes-v2/apps/<app>/<app>-<1..7>.png");
  process.exit(2);
}

const token = randomBytes(32).toString("hex");
const digest = createHash("sha256").update(token).digest("hex");
const expiresAt = Date.now() + 15 * 60 * 1000;
const record = {
  kind: "asset-upload",
  targetKey,
  contentType: "image/png",
  expiresAt,
  maxBytes: 20 * 1024 * 1024,
};

const tempDir = await mkdtemp(path.join(os.tmpdir(), "dumpen-asset-ticket-"));
const ticketFile = path.join(tempDir, "ticket.json");
const wranglerCli = fileURLToPath(import.meta.resolve("wrangler"));

try {
  await writeFile(ticketFile, JSON.stringify(record), "utf8");
  await execFileAsync(process.execPath, [
    wranglerCli,
    "r2", "object", "put",
    `dumpen/${ASSET_TICKET_PREFIX}${digest}.json`,
    "--remote",
    "--file", ticketFile,
    "--content-type", "application/json",
  ], {
    maxBuffer: 8 * 1024 * 1024,
    env: process.env,
  });
  console.log(JSON.stringify({
    uploadUrl: `https://dumpen.denied.se/api/asset-upload/${token}`,
    targetKey,
    expiresAt: new Date(expiresAt).toISOString(),
    oneTime: true,
  }, null, 2));
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
