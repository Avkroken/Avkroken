import type { IngressMessageV1 } from "../../../packages/observability-contracts/src/index.ts";
import type { IngestEnv } from "./types.ts";

export class EventHandoffUnavailableError extends Error {
  constructor() {
    super("event handoff unavailable");
    this.name = "EventHandoffUnavailableError";
  }
}

export async function enqueueIngressMessage(env: IngestEnv, message: IngressMessageV1): Promise<void> {
  if (!env.EVENTS_QUEUE) throw new EventHandoffUnavailableError();
  try {
    await env.EVENTS_QUEUE.send(message);
  } catch {
    throw new EventHandoffUnavailableError();
  }
}
