import PostalMime from "postal-mime";
import type { Address, Email } from "postal-mime";
import {
  classifyWithAi,
  shouldUseAi,
  type AiClassification,
} from "./ai";
import {
  analyzeEmail,
  type EmailView,
  type HeaderView,
  type SpamThresholds,
  type SpamVerdict,
} from "./analyzer";
import {
  extractAttachedOriginal,
  extractInlineForwardedSender,
  feedbackLabelForRecipient,
  isAuthorizedFeedbackSender,
} from "./feedback";
import { isBlocked, parseList, senderDomain } from "./filter";
import {
  EMPTY_REPUTATION,
  getReputation,
  recordFeedback,
  recordObservation,
  reputationAdjustment,
  senderKey,
  type Reputation,
} from "./reputation";

interface Env {
  AI: Ai;
  REPUTATION_DB: D1Database;
  MAIL_FORWARD_TO: string;
  MAIL_DOMAIN: string;
  BLOCKED_SENDERS: string;
  BLOCKED_DOMAINS: string;
  REJECT_MESSAGE: string;
  SPAM_SUSPICIOUS_SCORE?: string;
  SPAM_REJECT_SCORE?: string;
  MAX_ANALYSIS_BYTES?: string;
  AI_MIN_SCORE?: string;
  AI_MAX_INPUT_CHARS?: string;
  SPAM_FEEDBACK_LOCALPART?: string;
  LEGITIMATE_FEEDBACK_LOCALPART?: string;
}

const DEFAULT_THRESHOLDS: SpamThresholds = {
  suspicious: 4,
  reject: 8,
};

const DEFAULT_MAX_ANALYSIS_BYTES = 5 * 1024 * 1024;
const DEFAULT_AI_MIN_SCORE = 2;
const DEFAULT_AI_MAX_INPUT_CHARS = 8_000;

function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function mailboxAddresses(address: Address | undefined): string[] {
  if (!address) {
    return [];
  }

  if ("address" in address && address.address) {
    return [address.address];
  }

  if ("group" in address && address.group) {
    return address.group.map((entry) => entry.address);
  }

  return [];
}

function toEmailView(email: Email): EmailView {
  return {
    subject: email.subject,
    text: email.text,
    html: email.html,
    fromAddress: mailboxAddresses(email.from)[0],
    replyToAddresses: (email.replyTo ?? []).flatMap(mailboxAddresses),
    headers: email.headers.map((header) => ({
      key: header.key,
      value: header.value,
    })),
    attachments: email.attachments.map((attachment) => ({
      filename: attachment.filename,
      mimeType: attachment.mimeType,
    })),
  };
}

function headersToView(headers: Headers): HeaderView[] {
  return [...headers.entries()].map(([key, value]) => ({ key, value }));
}

function analysisHeaders(
  score: number,
  verdict: string,
  reasons: readonly string[],
  ai: AiClassification | null,
): Headers {
  const headers = new Headers();
  headers.set("X-Spam-Score", String(score));
  headers.set("X-Spam-Verdict", verdict);
  headers.set("X-Spam-Reasons", reasons.length > 0 ? reasons.join(",") : "none");
  headers.set("X-Spam-Engine", "avkroken-spam-filter/2");

  if (ai) {
    headers.set("X-Spam-AI", ai.category);
    headers.set("X-Spam-AI-Confidence", ai.confidence.toFixed(2));
  }

  return headers;
}

function finalVerdict(
  score: number,
  thresholds: SpamThresholds,
  hardReject: boolean,
): SpamVerdict {
  if (hardReject || score >= thresholds.reject) {
    return "spam";
  }

  if (score >= thresholds.suspicious) {
    return "suspicious";
  }

  return "clean";
}

function feedbackLocalpart(value: string | undefined, fallback: string): string {
  return value?.trim().toLowerCase() || fallback;
}

async function loadReputation(
  db: D1Database,
  key: string,
): Promise<Reputation> {
  try {
    return await getReputation(db, key);
  } catch {
    console.warn({ event: "reputation_read_failed" });
    return { ...EMPTY_REPUTATION };
  }
}

