import { execFile } from "node:child_process";
import { mkdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import sharp from "sharp";

const execFileAsync = promisify(execFile);
const APPS = {
  dozzle: [1, 2, 3, 4, 5, 6],
  maintainerr: [1, 2, 3],
  plex: [1, 2, 3],
  prowlarr: [1, 2, 3],
  qbittorrent: [1, 2, 3],
  radarr: [1, 2, 3, 4, 5, 6, 7],
  sonarr: [1, 2, 3],
  tautulli: [1, 2, 3],
};
const SOURCE_SIZE = 1254;
const SIZES = [256, 512];
const BUCKET = "avkroken-assets";
const args = new Set(process.argv.slice(2));
const shouldFetch = args.has("--fetch");
const shouldUpload = args.has("--upload");
if (shouldUpload && !shouldFetch) {
  throw new Error("--upload requires --fetch so live R2 originals are authoritative.");
}
const workRoot = path.resolve(process.env.DUMPEN_ASSET_WORK || ".asset-work");
const sourceRoot = path.join(workRoot, "source");
const outputRoot = path.join(workRoot, "generated");
async function wrangler(...wranglerArgs) {
  const bin = process.platform === "win32"
    ? path.resolve("node_modules/.bin/wrangler.cmd")
    : path.resolve("node_modules/.bin/wrangler");
  return execFileAsync(bin, wranglerArgs, {
    maxBuffer: 8 * 1024 * 1024,
    env: process.env,
  });
}

async function fetchSource(app, theme, destination) {
  const objectPath = BUCKET + "/apps/" + app + "/" + app + "-" + theme + ".png";
  await wrangler("r2", "object", "get", objectPath, "--remote", "--file", destination);
}

async function uploadVariant(key, file) {
  await wrangler(
    "r2", "object", "put", BUCKET + "/" + key,
    "--remote", "--file", file, "--content-type", "image/png",
  );
  await wrangler(
    "r2", "object", "put", BUCKET + "/hotlink-ok/" + key,
    "--remote", "--file", file, "--content-type", "image/png",
  );
}
async function ensureSource(app, theme) {
  const source = path.join(sourceRoot, app + "-" + theme + ".png");
  if (shouldFetch) {
    await mkdir(path.dirname(source), { recursive: true });
    await fetchSource(app, theme, source);
    return source;
  }
  try {
    await stat(source);
  } catch {
    throw new Error("Source image is missing; rerun with the fetch flag.");
  }
  return source;
}

const generated = [];
for (const [app, themes] of Object.entries(APPS)) {
  for (const theme of themes) {
    const source = await ensureSource(app, theme);
    const sourceMeta = await sharp(source).metadata();
    if (sourceMeta.width !== SOURCE_SIZE || sourceMeta.height !== SOURCE_SIZE) {
      throw new Error("Source image must be " + SOURCE_SIZE + "×" + SOURCE_SIZE + ".");
    }
    for (const size of SIZES) {
      const key = "apps/" + app + "/" + app + "-" + theme + "-" + size + ".png";
      const destination = path.join(outputRoot, key);
      await mkdir(path.dirname(destination), { recursive: true });
      await sharp(source)
        .resize(size, size, { fit: "contain", withoutEnlargement: true })
        .png()
        .toFile(destination);
      const meta = await sharp(destination).metadata();
      if (meta.width !== size || meta.height !== size) {
        throw new Error("Generated image has unexpected dimensions.");
      }
      const bytes = (await readFile(destination)).byteLength;
      generated.push({ app, theme, size, key, bytes });
      if (shouldUpload) await uploadVariant(key, destination);
    }
  }
}

console.log(JSON.stringify({
  sources: Object.values(APPS).reduce((sum, themes) => sum + themes.length, 0),
  generated: generated.length,
  uploadedObjects: shouldUpload ? generated.length * 2 : 0,
  sizes: SIZES,
  outputRoot,
}, null, 2));
