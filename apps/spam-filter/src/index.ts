import PostalMime from "postal-mime";
import type { Address, Email } from "postal-mime";
import {
  analyzeEmail,
  type EmailView,
  type HeaderView,
  type SpamThresholds,
} from "./analyzer";
import { isBlocked, parseList, senderDomain } from "./filter";

interface Env {
  MAIL_FORWARD_TO: string;
  MAIL_DOMAIN: string;
  BLOCKED_SENDERS: string;
  BLOCKED_DOMAINS: string;
  REJECT_MESSAGE: string;
  SPAM_SUSPICIOUS_SCORE?: string;
  SPAM_REJECT_SCORE?: string;
  MAX_ANALYSIS_BYTES?: string;
}

const DEFAULT_THRESHOLDS: SpamThresholds = {
  suspicious: 4,
  reject: 8,
};

const DEFAULT_MAX_ANALYSIS_BYTES = 5 * 1024 * 1024;

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
): Headers {
  const headers = new Headers();
  headers.set("X-Spam-Score", String(score));
  headers.set("X-Spam-Verdict", verdict);
  headers.set("X-Spam-Reasons", reasons.length > 0 ? reasons.join(",") : "none");
  headers.set("X-Spam-Engine", "avkroken-spam-filter/1");
  return headers;
}

export default {
  async email(message, env: Env): Promise<void> {
    const domain = senderDomain(message.from);
    const blocked = isBlocked(message.from, {
      blockedSenders: parseList(env.BLOCKED_SENDERS),
      blockedDomains: parseList(env.BLOCKED_DOMAINS),
    });

    if (blocked) {
      console.warn({
        event: "email_rejected",
        reason: "blocklist",
        sender_domain: domain || "unknown",
        receiving_domain: env.MAIL_DOMAIN,
      });
      message.setReject(env.REJECT_MESSAGE);
      return;
    }

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

    const analysis = analyzeEmail(emailView, message.from, thresholds);

    if (analysis.verdict === "spam") {
      console.warn({
        event: "email_rejected",
        reason: "spam_score",
        sender_domain: domain || "unknown",
        receiving_domain: env.MAIL_DOMAIN,
        score: analysis.score,
        reasons: analysis.reasons,
        analysis_mode: analysisMode,
      });
      message.setReject(env.REJECT_MESSAGE);
      return;
    }

    console.log({
      event: "email_forwarded",
      sender_domain: domain || "unknown",
      receiving_domain: env.MAIL_DOMAIN,
      score: analysis.score,
      verdict: analysis.verdict,
      reasons: analysis.reasons,
      analysis_mode: analysisMode,
    });

    await message.forward(
      env.MAIL_FORWARD_TO,
      analysisHeaders(analysis.score, analysis.verdict, analysis.reasons),
    );
  },
} satisfies ExportedHandler<Env>;
