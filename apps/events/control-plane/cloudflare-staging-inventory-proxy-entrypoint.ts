import { WorkerEntrypoint } from "cloudflare:workers";
import type {
  CloudflareStagingInventoryProxyV1,
  CloudflareWorkerInspectionPayloadV1,
} from "../src/cloudflare-staging-inventory-reader.ts";
import {
  CloudflareStagingInventoryProxyServiceV1,
  type CloudflareStagingInventoryProxyEnvV1,
} from "./cloudflare-staging-inventory-proxy.ts";

export class CloudflareStagingInventoryProxyEntrypoint
extends WorkerEntrypoint<CloudflareStagingInventoryProxyEnvV1>
implements CloudflareStagingInventoryProxyV1 {
  private service(): CloudflareStagingInventoryProxyServiceV1 {
    return new CloudflareStagingInventoryProxyServiceV1(this.env);
  }

  getAccountIdentity(): Promise<unknown> {
    return this.service().getAccountIdentity();
  }

  listD1Databases(): Promise<unknown> {
    return this.service().listD1Databases();
  }

  getD1Database(databaseId: string): Promise<unknown> {
    return this.service().getD1Database(databaseId);
  }

  listQueues(): Promise<unknown> {
    return this.service().listQueues();
  }

  listQueueConsumers(queueId: string): Promise<unknown> {
    return this.service().listQueueConsumers(queueId);
  }

  listWorkers(): Promise<unknown> {
    return this.service().listWorkers();
  }

  inspectPlannedWorker(
    workerName: "events-staging" | "ingest-staging",
  ): Promise<CloudflareWorkerInspectionPayloadV1> {
    return this.service().inspectPlannedWorker(workerName);
  }
}
