import test from "node:test";
import assert from "node:assert/strict";
import {
  distributionEndpoints,
  normalizeInstallableManifest
} from "../src/distribution-source.mjs";

const project = {
  independentProduct: true,
  url: "https://produkter.denied.se/"
};

test("distribution endpoints are bounded to independent denied.se HTTPS projects", () => {
  assert.deepEqual(distributionEndpoints(project), {
    origin: "https://produkter.denied.se",
    manifestUrl: "https://produkter.denied.se/site.webmanifest",
    serviceWorkerUrl: "https://produkter.denied.se/service-worker.js"
  });
  assert.equal(distributionEndpoints({ independentProduct: false, url: project.url }), null);
  assert.equal(distributionEndpoints({ independentProduct: true, url: "https://example.com/" }), null);
  assert.equal(distributionEndpoints({ independentProduct: true, url: "http://produkter.denied.se/" }), null);
});

test("installable manifest requires standalone-like display, same-origin scope and 192/512 icons", () => {
  assert.deepEqual(normalizeInstallableManifest({
    start_url: "/",
    scope: "/",
    display: "standalone",
    icons: [{ sizes: "192x192" }, { sizes: "512x512" }]
  }, "https://produkter.denied.se"), {
    display: "standalone",
    startUrl: "https://produkter.denied.se/",
    scope: "https://produkter.denied.se/",
    iconSizes: ["192x192", "512x512"],
    storeLinks: []
  });

  assert.equal(normalizeInstallableManifest({
    start_url: "/",
    scope: "/",
    display: "browser",
    icons: [{ sizes: "192x192" }, { sizes: "512x512" }]
  }, "https://produkter.denied.se"), null);

  assert.equal(normalizeInstallableManifest({
    start_url: "https://evil.example/",
    scope: "/",
    display: "standalone",
    icons: [{ sizes: "192x192" }, { sizes: "512x512" }]
  }, "https://produkter.denied.se"), null);
});

test("related applications expose only verified Apple, Google and Microsoft Store URLs", () => {
  const normalized = normalizeInstallableManifest({
    start_url: "/",
    scope: "/",
    display: "standalone",
    icons: [{ sizes: "192x192" }, { sizes: "512x512" }],
    related_applications: [
      { platform: "itunes", url: "https://apps.apple.com/se/app/example/id123" },
      { platform: "play", url: "https://play.google.com/store/apps/details?id=se.denied.example" },
      { platform: "windows", url: "https://apps.microsoft.com/detail/example" },
      { platform: "other", url: "https://downloads.example.com/app" },
      { platform: "play", url: "http://play.google.com/store/apps/details?id=unsafe" }
    ]
  }, "https://produkter.denied.se");

  assert.deepEqual(normalized.storeLinks, [
    { label: "App Store", url: "https://apps.apple.com/se/app/example/id123" },
    { label: "Google Play", url: "https://play.google.com/store/apps/details?id=se.denied.example" },
    { label: "Microsoft Store", url: "https://apps.microsoft.com/detail/example" }
  ]);
});
