export interface AttachmentView {
  filename?: string | null;
  mimeType?: string;
}

export interface HeaderView {
  key: string;
  value: string;
}

export interface EmailView {
  subject?: string;
  text?: string;
  html?: string;
  fromAddress?: string;
  replyToAddresses?: string[];
  headers: HeaderView[];
  attachments: AttachmentView[];
}

export type SpamVerdict = "clean" | "suspicious" | "spam";

export interface SpamAnalysis {
  score: number;
  verdict: SpamVerdict;
  reasons: string[];
}

export interface SpamThresholds {
  suspicious: number;
  reject: number;
}

const EXECUTABLE_EXTENSIONS = new Set([
  ".bat", ".cmd", ".com", ".cpl", ".exe", ".hta", ".img", ".iso", ".jar",
  ".js", ".jse", ".lnk", ".msi", ".msp", ".ps1", ".psm1", ".reg", ".scr",
  ".vbe", ".vbs", ".wsf", ".wsh",
]);

const MACRO_EXTENSIONS = new Set([".docm", ".pptm", ".xlsm"]);
const HTML_EXTENSIONS = new Set([".htm", ".html", ".svg"]);

const HIGH_RISK_PHRASES = [
  "verify your account",
  "confirm your password",
  "password expires",
  "gift card",
  "crypto wallet",
  "seed phrase",
  "wire transfer",
  "claim your prize",
  "you have won",
  "verifiera ditt konto",
  "bekräfta ditt lösenord",
  "ditt lösenord går ut",
  "presentkort",
  "kryptoplånbok",
  "banköverföring",
  "du har vunnit",
];

const SPAM_PHRASES = [
  "buy now",
  "limited time",
  "act now",
  "act fast",
  "click here",
  "free money",
  "risk free",
  "winner",
  "congratulations",
  "urgent",
  "agera nu",
  "klicka här",
  "gratis pengar",
  "begränsad tid",
  "grattis",
  "brådskande",
];

