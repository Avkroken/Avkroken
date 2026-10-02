import { mkdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

import { APP_THEME_APPS, APP_THEME_IDS } from "../src/app-theme-contract.js";

export const APP_ASSET_APPS = Object.fromEntries(
  APP_THEME_APPS.map((app) => [app, [...APP_THEME_IDS]]),
);

export const APP_ASSET_SOURCE_SIZE = 1254;
export const APP_ASSET_SIZES = [256, 512];
export const APP_ASSET_BUCKET = "avkroken-assets";

export async function syncAppAssets({
  workRoot,
  shouldFetch = false,
  shouldUpload = false,
  apps = APP_ASSET_APPS,
  sizes = APP_ASSET_SIZES,
  sourceSize = APP_ASSET_SOURCE_SIZE,
  bucket = APP_ASSET_BUCKET,
  wrangler,
  image,
  mkdirFn = mkdir,
  statFn = stat,
  readFileFn = readFile,
}) {
  if (shouldUpload && !shouldFetch) {
    throw new Error("--upload requires --fetch so live R2 originals are authoritative.");
  }
  if (typeof wrangler !== "function" || typeof image !== "function") {
    throw new Error("syncAppAssets requires wrangler and image adapters.");
  }

  const sourceRoot = path.join(workRoot, "source");
  const outputRoot = path.join(workRoot, "generated");

  async function fetchSource(app, theme, destination) {
    await wrangler([
      "r2", "object", "get",
      bucket + "/apps/" + app + "/" + app + "-" + theme + ".png",
      "--remote", "--file", destination,
    ]);
  }

  async function uploadVariant(key, file) {
    await wrangler([
      "r2", "object", "put", bucket + "/" + key,
      "--remote", "--file", file, "--content-type", "image/png",
    ]);
    await wrangler([
      "r2", "object", "put", bucket + "/hotlink-ok/" + key,
      "--remote", "--file", file, "--content-type", "image/png",
    ]);
  }

  async function ensureSource(app, theme) {
    const source = path.join(sourceRoot, app + "-" + theme + ".png");
    if (shouldFetch) {
      await mkdirFn(path.dirname(source), { recursive: true });
      await fetchSource(app, theme, source);
      return source;
    }
    try {
      await statFn(source);
    } catch {
      throw new Error("Source image is missing; rerun with the fetch flag.");
    }
    return source;
  }

  const generated = [];
  for (const [app, themes] of Object.entries(apps)) {
    for (const theme of themes) {
      const source = await ensureSource(app, theme);
      const sourceMeta = await image(source).metadata();
      if (sourceMeta.width !== sourceSize || sourceMeta.height !== sourceSize) {
        const sourceKey = "apps/" + app + "/" + app + "-" + theme + ".png";
        throw new Error(
          "Source " + sourceKey + " must be " + sourceSize + "×" + sourceSize
          + "; observed " + sourceMeta.width + "×" + sourceMeta.height + ".",
        );
      }

      for (const size of sizes) {
        const key = "apps/" + app + "/" + app + "-" + theme + "-" + size + ".png";
        const destination = path.join(outputRoot, key);
        await mkdirFn(path.dirname(destination), { recursive: true });
        await image(source)
          .resize(size, size, { fit: "contain", withoutEnlargement: true })
          .png()
          .toFile(destination);

        const meta = await image(destination).metadata();
        if (meta.width !== size || meta.height !== size) {
          throw new Error(
            "Generated " + key + " must be " + size + "×" + size
            + "; observed " + meta.width + "×" + meta.height + ".",
          );
        }

        const bytes = (await readFileFn(destination)).byteLength;
        generated.push({ app, theme, size, key, bytes, file: destination });
      }
    }
  }

  if (shouldUpload) {
    for (const variant of generated) {
      await uploadVariant(variant.key, variant.file);
    }
  }

  return {
    sources: Object.values(apps).reduce((sum, themes) => sum + themes.length, 0),
    generated: generated.length,
    uploadedObjects: shouldUpload ? generated.length * 2 : 0,
    sizes,
    outputRoot,
    variants: generated.map(({ file: _file, ...variant }) => variant),
  };
}
