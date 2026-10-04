import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { isBlocked, isNullReversePath, parseList, senderDomain } from "../src/filter";

test("parseList normalizes comma and newline separated values", () => {
  assert.deepEqual(
    [...parseList(" One@Example.COM, two@example.com\nEXAMPLE.NET ")],
    ["one@example.com", "two@example.com", "example.net"],
  );
});

test("senderDomain extracts and normalizes domain", () => {
  assert.equal(senderDomain("User@Sub.Example.COM"), "sub.example.com");
});

test("detects null reverse-path senders", () => {
  assert.equal(isNullReversePath(""), true);
  assert.equal(isNullReversePath("<>"), true);
  assert.equal(isNullReversePath("  <>  "), true);
  assert.equal(isNullReversePath("mailer-daemon@example.com"), false);
});

test("blocks exact senders", () => {
  assert.equal(
    isBlocked("SPAMMER@example.com", {
      blockedSenders: parseList("spammer@example.com"),
      blockedDomains: new Set(),
    }),
    true,
  );
});

test("blocks domains and their subdomains", () => {
  const config = {
    blockedSenders: new Set<string>(),
    blockedDomains: parseList("spam.example"),
  };

  assert.equal(isBlocked("user@spam.example", config), true);
  assert.equal(isBlocked("user@sub.spam.example", config), true);
  assert.equal(isBlocked("user@example.com", config), false);
});

test("allows sender when no rule matches", () => {
  assert.equal(
    isBlocked("user@example.com", {
      blockedSenders: parseList("other@example.com"),
      blockedDomains: parseList("blocked.example"),
    }),
    false,
  );
});

test("Worker Previews use isolated non-production mail configuration", async () => {
  const raw = await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8");
  const config = JSON.parse(raw);
  const preview = config.previews;

  assert.equal("addresses" in config, false);
  assert.deepEqual(preview?.vars, {
    MAIL_DOMAIN: "preview.invalid",
    REJECT_MESSAGE: "Preview sender is blocked",
  });
  assert.equal("addresses" in (preview ?? {}), false);
  assert.equal("BLOCKED_SENDERS" in (preview?.vars ?? {}), false);
  assert.equal("BLOCKED_DOMAINS" in (preview?.vars ?? {}), false);
  assert.equal("secrets" in (preview ?? {}), false);
  assert.equal("services" in (preview ?? {}), false);
  assert.equal(JSON.stringify(preview).includes("denied.se"), false);
});
