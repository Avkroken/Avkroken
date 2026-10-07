import type { IngressMessageV1 } from "../../../packages/observability-contracts/src/index.ts";
import { processIngressMessage, type D1DatabaseLike, type ProcessIngressResult } from "./store.ts";

export interface QueueMessageLike<T> {
  body: T;
  ack(): void;
  retry(): void;
}

export interface QueueBatchLike<T> {
  messages: QueueMessageLike<T>[];
}

export const MAX_INGRESS_BATCH_SIZE = 10;

export type BatchProcessSummary = {
  processed: number;
  inserted: number;
  duplicates: number;
  retried: number;
};

export async function processIngressQueueBatch(
  db: D1DatabaseLike,
  batch: QueueBatchLike<IngressMessageV1>,
): Promise<{ summary: BatchProcessSummary; results: ProcessIngressResult[] }> {
  if (batch.messages.length > MAX_INGRESS_BATCH_SIZE) {
    throw new RangeError("ingress batch exceeds configured maximum");
  }
  const summary: BatchProcessSummary = {
    processed: 0,
    inserted: 0,
    duplicates: 0,
    retried: 0,
  };
  const results: ProcessIngressResult[] = [];

  for (const message of batch.messages) {
    const result = await processIngressMessage(db, message.body);
    results.push(result);
    summary.processed += 1;
    if (result.disposition === "ack") {
      message.ack();
      if (result.status === "inserted") summary.inserted += 1;
      else summary.duplicates += 1;
    } else {
      message.retry();
      summary.retried += 1;
    }
  }

  return { summary, results };
}
