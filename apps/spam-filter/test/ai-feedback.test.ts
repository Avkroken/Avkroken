import assert from "node:assert/strict";
import test from "node:test";
import { aiAdjustment, classifyWithAi, shouldUseAi } from "../src/ai";
import {
  extractAttachedOriginal,
  extractInlineForwardedSender,
  feedbackLabelForRecipient,
  isAuthorizedFeedbackSender,
} from "../src/feedback";
import {
  EMPTY_REPUTATION,
  reputationAdjustment,
  type Reputation,
} from "../src/reputation";
import type { Email } from "postal-mime";

test("AI adjustments are bounded and deterministic", () => {
  assert.equal(aiAdjustment("phishing", 0.95), 5);
  assert.equal(aiAdjustment("spam", 0.8), 3);
  assert.equal(aiAdjustment("suspicious", 0.8), 2);
  assert.equal(aiAdjustment("bulk", 0.9), 1);
  assert.equal(aiAdjustment("legitimate", 0.95), -2);
  assert.equal(aiAdjustment("legitimate", 0.5), 0);
});

test("AI is used for the grey zone", () => {
  assert.equal(shouldUseAi(1, 2, EMPTY_REPUTATION), false);
  assert.equal(shouldUseAi(2, 2, EMPTY_REPUTATION), true);
});

test("prior user spam feedback forces AI re-review", () => {
  const reputation: Reputation = {
    ...EMPTY_REPUTATION,
    userSpamCount: 1,
  };

  assert.equal(shouldUseAi(0, 2, reputation), true);
  assert.equal(reputationAdjustment(reputation), 3);
});

test("user reputation is capped in both directions", () => {
  assert.equal(
    reputationAdjustment({
      ...EMPTY_REPUTATION,
      userSpamCount: 10,
    }),
    6,
  );
  assert.equal(
    reputationAdjustment({
      ...EMPTY_REPUTATION,
      userLegitimateCount: 10,
    }),
    -2,
  );
});

test("feedback aliases are explicit recipients", () => {
  assert.equal(
    feedbackLabelForRecipient(
      "spam@denied.se",
      "denied.se",
      "spam",
      "notspam",
    ),
    "spam",
  );
  assert.equal(
    feedbackLabelForRecipient(
      "notspam@denied.se",
      "denied.se",
      "spam",
      "notspam",
    ),
    "legitimate",
  );
  assert.equal(
    feedbackLabelForRecipient(
      "other@denied.se",
      "denied.se",
      "spam",
      "notspam",
    ),
    null,
  );
});

test("only the forwarding mailbox is authorized to submit feedback", () => {
  assert.equal(
    isAuthorizedFeedbackSender("User@Example.com", "user@example.com"),
    true,
  );
  assert.equal(
    isAuthorizedFeedbackSender("attacker@example.net", "user@example.com"),
    false,
  );
});

test("feedback can extract an attached original .eml", async () => {
  const outer = {
    attachments: [
      {
        filename: "original.eml",
        mimeType: "message/rfc822",
        disposition: "attachment",
        content:
          "From: Sender <sender@example.com>\r\n" +
          "To: user@example.net\r\n" +
          "Subject: Original\r\n" +
          "\r\n" +
          "Hello",
      },
    ],
  } as unknown as Email;

  const original = await extractAttachedOriginal(outer);
  assert.equal(original?.subject, "Original");
  assert.equal(
    original?.from && "address" in original.from
      ? original.from.address
      : undefined,
    "sender@example.com",
  );
});


test("feedback extracts sender from a normal forwarded message", () => {
  const forwarded =
    "Vidarebefordrat meddelande:\n" +
    "Från: Student Consulting <noreply@studentconsulting.com>\n" +
    "Ämne: Ett meddelande\n\n" +
    "Body";

  assert.equal(
    extractInlineForwardedSender(forwarded),
    "noreply@studentconsulting.com",
  );
});


test("Workers AI JSON response is parsed into a bounded classification", async () => {
  const fakeAi = {
    run: async () => ({
      response: JSON.stringify({
        category: "phishing",
        confidence: 0.96,
      }),
    }),
  } as unknown as Ai;

  const result = await classifyWithAi(
    fakeAi,
    {
      subject: "Verify your account",
      text: "Confirm your password",
      headers: [],
      attachments: [],
      fromAddress: "security@example.com",
      replyToAddresses: [],
    },
    {
      score: 4,
      verdict: "suspicious",
      reasons: ["high_risk_phrase"],
    },
    EMPTY_REPUTATION,
    8000,
  );

  assert.deepEqual(result, {
    category: "phishing",
    confidence: 0.96,
    adjustment: 5,
  });
});

test("preview migration config targets only the preview reputation database", async () => {
  const { readFile } = await import("node:fs/promises");
  const raw = await readFile(
    new URL("../wrangler.preview-migrations.jsonc", import.meta.url),
    "utf8",
  );
  const config = JSON.parse(raw);

  assert.deepEqual(config.d1_databases, [
    {
      binding: "REPUTATION_DB",
      database_name: "spam-filter-reputation-preview-eu",
      database_id: "6d74e6db-2da3-40c7-8dc6-eac95d96b755",
      migrations_dir: "migrations",
    },
  ]);
});
