import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

async function readWranglerConfig() {
  const raw = await readFile(new URL("../../../wrangler.jsonc", import.meta.url), "utf8");
  return JSON.parse(raw);
}

describe("Worker Preview contract", () => {
  it("binds isolated Preview storage while provider side effects stay fail-closed", async () => {
    const config = await readWranglerConfig();
    const preview = JSON.stringify(config.previews ?? {});

    expect(config.previews?.d1_databases).toEqual([
      {
        binding: "DB",
        database_name: "jobb-preview-eu",
        database_id: "c3a0b24f-b896-4f36-9058-c04f473d27a4",
        migrations_dir: "migrations",
      },
    ]);
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

    expect(preview).not.toContain('"database_name":"jobb-eu"');
    expect(preview).not.toContain('"bucket_name":"jobb-evidence"');
    expect(preview).not.toContain('"jobb-automation"');
  });
});
