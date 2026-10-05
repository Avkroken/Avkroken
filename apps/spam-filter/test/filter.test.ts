import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { isBlocked, parseList, senderDomain } from "../src/filter";

test("parseList normalizes comma and newline separated values", () => {
  assert.deepEqual(
    [...parseList(" One@Example.COM, two@example.com\nEXAMPLE.NET ")],
    ["one@example.com", "two@example.com", "example.net"],
  );
});

test("senderDomain extracts and normalizes domain", () => {
  assert.equal(senderDomain("User@Sub.Example.COM"), "sub.example.com");
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
    BLOCKED_SENDERS: "",
    BLOCKED_DOMAINS: "",
    REJECT_MESSAGE: "Preview message rejected by spam filter",
    SPAM_SUSPICIOUS_SCORE: "4",
    SPAM_REJECT_SCORE: "8",
    MAX_ANALYSIS_BYTES: "5242880",
    AI_MIN_SCORE: "2",
    AI_MAX_INPUT_CHARS: "8000",
    SPAM_FEEDBACK_LOCALPART: "spam",
    LEGITIMATE_FEEDBACK_LOCALPART: "notspam",
  });
  assert.deepEqual(preview?.d1_databases, [
    {
      binding: "REPUTATION_DB",
      database_name: "spam-filter-reputation-preview-eu",
      database_id: "6d74e6db-2da3-40c7-8dc6-eac95d96b755",
      migrations_dir: "migrations",
    },
  ]);
  assert.equal(config.ai?.binding, "AI");
  assert.equal(config.d1_databases?.[0]?.binding, "REPUTATION_DB");
  assert.notEqual(
    config.d1_databases?.[0]?.database_id,
    preview?.d1_databases?.[0]?.database_id,
  );
  assert.equal("addresses" in (preview ?? {}), false);
  assert.equal("secrets" in (preview ?? {}), false);
  assert.equal("services" in (preview ?? {}), false);
  assert.equal(JSON.stringify(preview).includes("denied.se"), false);
});
