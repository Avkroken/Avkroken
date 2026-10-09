import type { IngestEnv } from "./types.ts";

export type IngestMetricSource = "github" | "notifications" | "issues" | "casb" | "unknown";
export type IngestMetricOutcome =
  | "accepted"
  | "ignored"
  | "invalid"
  | "unauthorized"
  | "method_not_allowed"
  | "not_found"
  | "unavailable"
  | "error";

export function recordIngestOutcome(
  env: IngestEnv,
  surface: "http" | "shadow",
  source: IngestMetricSource,
  outcome: IngestMetricOutcome,
  startedAt: number,
): void {
  try {
    env.INGEST_METRICS?.writeDataPoint({
      indexes: ["ingest-v1"],
      blobs: [surface, source, outcome],
      doubles: [1, Math.max(0, performance.now() - startedAt)],
    });
  } catch {
    // Observability failure must never change durable handoff or provider retries.
  }
}
