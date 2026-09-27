import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Workers Builds deployment", () => {
  it("owns Jobb production deployment without GitHub Cloudflare secrets", () => {
    const workflow = new URL("../../../../../.github/workflows/deploy-jobb.yml", import.meta.url);
    expect(existsSync(workflow)).toBe(false);

    const pkg = JSON.parse(readFileSync(new URL("../../../package.json", import.meta.url), "utf8"));
    expect(pkg.scripts["deploy:workers-builds"]).toBe("node scripts/workers-build-production.mjs");

    const script = readFileSync(new URL("../../../scripts/workers-build-production.mjs", import.meta.url), "utf8");
    expect(script).toMatch(/WORKERS_CI !== "1"/);
    expect(script).toMatch(/WORKERS_CI_BRANCH !== "main"/);
    expect(script).not.toMatch(/CLOUDFLARE_API_TOKEN_W1|secrets\./);

    const typecheck = script.indexOf('run("pnpm", ["typecheck"])');
    const test = script.indexOf('run("pnpm", ["test"])');
    const deploy = script.indexOf('run("pnpm", ["deploy:cloudflare"])');
    expect(typecheck).toBeGreaterThanOrEqual(0);
    expect(test).toBeGreaterThan(typecheck);
    expect(deploy).toBeGreaterThan(test);
  });
});
