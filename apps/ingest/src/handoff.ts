import type { IngressMessageV1 } from "../../../packages/observability-contracts/src/index.ts";
import type { IngestEnv } from "./types.ts";

export class EventHandoffUnavailableError extends Error {
  constructor() {
    super("event handoff unavailable");
    this.name = "EventHandoffUnavailableError";
  }
}

/** Record bounded attempt telemetry without exposing event data or affecting delivery. */
function recordHandoff(source: string, outcome: "sent" | "failed" | "unconfigured", startedAt: number): void {
  try {
    const safeSource = source === "github" || source === "cloudflare_notifications"
      || source === "cloudflare_issues" || source === "cloudflare_casb" ? source : "unknown";
    console.info("ingest_queue_handoff", {
      source: safeSource,
      outcome,
      durationMs: Math.max(0, performance.now() - startedAt),
    });
  } catch {
    // Telemetry is best effort: a successful send must never become a retry.
  }
}

/** Await durable handoff and report one sanitized outcome for this queue attempt. */
export async function enqueueIngressMessage(env: IngestEnv, message: IngressMessageV1): Promise<void> {
  const startedAt = performance.now();
  if (!env.EVENTS_QUEUE) {
    recordHandoff(message.source, "unconfigured", startedAt);
    throw new EventHandoffUnavailableError();
  }
  try {
    await env.EVENTS_QUEUE.send(message);
  } catch {
    recordHandoff(message.source, "failed", startedAt);
    throw new EventHandoffUnavailableError();
  }
  recordHandoff(message.source, "sent", startedAt);
}
