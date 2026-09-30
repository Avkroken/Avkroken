import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

async function readWranglerConfig() {
  const raw = await readFile(new URL("../../../wrangler.jsonc", import.meta.url), "utf8");
  return JSON.parse(raw);
}

describe("Worker Preview contract", () => {
  it("production reuses the existing Krösa-Maja OAuth secret from Secrets Store", async () => {
    const config = await readWranglerConfig();
    expect(config.secrets_store_secrets).toContainEqual({
      binding: "GITHUB_OAUTH_CLIENT_SECRET",
      store_id: "293e79006fa649b8b182ef105a6b46d1",
      secret_name: "KROSA_MAJA_CLIENT_SECRET"
    });
  });

  it("stays fail-closed until isolated state resources are provisioned", async () => {
    const config = await readWranglerConfig();

    expect(config.previews?.d1_databases).toBeUndefined();
    expect(config.previews?.r2_buckets).toBeUndefined();
    expect(config.previews?.browser).toEqual({ binding: "BROWSER" });

    expect(config.previews?.secrets_store_secrets).toBeUndefined();
    expect(config.previews?.workflows).toBeUndefined();
    expect(config.previews?.send_email).toBeUndefined();
    expect(config.previews?.vars).toBeUndefined();
  });
});
