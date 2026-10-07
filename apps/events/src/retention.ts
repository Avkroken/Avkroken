import type { D1DatabaseLike } from "./store.ts";

export const EVENT_RETENTION_DAYS = 90;
const DAY_MS = 86_400_000;

export function eventRetentionCutoff(nowMs = Date.now()): string {
  return new Date(nowMs - EVENT_RETENTION_DAYS * DAY_MS).toISOString();
}

export async function pruneEvents(
  db: D1DatabaseLike,
  nowMs = Date.now(),
): Promise<number> {
  const result = await db.prepare(
    "DELETE FROM events WHERE received_at < ?",
  ).bind(eventRetentionCutoff(nowMs)).run();
  return Math.max(0, Number(result.meta?.changes ?? 0));
}
