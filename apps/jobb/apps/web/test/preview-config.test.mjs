import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

async function readWranglerConfig() {
  const raw = await readFile(new URL("../../../wrangler.jsonc", import.meta.url), "utf8");
  return JSON.parse(raw);
}

describe("Worker Preview contract", () => {
  it("uses isolated Preview R2 while provider side effects and D1 stay fail-closed", async () => {
    const config = await readWranglerConfig();
    const preview = JSON.stringify(config.previews ?? {});

    expect(config.previews?.d1_databases).toBeUndefined();
    expect(config.previews?.r2_buckets).toEqual([
      {
        binding: "EVIDENCE",
        bucket_name: "jobb-evidence-preview",
        jurisdiction: "eu",
      },
    ]);
    expect(config.previews?.browser).toEqual({ binding: "BROWSER" });

    expect(config.previews?.secrets_store_secrets).toBeUndefined();
    expect(config.previews?.workflows).toBeUndefined();
    expect(config.previews?.send_email).toBeUndefined();
    expect(config.previews?.vars).toBeUndefined();

    expect(preview).not.toContain('"jobb-eu"');
    expect(preview).not.toContain('"bucket_name":"jobb-evidence"');
    expect(preview).not.toContain('"jobb-automation"');
  });
});
