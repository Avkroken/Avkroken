import type {
  InventoryCoverageV1,
  StagingInventoryDatabaseV1,
  StagingInventoryQueueConsumerV1,
  StagingInventoryQueueV1,
  StagingInventorySnapshotV1,
  StagingInventoryWorkerV1,
} from "./staging-preflight.ts";
import type { RuntimeProvisioningPlanV1 } from "./runtime-gate.ts";

export type ProviderDatabaseInventoryV1 = {
  name: string;
  id: string;
  jurisdiction: string | null;
  readReplication: string | null;
};

export type ProviderQueueInventoryV1 = {
  name: string;
  id: string;
  messageRetentionSeconds: number | null;
};

export type ProviderQueueConsumerInventoryV1 = {
  worker: string;
  maxBatchSize: number | null;
  maxBatchTimeoutSeconds: number | null;
  maxRetries: number | null;
  deadLetterQueue: string | null;
};

export type ProviderWorkerInventoryV1 = {
  name: string;
};

export type ProviderWorkerInspectionV1 = Omit<StagingInventoryWorkerV1, "ownershipConfirmed">;

export interface StagingInventoryReadPortV1 {
  listDatabases(): Promise<ProviderDatabaseInventoryV1[]>;
  listQueues(): Promise<ProviderQueueInventoryV1[]>;
  listQueueConsumers(queueId: string): Promise<ProviderQueueConsumerInventoryV1[]>;
  listWorkers(): Promise<ProviderWorkerInventoryV1[]>;
  inspectWorker(name: string): Promise<ProviderWorkerInspectionV1>;
}

export type StagingInventoryEvidenceV1 = {
  observedAt: string;
  accountId: string;
  coverage: {
    controlPlane: InventoryCoverageV1;
    providerDestinations: InventoryCoverageV1;
  };
  controlPlane: StagingInventorySnapshotV1["controlPlane"];
  providerDestinations: StagingInventorySnapshotV1["providerDestinations"];
  production: StagingInventorySnapshotV1["production"];
  ownership: {
    databaseIds: string[];
    queueIds: string[];
    workerNames: string[];
  };
};

export type StagingInventoryCollectionResultV1 = {
  snapshot: StagingInventorySnapshotV1;
  errors: string[];
};

function coverageFromErrors(errors: readonly string[], prefix: string): InventoryCoverageV1 {
  if (errors.some((error) => error.startsWith(`${prefix}list:`))) return "unavailable";
  return errors.some((error) => error.startsWith(prefix)) ? "partial" : "complete";
}

function safeError(error: unknown): string {
  if (error instanceof Error && error.name) return error.name;
  return "Error";
}

function owned(values: readonly string[], value: string): boolean {
  return values.includes(value);
}

function normalizeDatabases(
  items: readonly ProviderDatabaseInventoryV1[],
  ownership: StagingInventoryEvidenceV1["ownership"],
): StagingInventoryDatabaseV1[] {
  return items.map((item) => ({
    name: item.name,
    id: item.id,
    jurisdiction: item.jurisdiction,
    readReplication: item.readReplication,
    ownershipConfirmed: owned(ownership.databaseIds, item.id),
  }));
}

async function collectQueues(
  reader: StagingInventoryReadPortV1,
  plan: RuntimeProvisioningPlanV1,
  ownership: StagingInventoryEvidenceV1["ownership"],
  errors: string[],
): Promise<StagingInventoryQueueV1[]> {
  let queues: ProviderQueueInventoryV1[];
  try {
    queues = await reader.listQueues();
  } catch (error) {
    errors.push(`queues:list:${safeError(error)}`);
    return [];
  }

  const plannedNames = new Set([
    plan.shadow.queue.name,
    plan.shadow.queue.deadLetterQueue,
  ]);
  const result: StagingInventoryQueueV1[] = [];

  for (const queue of queues) {
    let consumers: StagingInventoryQueueConsumerV1[] = [];
    if (plannedNames.has(queue.name)) {
      try {
        consumers = (await reader.listQueueConsumers(queue.id)).map((consumer) => ({
          worker: consumer.worker,
          maxBatchSize: consumer.maxBatchSize,
          maxBatchTimeoutSeconds: consumer.maxBatchTimeoutSeconds,
          maxRetries: consumer.maxRetries,
          deadLetterQueue: consumer.deadLetterQueue,
        }));
      } catch (error) {
        errors.push(`queues:consumers:${queue.name}:${safeError(error)}`);
      }
    }

    result.push({
      name: queue.name,
      id: queue.id,
      messageRetentionSeconds: queue.messageRetentionSeconds,
      ownershipConfirmed: owned(ownership.queueIds, queue.id),
      consumers,
    });
  }

  return result;
}

async function collectWorkers(
  reader: StagingInventoryReadPortV1,
  plan: RuntimeProvisioningPlanV1,
  ownership: StagingInventoryEvidenceV1["ownership"],
  errors: string[],
): Promise<StagingInventoryWorkerV1[]> {
  let workers: ProviderWorkerInventoryV1[];
  try {
    workers = await reader.listWorkers();
  } catch (error) {
    errors.push(`workers:list:${safeError(error)}`);
    return [];
  }

  const plannedNames = new Set([plan.shadow.eventsWorker, plan.shadow.ingestWorker]);
  const result: StagingInventoryWorkerV1[] = [];

  for (const worker of workers) {
    if (!plannedNames.has(worker.name)) continue;
    try {
      const inspected = await reader.inspectWorker(worker.name);
      result.push({
        ...inspected,
        name: worker.name,
        ownershipConfirmed: owned(ownership.workerNames, worker.name),
      });
    } catch (error) {
      errors.push(`workers:inspect:${worker.name}:${safeError(error)}`);
    }
  }
  return result;
}

export async function collectStagingInventorySnapshotV1(
  plan: RuntimeProvisioningPlanV1,
  reader: StagingInventoryReadPortV1,
  evidence: StagingInventoryEvidenceV1,
): Promise<StagingInventoryCollectionResultV1> {
  const errors: string[] = [];

  let databases: StagingInventoryDatabaseV1[] = [];
  try {
    databases = normalizeDatabases(await reader.listDatabases(), evidence.ownership);
  } catch (error) {
    errors.push(`d1:list:${safeError(error)}`);
  }

  const [queues, workers] = await Promise.all([
    collectQueues(reader, plan, evidence.ownership, errors),
    collectWorkers(reader, plan, evidence.ownership, errors),
  ]);

  return {
    snapshot: {
      schemaVersion: 1,
      observedAt: evidence.observedAt,
      accountId: evidence.accountId,
      coverage: {
        d1: coverageFromErrors(errors, "d1:"),
        queues: coverageFromErrors(errors, "queues:"),
        workers: coverageFromErrors(errors, "workers:"),
        controlPlane: evidence.coverage.controlPlane,
        providerDestinations: evidence.coverage.providerDestinations,
      },
      providerDestinations: { ...evidence.providerDestinations },
      controlPlane: { ...evidence.controlPlane },
      production: {
        databaseIds: [...evidence.production.databaseIds],
        queueIds: [...evidence.production.queueIds],
        workerNames: [...evidence.production.workerNames],
      },
      databases,
      queues,
      workers,
    },
    errors,
  };
}
