import type { IngressMessageV1 } from "../../../packages/observability-contracts/src/index.ts";

export interface QueueProducerLike<T> {
  send(message: T): Promise<void>;
}

export interface IngestEnv {
  EVENTS_QUEUE?: QueueProducerLike<IngressMessageV1>;
  INGEST_METRICS?: {
    writeDataPoint(point: { indexes: string[]; blobs: string[]; doubles: number[] }): void;
  };
  SKVALLERBYTTAN_WEBHOOK_SECRET?: string;
  CLOUDFLARE_NOTIFICATIONS_WEBHOOK_SECRET?: string;
  CLOUDFLARE_CASB_WEBHOOK_SECRET?: string;
  SKVALLERBYTTAN_GITHUB_OWNER?: string;
}
