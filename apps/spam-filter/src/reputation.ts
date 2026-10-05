export interface Reputation {
  seenCount: number;
  cleanCount: number;
  suspiciousCount: number;
  spamCount: number;
  userSpamCount: number;
  userLegitimateCount: number;
  aiSpamCount: number;
  aiLegitimateCount: number;
  lastVerdict: string;
}

type ReputationRow = {
  seen_count: number;
  clean_count: number;
  suspicious_count: number;
  spam_count: number;
  user_spam_count: number;
  user_legitimate_count: number;
  ai_spam_count: number;
  ai_legitimate_count: number;
  last_verdict: string;
};

export const EMPTY_REPUTATION: Reputation = {
  seenCount: 0,
  cleanCount: 0,
  suspiciousCount: 0,
  spamCount: 0,
  userSpamCount: 0,
  userLegitimateCount: 0,
  aiSpamCount: 0,
  aiLegitimateCount: 0,
  lastVerdict: "unknown",
};

function normalizeSender(sender: string): string {
  return sender.trim().toLowerCase();
}

function hex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

export async function senderKey(sender: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(normalizeSender(sender)),
  );
  return hex(digest);
}

export function reputationAdjustment(reputation: Reputation): number {
  const netUser =
    reputation.userSpamCount - reputation.userLegitimateCount;

  if (netUser > 0) {
    return Math.min(6, netUser * 3);
  }

  if (netUser < 0) {
    return -Math.min(2, Math.abs(netUser));
  }

  return 0;
}

export async function getReputation(
  db: D1Database,
  key: string,
): Promise<Reputation> {
  const row = await db
    .prepare(
      `SELECT
        seen_count,
        clean_count,
        suspicious_count,
        spam_count,
        user_spam_count,
        user_legitimate_count,
        ai_spam_count,
        ai_legitimate_count,
        last_verdict
      FROM sender_reputation
      WHERE sender_key = ?1`,
    )
    .bind(key)
    .first<ReputationRow>();

  if (!row) {
    return { ...EMPTY_REPUTATION };
  }

  return {
    seenCount: row.seen_count,
    cleanCount: row.clean_count,
    suspiciousCount: row.suspicious_count,
    spamCount: row.spam_count,
    userSpamCount: row.user_spam_count,
    userLegitimateCount: row.user_legitimate_count,
    aiSpamCount: row.ai_spam_count,
    aiLegitimateCount: row.ai_legitimate_count,
    lastVerdict: row.last_verdict,
  };
}

export type ObservationVerdict = "clean" | "suspicious" | "spam";

export interface Observation {
  key: string;
  domain: string;
  verdict: ObservationVerdict;
  aiCategory?: string;
  aiConfidence?: number;
}

export async function recordObservation(
  db: D1Database,
  observation: Observation,
): Promise<void> {
  const now = new Date().toISOString();
  const aiSpam =
    observation.aiCategory === "spam" || observation.aiCategory === "phishing"
      ? 1
      : 0;
  const aiLegitimate = observation.aiCategory === "legitimate" ? 1 : 0;
  const clean = observation.verdict === "clean" ? 1 : 0;
  const suspicious = observation.verdict === "suspicious" ? 1 : 0;
  const spam = observation.verdict === "spam" ? 1 : 0;

  await db
    .prepare(
      `INSERT INTO sender_reputation (
        sender_key,
        sender_domain,
        seen_count,
        clean_count,
        suspicious_count,
        spam_count,
        user_spam_count,
        user_legitimate_count,
        ai_spam_count,
        ai_legitimate_count,
        last_verdict,
        last_ai_category,
        last_ai_confidence,
        first_seen_at,
        updated_at
      ) VALUES (?1, ?2, 1, ?3, ?4, ?5, 0, 0, ?6, ?7, ?8, ?9, ?10, ?11, ?11)
      ON CONFLICT(sender_key) DO UPDATE SET
        sender_domain = excluded.sender_domain,
        seen_count = sender_reputation.seen_count + 1,
        clean_count = sender_reputation.clean_count + excluded.clean_count,
        suspicious_count = sender_reputation.suspicious_count + excluded.suspicious_count,
        spam_count = sender_reputation.spam_count + excluded.spam_count,
        ai_spam_count = sender_reputation.ai_spam_count + excluded.ai_spam_count,
        ai_legitimate_count = sender_reputation.ai_legitimate_count + excluded.ai_legitimate_count,
        last_verdict = excluded.last_verdict,
        last_ai_category = excluded.last_ai_category,
        last_ai_confidence = excluded.last_ai_confidence,
        updated_at = excluded.updated_at`,
    )
    .bind(
      observation.key,
      observation.domain,
      clean,
      suspicious,
      spam,
      aiSpam,
      aiLegitimate,
      observation.verdict,
      observation.aiCategory ?? null,
      observation.aiConfidence ?? null,
      now,
    )
    .run();
}

export interface FeedbackRecord {
  key: string;
  domain: string;
  label: "spam" | "legitimate";
  heuristicScore: number;
  aiCategory?: string;
  aiConfidence?: number;
}

export async function recordFeedback(
  db: D1Database,
  feedback: FeedbackRecord,
): Promise<void> {
  const now = new Date().toISOString();
  const spamIncrement = feedback.label === "spam" ? 1 : 0;
  const legitimateIncrement = feedback.label === "legitimate" ? 1 : 0;

  await db.batch([
    db
      .prepare(
        `INSERT INTO sender_reputation (
          sender_key,
          sender_domain,
          seen_count,
          clean_count,
          suspicious_count,
          spam_count,
          user_spam_count,
          user_legitimate_count,
          ai_spam_count,
          ai_legitimate_count,
          last_verdict,
          last_ai_category,
          last_ai_confidence,
          first_seen_at,
          updated_at
        ) VALUES (?1, ?2, 0, 0, 0, 0, ?3, ?4, 0, 0, ?5, ?6, ?7, ?8, ?8)
        ON CONFLICT(sender_key) DO UPDATE SET
          sender_domain = excluded.sender_domain,
          user_spam_count = sender_reputation.user_spam_count + excluded.user_spam_count,
          user_legitimate_count = sender_reputation.user_legitimate_count + excluded.user_legitimate_count,
          last_verdict = excluded.last_verdict,
          last_ai_category = excluded.last_ai_category,
          last_ai_confidence = excluded.last_ai_confidence,
          updated_at = excluded.updated_at`,
      )
      .bind(
        feedback.key,
        feedback.domain,
        spamIncrement,
        legitimateIncrement,
        feedback.label,
        feedback.aiCategory ?? null,
        feedback.aiConfidence ?? null,
        now,
      ),
    db
      .prepare(
        `INSERT INTO feedback_events (
          sender_key,
          sender_domain,
          label,
          heuristic_score,
          ai_category,
          ai_confidence,
          created_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
      )
      .bind(
        feedback.key,
        feedback.domain,
        feedback.label,
        feedback.heuristicScore,
        feedback.aiCategory ?? null,
        feedback.aiConfidence ?? null,
        now,
      ),
  ]);
}