async function handleFeedback(
  message: ForwardableEmailMessage,
  env: Env,
  label: "spam" | "legitimate",
  thresholds: SpamThresholds,
  maxAnalysisBytes: number,
  aiMaxInputChars: number,
): Promise<void> {
  if (!isAuthorizedFeedbackSender(message.from, env.MAIL_FORWARD_TO)) {
    console.warn({
      event: "feedback_rejected",
      reason: "unauthorized_sender",
      sender_domain: senderDomain(message.from) || "unknown",
    });
    message.setReject("Feedback sender is not authorized");
    return;
  }

  if (message.rawSize > maxAnalysisBytes) {
    message.setReject("Feedback message is too large to analyze");
    return;
  }

  let feedbackEmail: Email;
  try {
    feedbackEmail = await PostalMime.parse(message.raw, {
      rfc822Attachments: true,
      maxNestingDepth: 64,
      maxHeadersSize: 512 * 1024,
      maxRfc822NestingDepth: 3,
    });
  } catch {
    message.setReject("Feedback message could not be parsed");
    return;
  }

  const original = await extractAttachedOriginal(feedbackEmail);
  if (!original) {
    message.setReject("Attach the original email as an .eml message");
    return;
  }

  const originalSender =
    mailboxAddresses(original.from)[0] ||
    mailboxAddresses(original.sender)[0] ||
    "";

  if (!originalSender) {
    message.setReject("Original sender could not be identified");
    return;
  }

  const emailView = toEmailView(original);
  const heuristic = analyzeEmail(emailView, originalSender, thresholds);
  const key = await senderKey(originalSender);
  const reputation = await loadReputation(env.REPUTATION_DB, key);

  let ai: AiClassification | null = null;
  try {
    ai = await classifyWithAi(
      env.AI,
      emailView,
      heuristic,
      reputation,
      aiMaxInputChars,
    );
  } catch {
    console.warn({
      event: "feedback_ai_failed",
      sender_domain: senderDomain(originalSender) || "unknown",
    });
  }

  await recordFeedback(env.REPUTATION_DB, {
    key,
    domain: senderDomain(originalSender) || "unknown",
    label,
    heuristicScore: heuristic.score,
    aiCategory: ai?.category,
    aiConfidence: ai?.confidence,
  });

  console.log({
    event: "feedback_recorded",
    label,
    sender_domain: senderDomain(originalSender) || "unknown",
    heuristic_score: heuristic.score,
    ai_category: ai?.category ?? "unavailable",
    ai_confidence: ai?.confidence ?? null,
  });
}

