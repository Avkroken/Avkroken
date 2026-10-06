import assert from "node:assert/strict";
import test from "node:test";

import { validateProductionResponse } from "../scripts/verify-production.mjs";

const V2_HTML = '<section id="asset-library" data-media-library-version="2"></section>';

test("production smoke test requires Media Library v2", async () => {
  await validateProductionResponse(new Response(V2_HTML, { status: 200 }));
  await assert.rejects(
    validateProductionResponse(new Response("<html>old runtime</html>", { status: 200 })),
    /does not serve Media Library v2/,
  );
  await assert.rejects(
    validateProductionResponse(new Response("blocked", { status: 403 })),
    /expected 200/,
  );
});
