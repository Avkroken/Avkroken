import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

async function readWranglerConfig() {
  const raw = await readFile(new URL("../../../wrangler.jsonc", import.meta.url), "utf8");
  return JSON.parse(raw);
}

describe("Worker Preview contract", () => {
  it("auto-provisions isolated state without production credentials or automation bindings", async () => {
    const config = await readWranglerConfig();

    expect(config.previews?.d1_databases).toEqual([{ binding: "DB" }]);
    expect(config.previews?.r2_buckets).toEqual([{ binding: "EVIDENCE" }]);
    expect(config.previews?.browser).toEqual({ binding: "BROWSER" });

    expect(config.previews?.secrets_store_secrets).toBeUndefined();
    expect(config.previews?.workflows).toBeUndefined();
    expect(config.previews?.send_email).toBeUndefined();
    expect(config.previews?.vars).toBeUndefined();
  });
});