export default {
  async email(
    message,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    const thresholds = {
      suspicious: parseNumber(
        env.SPAM_SUSPICIOUS_SCORE,
        DEFAULT_THRESHOLDS.suspicious,
      ),
      reject: parseNumber(env.SPAM_REJECT_SCORE, DEFAULT_THRESHOLDS.reject),
    };

    if (thresholds.reject < thresholds.suspicious) {
      thresholds.reject = thresholds.suspicious;
    }

    const maxAnalysisBytes = parseNumber(
      env.MAX_ANALYSIS_BYTES,
      DEFAULT_MAX_ANALYSIS_BYTES,
    );
    const aiMinimumScore = parseNumber(
      env.AI_MIN_SCORE,
      DEFAULT_AI_MIN_SCORE,
    );
    const aiMaxInputChars = parseNumber(
      env.AI_MAX_INPUT_CHARS,
      DEFAULT_AI_MAX_INPUT_CHARS,
    );

    const feedbackLabel = feedbackLabelForRecipient(
      message.to,
      env.MAIL_DOMAIN,
      feedbackLocalpart(env.SPAM_FEEDBACK_LOCALPART, "spam"),
      feedbackLocalpart(env.LEGITIMATE_FEEDBACK_LOCALPART, "notspam"),
    );

    if (feedbackLabel) {
      await handleFeedback(
        message,
        env,
        feedbackLabel,
        thresholds,
        maxAnalysisBytes,
        aiMaxInputChars,
      );
      return;
    }

    const envelopeDomain = senderDomain(message.from);
    const blocked = isBlocked(message.from, {
      blockedSenders: parseList(env.BLOCKED_SENDERS),
      blockedDomains: parseList(env.BLOCKED_DOMAINS),
    });

    if (blocked) {
      console.warn({
        event: "email_rejected",
        reason: "blocklist",
        sender_domain: envelopeDomain || "unknown",
        receiving_domain: env.MAIL_DOMAIN,
      });
      message.setReject(env.REJECT_MESSAGE);
      return;
    }

    let emailView: EmailView = {
      subject: message.headers.get("subject") ?? undefined,
      headers: headersToView(message.headers),
      attachments: [],
    };
    let analysisMode: "full" | "headers_only" | "parse_fallback" =
      "headers_only";

    if (message.rawSize <= maxAnalysisBytes) {
      try {
        const parsed = await PostalMime.parse(message.raw, {
          maxNestingDepth: 64,
          maxHeadersSize: 512 * 1024,
          maxRfc822NestingDepth: 3,
        });
        emailView = toEmailView(parsed);
        analysisMode = "full";
      } catch {
        analysisMode = "parse_fallback";
      }
    }

    const heuristic = analyzeEmail(emailView, message.from, thresholds);
    const identitySender = emailView.fromAddress || message.from;
    const identityDomain = senderDomain(identitySender) || envelopeDomain || "unknown";
    const key = await senderKey(identitySender);
    const reputation = await loadReputation(env.REPUTATION_DB, key);
    const reputationScore = reputationAdjustment(reputation);
    const adjustedHeuristicScore = Math.max(
      0,
      heuristic.score + reputationScore,
    );

    let ai: AiClassification | null = null;
    if (
      analysisMode === "full" &&
      shouldUseAi(adjustedHeuristicScore, aiMinimumScore, reputation)
    ) {
      try {
        ai = await classifyWithAi(
          env.AI,
          emailView,
          heuristic,
          reputation,
          aiMaxInputChars,
        );
      } catch {
        console.warn({
          event: "ai_classification_failed",
          sender_domain: identityDomain,
        });
      }
    }

    const finalScore = Math.max(
      0,
      adjustedHeuristicScore + (ai?.adjustment ?? 0),
    );
    const hardReject = heuristic.reasons.includes("executable_attachment");
    const verdict = finalVerdict(finalScore, thresholds, hardReject);
    const reasons = [...heuristic.reasons];

    if (reputationScore > 0) {
      reasons.push("user_reputation_risk");
    } else if (reputationScore < 0) {
      reasons.push("user_reputation_trusted");
    }

    if (ai) {
      reasons.push("ai_" + ai.category);
    }

    const uniqueReasons = [...new Set(reasons)];

    ctx.waitUntil(
      recordObservation(env.REPUTATION_DB, {
        key,
        domain: identityDomain,
        verdict,
        aiCategory: ai?.category,
        aiConfidence: ai?.confidence,
      }).catch(() => {
        console.warn({ event: "reputation_write_failed" });
      }),
    );

    if (verdict === "spam") {
      console.warn({
        event: "email_rejected",
        reason: hardReject ? "hard_signal" : "spam_score",
        sender_domain: identityDomain,
        receiving_domain: env.MAIL_DOMAIN,
        heuristic_score: heuristic.score,
        reputation_adjustment: reputationScore,
        ai_adjustment: ai?.adjustment ?? 0,
        final_score: finalScore,
        reasons: uniqueReasons,
        analysis_mode: analysisMode,
      });
      message.setReject(env.REJECT_MESSAGE);
      return;
    }

    console.log({
      event: "email_forwarded",
      sender_domain: identityDomain,
      receiving_domain: env.MAIL_DOMAIN,
      heuristic_score: heuristic.score,
      reputation_adjustment: reputationScore,
      ai_adjustment: ai?.adjustment ?? 0,
      final_score: finalScore,
      verdict,
      reasons: uniqueReasons,
      analysis_mode: analysisMode,
    });

    await message.forward(
      env.MAIL_FORWARD_TO,
      analysisHeaders(finalScore, verdict, uniqueReasons, ai),
    );
  },
} satisfies ExportedHandler<Env>;
