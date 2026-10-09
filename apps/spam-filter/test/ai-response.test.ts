import assert from "node:assert/strict";
import test from "node:test";
import { classifyWithAi } from "../src/ai";
import { EMPTY_REPUTATION } from "../src/reputation";

async function classify(result: unknown) {
  return classifyWithAi(
    { run: async () => result } as unknown as Ai,
    {
      subject: "Invoice attached",
      text: "Please review the attached invoice.",
      headers: [],
      attachments: [{ filename: "invoice.html", mimeType: "text/html" }],
    },
    { score: 2, verdict: "clean", reasons: ["active_content_attachment"] },
    EMPTY_REPUTATION,
    8000,
  );
}

for (const category of ["phishing", "legitimate"] as const) {
  const classification = { category, confidence: 0.96 };
  const expected = { ...classification, adjustment: category === "phishing" ? 5 : -2 };
  for (const [format, result] of [
    ["object response", { response: classification }],
    ["JSON response", { response: JSON.stringify(classification) }],
    ["bare JSON string", JSON.stringify(classification)],
  ] as const) {
    test(`Workers AI accepts ${category} as ${format}`, async () => {
      assert.deepEqual(await classify(result), expected);
    });
  }
}

for (const [name, response] of [
  ["null", null],
  ["missing", undefined],
  ["array", []],
  ["number", 5],
  ["boolean", true],
  ["malformed JSON", "{not json}"],
  ["JSON null", "null"],
  ["unknown category", { category: "safe", confidence: 0.96 }],
  ["missing confidence", { category: "phishing" }],
  ["string confidence", { category: "phishing", confidence: "0.96" }],
  ["NaN confidence", { category: "phishing", confidence: NaN }],
  ["infinite confidence", { category: "phishing", confidence: Infinity }],
] as const) {
  test(`Workers AI ignores ${name} response`, async () => {
    assert.equal(await classify({ response }), null);
  });
}

test("Workers AI confidence and adjustment remain bounded for object responses", async () => {
  assert.deepEqual(
    await classify({ response: { category: "phishing", confidence: 100 } }),
    { category: "phishing", confidence: 1, adjustment: 5 },
  );
  assert.deepEqual(
    await classify({ response: { category: "legitimate", confidence: -1 } }),
    { category: "legitimate", confidence: 0, adjustment: 0 },
  );
});

test("Workers AI ignores missing result envelopes", async () => {
  for (const result of [null, undefined, {}, { category: "phishing", confidence: 0.96 }]) {
    assert.equal(await classify(result), null);
  }
});
