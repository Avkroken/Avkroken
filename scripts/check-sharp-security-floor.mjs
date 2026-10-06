import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const npmApps = new Set(["portal", "dumpen", "spam-filter", "skvallerbyttan"]);
const supported = new Set([...npmApps, "jobb"]);
const requested = process.argv.slice(2);
const apps = requested.length ? requested : [...supported];

for (const app of apps) {
  if (!supported.has(app)) throw new Error(`Unknown app: ${app}`);
}

function versionAtLeast(actual, floor) {
  const a = actual.split(".").map(Number);
  const b = floor.split(".").map(Number);
  for (let i = 0; i < 3; i += 1) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (av !== bv) return av > bv;
  }
  return true;
}

async function checkNpmApp(app) {
  const packageJson = JSON.parse(await readFile(new URL(`../apps/${app}/package.json`, import.meta.url), "utf8"));
  const lock = JSON.parse(await readFile(new URL(`../apps/${app}/package-lock.json`, import.meta.url), "utf8"));

  assert.equal(
    packageJson.overrides?.["sharp@<0.35.5"],
    "0.35.5",
    `${app}: missing temporary sharp security override`,
  );

  const packages = Object.entries(lock.packages ?? {});
  const sharp = packages.filter(([path]) => path === "node_modules/sharp" || path.endsWith("/node_modules/sharp"));
  assert.ok(sharp.length > 0, `${app}: lockfile does not contain sharp`);

  for (const [path, metadata] of sharp) {
    assert.ok(
      versionAtLeast(metadata.version ?? "0.0.0", "0.35.5"),
      `${app}: ${path} resolved below sharp 0.35.5 (${metadata.version})`,
    );
  }

  for (const [path, metadata] of packages) {
    if (!path.includes("node_modules/@img/sharp-")) continue;
    const floor = path.includes("/sharp-libvips-") ? "1.3.4" : "0.35.5";
    assert.ok(
      versionAtLeast(metadata.version ?? "0.0.0", floor),
      `${app}: ${path} resolved below ${floor} (${metadata.version})`,
    );
  }
}

async function checkJobb() {
  const workspace = await readFile(new URL("../apps/jobb/pnpm-workspace.yaml", import.meta.url), "utf8");
  const lock = await readFile(new URL("../apps/jobb/pnpm-lock.yaml", import.meta.url), "utf8");

  assert.match(workspace, /'sharp@<0\.35\.5': 0\.35\.5/, "jobb: workspace sharp override missing");
  assert.match(lock, /sharp@<0\.35\.5: 0\.35\.5/, "jobb: lockfile sharp override missing");
  assert.doesNotMatch(lock, /sharp@0\.35\.4/, "jobb: vulnerable sharp 0.35.4 remains in lockfile");
  assert.doesNotMatch(lock, /@img\/sharp-[^\n]*@0\.35\.4/, "jobb: vulnerable @img/sharp 0.35.4 remains");
  assert.doesNotMatch(lock, /@img\/sharp-libvips-[^\n]*@1\.3\.3/, "jobb: stale libvips 1.3.3 remains");
  const miniflareSharpVersions = [
    ...lock.matchAll(/^  miniflare@[^\n]+:\n(?: {4}.*\n)*? {6}sharp: ([0-9]+\.[0-9]+\.[0-9]+)/gm),
  ].map((match) => match[1]);

  assert.ok(miniflareSharpVersions.length > 0, "jobb: no Miniflare snapshot with a sharp dependency found");
  for (const version of miniflareSharpVersions) {
    assert.ok(
      versionAtLeast(version, "0.35.5"),
      `jobb: Miniflare resolves sharp below 0.35.5 (${version})`,
    );
  }
}

for (const app of apps) {
  if (npmApps.has(app)) await checkNpmApp(app);
  else await checkJobb();
}

console.log(`Sharp security floor OK: ${apps.join(", ")}`);
