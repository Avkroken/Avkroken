import assert from "node:assert/strict";
import test from "node:test";
import { analyzeEmail, type EmailView } from "../src/analyzer";

const thresholds = { suspicious: 4, reject: 8 };

function email(overrides: Partial<EmailView> = {}): EmailView {
  return {
    subject: "Normal message",
    text: "Hello, this is a normal message.",
    headers: [],
    attachments: [],
    fromAddress: "sender@example.com",
    replyToAddresses: [],
    ...overrides,
  };
}

test("clean mail remains clean", () => {
  assert.deepEqual(analyzeEmail(email(), "sender@example.com", thresholds), {
    score: 0,
    verdict: "clean",
    reasons: [],
  });
});

test("authentication failures contribute strongly to spam score", () => {
  const result = analyzeEmail(
    email({
      headers: [
        {
          key: "authentication-results",
          value: "mx.example; dmarc=fail; spf=fail; dkim=fail",
        },
      ],
    }),
    "sender@example.com",
    thresholds,
  );

  assert.equal(result.score, 8);
  assert.equal(result.verdict, "spam");
  assert.deepEqual(result.reasons, ["dmarc_fail", "spf_fail", "dkim_fail"]);
});

test("dangerous executable attachments are rejected by score", () => {
  const result = analyzeEmail(
    email({
      attachments: [
        {
          filename: "invoice.exe",
          mimeType: "application/x-msdownload",
        },
      ],
    }),
    "sender@example.com",
    thresholds,
  );

  assert.equal(result.score, 8);
  assert.equal(result.verdict, "spam");
  assert.ok(result.reasons.includes("executable_attachment"));
});

test("a single marketing phrase does not reject legitimate bulk mail", () => {
  const result = analyzeEmail(
    email({
      subject: "Limited time offer",
      headers: [
        {
          key: "list-unsubscribe",
          value: "<https://example.com/unsubscribe>",
        },
      ],
    }),
    "sender@example.com",
    thresholds,
  );

  assert.equal(result.score, 1);
  assert.equal(result.verdict, "clean");
});

test("multiple independent phishing signals cross the reject threshold", () => {
  const result = analyzeEmail(
    email({
      subject: "URGENT!!! Verify your account",
      text: "Confirm your password now and click here.",
      html:
        '<form action="https://198.51.100.42/login">' +
        '<a href="https://198.51.100.42/login">continue</a></form>',
      fromAddress: "security@example.com",
      replyToAddresses: ["reply@different.example"],
    }),
    "bounce@mailer.example.net",
    thresholds,
  );

  assert.equal(result.verdict, "spam");
  assert.ok(result.score >= 8);
  assert.ok(result.reasons.includes("html_form"));
  assert.ok(result.reasons.includes("url_ip_host"));
  assert.ok(result.reasons.includes("reply_to_mismatch"));
});

test("lower-confidence mail is marked suspicious instead of rejected", () => {
  const result = analyzeEmail(
    email({
      subject: "Verify your account",
      html: '<iframe src="https://example.com"></iframe>',
    }),
    "sender@example.com",
    thresholds,
  );

  assert.equal(result.score, 4);
  assert.equal(result.verdict, "suspicious");
});

test("punycode and URL userinfo are detected without exposing the URL in reasons", () => {
  const result = analyzeEmail(
    email({
      text: "See https://user@example.com@xn--exmple-cua.test/path",
    }),
    "sender@example.com",
    thresholds,
  );

  assert.equal(result.verdict, "suspicious");
  assert.ok(result.reasons.includes("url_punycode"));
  assert.ok(result.reasons.includes("url_userinfo"));
  assert.equal(result.reasons.some((reason) => reason.includes("http")), false);
});

test("a reply-to on the same domain family is not penalized", () => {
  const result = analyzeEmail(
    email({
      fromAddress: "alerts@example.com",
      replyToAddresses: ["support@mail.example.com"],
    }),
    "bounce@mail.example.com",
    thresholds,
  );

  assert.equal(result.score, 0);
  assert.equal(result.verdict, "clean");
});
