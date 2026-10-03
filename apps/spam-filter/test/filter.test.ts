import assert from "node:assert/strict";
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