function normalizeAddress(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function addressDomain(value: string | undefined): string {
  const normalized = normalizeAddress(value);
  const at = normalized.lastIndexOf("@");
  return at >= 0 ? normalized.slice(at + 1) : "";
}

function sameDomainFamily(left: string, right: string): boolean {
  if (!left || !right) {
    return false;
  }
  return (
    left === right ||
    left.endsWith("." + right) ||
    right.endsWith("." + left)
  );
}

function extension(filename: string): string {
  const normalized = filename.trim().toLowerCase();
  const dot = normalized.lastIndexOf(".");
  return dot >= 0 ? normalized.slice(dot) : "";
}

function countPhraseMatches(value: string, phrases: readonly string[]): number {
  const normalized = value.toLowerCase();
  let matches = 0;
  for (const phrase of phrases) {
    if (normalized.includes(phrase)) {
      matches += 1;
    }
  }
  return matches;
}

function headerValues(email: EmailView, name: string): string[] {
  const normalized = name.toLowerCase();
  return email.headers
    .filter((header) => header.key.toLowerCase() === normalized)
    .map((header) => header.value);
}

function suspiciousUrlSignals(content: string): {
  score: number;
  reasons: string[];
} {
  const reasons: string[] = [];
  let score = 0;
  const urls = content.match(/https?:\/\/[^\s<>"')\]]+/gi) ?? [];
  const unique = [...new Set(urls)].slice(0, 100);

  let hasIpHost = false;
  let hasPunycode = false;
  let hasUserInfo = false;

  for (const candidate of unique) {
    try {
      const url = new URL(candidate);
      const host = url.hostname.toLowerCase();
      if (
        /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) ||
        /^\[[0-9a-f:]+\]$/i.test(host)
      ) {
        hasIpHost = true;
      }
      if (host.startsWith("xn--") || host.includes(".xn--")) {
        hasPunycode = true;
      }
      if (url.username || url.password) {
        hasUserInfo = true;
      }
    } catch {
      // Ignore malformed URLs instead of making filtering fail closed.
    }
  }

  if (hasIpHost) {
    score += 3;
    reasons.push("url_ip_host");
  }
  if (hasPunycode) {
    score += 2;
    reasons.push("url_punycode");
  }
  if (hasUserInfo) {
    score += 3;
    reasons.push("url_userinfo");
  }
  if (unique.length > 30) {
    score += 2;
    reasons.push("excessive_links");
  } else if (unique.length > 15) {
    score += 1;
    reasons.push("many_links");
  }

  return { score, reasons };
}

export function analyzeEmail(
  email: EmailView,
  envelopeSender: string,
  thresholds: SpamThresholds,
): SpamAnalysis {
  let score = 0;
  const reasons: string[] = [];

  const authentication = [
    ...headerValues(email, "authentication-results"),
    ...headerValues(email, "arc-authentication-results"),
  ].join("\n");

  if (/\bdmarc=fail\b/i.test(authentication)) {
    score += 4;
    reasons.push("dmarc_fail");
  }
  if (/\bspf=(?:fail|softfail)\b/i.test(authentication)) {
    score += 2;
    reasons.push("spf_fail");
  }
  if (/\bdkim=fail\b/i.test(authentication)) {
    score += 2;
    reasons.push("dkim_fail");
  }

  const envelopeDomain = addressDomain(envelopeSender);
  const headerFromDomain = addressDomain(email.fromAddress);
  if (
    envelopeDomain &&
    headerFromDomain &&
    !sameDomainFamily(envelopeDomain, headerFromDomain)
  ) {
    score += 1;
    reasons.push("envelope_from_mismatch");
  }

  const mismatchedReplyTo = (email.replyToAddresses ?? []).some((address) => {
    const replyDomain = addressDomain(address);
    return (
      Boolean(replyDomain) &&
      Boolean(headerFromDomain) &&
      !sameDomainFamily(replyDomain, headerFromDomain)
    );
  });
  if (mismatchedReplyTo) {
    score += 1;
    reasons.push("reply_to_mismatch");
  }

  let dangerousAttachment = false;
  let macroAttachment = false;
  let htmlAttachment = false;

  for (const attachment of email.attachments) {
    const filename = attachment.filename ?? "";
    const ext = extension(filename);
    const mime = (attachment.mimeType ?? "").toLowerCase();

    if (
      EXECUTABLE_EXTENSIONS.has(ext) ||
      mime === "application/x-msdownload" ||
      mime === "application/x-msdos-program"
    ) {
      dangerousAttachment = true;
    } else if (MACRO_EXTENSIONS.has(ext)) {
      macroAttachment = true;
    } else if (HTML_EXTENSIONS.has(ext)) {
      htmlAttachment = true;
    }
  }

  if (dangerousAttachment) {
    score += 8;
    reasons.push("executable_attachment");
  }
  if (macroAttachment) {
    score += 3;
    reasons.push("macro_attachment");
  }
  if (htmlAttachment) {
    score += 2;
    reasons.push("active_content_attachment");
  }

  const subject = email.subject ?? "";
  const body = (email.text ?? "") + "\n" + (email.html ?? "");
  const combined = subject + "\n" + body;

  const highRiskMatches = countPhraseMatches(combined, HIGH_RISK_PHRASES);
  if (highRiskMatches >= 2) {
    score += 4;
    reasons.push("multiple_high_risk_phrases");
  } else if (highRiskMatches === 1) {
    score += 2;
    reasons.push("high_risk_phrase");
  }

  const spamPhraseMatches = countPhraseMatches(combined, SPAM_PHRASES);
  if (spamPhraseMatches >= 4) {
    score += 3;
    reasons.push("spam_phrase_cluster");
  } else if (spamPhraseMatches >= 2) {
    score += 2;
    reasons.push("multiple_spam_phrases");
  } else if (spamPhraseMatches === 1) {
    score += 1;
    reasons.push("spam_phrase");
  }

  const subjectLetters = subject.match(/[A-Za-zÅÄÖåäö]/g)?.length ?? 0;
  const subjectUpper = subject.match(/[A-ZÅÄÖ]/g)?.length ?? 0;
  if (
    subject.length >= 12 &&
    subjectLetters >= 8 &&
    subjectUpper / subjectLetters > 0.75
  ) {
    score += 1;
    reasons.push("subject_excessive_caps");
  }

  if (/!!!|\$\$\$/.test(subject)) {
    score += 1;
    reasons.push("subject_suspicious_punctuation");
  }

  const html = email.html ?? "";
  if (/<form\b/i.test(html)) {
    score += 3;
    reasons.push("html_form");
  }
  if (/<script\b/i.test(html)) {
    score += 3;
    reasons.push("html_script");
  }
  if (/<iframe\b/i.test(html)) {
    score += 2;
    reasons.push("html_iframe");
  }
  if (/href\s*=\s*["']data:/i.test(html)) {
    score += 3;
    reasons.push("data_url_link");
  }

  const urlSignals = suspiciousUrlSignals(combined);
  score += urlSignals.score;
  reasons.push(...urlSignals.reasons);

  const precedence = headerValues(email, "precedence").join(",").toLowerCase();
  const isBulk =
    /\b(?:bulk|list|junk)\b/.test(precedence) ||
    headerValues(email, "list-unsubscribe").length > 0;
  if (isBulk && spamPhraseMatches >= 2) {
    score += 1;
    reasons.push("bulk_marketing_pattern");
  }

  const uniqueReasons = [...new Set(reasons)];
  const verdict: SpamVerdict =
    score >= thresholds.reject
      ? "spam"
      : score >= thresholds.suspicious
        ? "suspicious"
        : "clean";

  return { score, verdict, reasons: uniqueReasons };
}
