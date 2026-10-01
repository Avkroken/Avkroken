import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import sharp from "sharp";

import { syncAppAssets } from "./app-assets-sync.mjs";

const execFileAsync = promisify(execFile);
const args = new Set(process.argv.slice(2));
const shouldFetch = args.has("--fetch");
const shouldUpload = args.has("--upload");
const workRoot = path.resolve(process.env.DUMPEN_ASSET_WORK || ".asset-work");

async function wrangler(wranglerArgs) {
  const bin = process.platform === "win32"
    ? path.resolve("node_modules/.bin/wrangler.cmd")
    : path.resolve("node_modules/.bin/wrangler");
  return execFileAsync(bin, wranglerArgs, {
    maxBuffer: 8 * 1024 * 1024,
    env: process.env,
  });
}

const result = await syncAppAssets({
  workRoot,
  shouldFetch,
  shouldUpload,
  wrangler,
  image: sharp,
});

console.log(JSON.stringify({
  sources: result.sources,
  generated: result.generated,
  uploadedObjects: result.uploadedObjects,
  sizes: result.sizes,
  outputRoot: result.outputRoot,
}, null, 2));
