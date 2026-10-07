import {
  validateRuntimeProvisioningPlanV1,
  type RuntimeProvisioningPlanV1,
} from "./runtime-gate.ts";

export const MAX_STAGING_PREFLIGHT_AGE_MS = 15 * 60 * 1000;
const CLOCK_SKEW_MS = 60 * 1000;

export type InventoryCoverageV1 = "complete" | "partial" | "unavailable" | "unknown";

export type StagingInventoryDatabaseV1 = {
  name: string;
  id: string;
  jurisdiction: string | null;
  readReplication: string | null;
  ownershipConfirmed: boolean;
};

export type StagingInventoryQueueConsumerV1 = {
  worker: string;
  maxBatchSize: number | null;
  maxBatchTimeoutSeconds: number | null;
  maxRetries: number | null;
};

export type StagingInventoryQueueV1 = {
  name: string;
  id: string;
  messageRetentionSeconds: number | null;
  deadLetterQueue: string | null;
  ownershipConfirmed: boolean;
  consumers: StagingInventoryQueueConsumerV1[];
};

export type StagingInventoryD1BindingV1 = {
  binding: string;
  databaseId: string;
  databaseName: string;
};

export type StagingInventoryQueueBindingV1 = {
  binding?: string;
  queueId: string;
  queueName: string;
};

export type StagingInventoryWorkerV1 = {
  name: string;
  deploymentCommitSha: string | null;
  ownershipConfirmed: boolean;
  publicRoutes: string[];
  secretBindings: string[];
  d1Bindings: StagingInventoryD1BindingV1[];
  queueProducerBindings: StagingInventoryQueueBindingV1[];
  queueConsumerBindings: StagingInventoryQueueBindingV1[];
};

export type StagingInventorySnapshotV1 = {
  schemaVersion: number;
  observedAt: string;
  accountId: string;
  coverage: {
    d1: InventoryCoverageV1;
    queues: InventoryCoverageV1;
    workers: InventoryCoverageV1;
    controlPlane: InventoryCoverageV1;
  };
  controlPlane: {
    mechanism: string;
    credentialClass: string | null;
    serverSideOnly: boolean;
    credentialValueExported: boolean;
    permissionsVerified: boolean;
  };
  production: {
    databaseIds: string[];
    queueIds: string[];
    workerNames: string[];
  };
  databases: StagingInventoryDatabaseV1[];
  queues: StagingInventoryQueueV1[];
  workers: StagingInventoryWorkerV1[];
};

export type StagingPreflightResourceKindV1 = "database" | "queue" | "worker";
export type StagingPreflightActionV1 = "create" | "reuse" | "blocked";

export type StagingPreflightResourceDecisionV1 = {
  kind: StagingPreflightResourceKindV1;
  name: string;
  action: StagingPreflightActionV1;
  reasons: string[];
};

export type StagingPreflightResultV1 = {
  ready: boolean;
  reasons: string[];
  resources: StagingPreflightResourceDecisionV1[];
};

function nonEmpty(value: string): boolean {
  return Boolean(value.trim());
}

function validFiniteInteger(value: number | null): value is number {
  return value !== null && Number.isInteger(value) && value >= 0;
}

function addReason(target: string[], reason: string): void {
  if (!target.includes(reason)) target.push(reason);
}

function requireEqual(
  actual: unknown,
  expected: unknown,
  field: string,
  reasons: string[],
): void {
  if (actual !== expected) addReason(reasons, `${field} must equal ${String(expected)}`);
}

function matching<T extends { name: string }>(items: readonly T[], name: string): T[] {
  return items.filter((item) => item.name === name);
}

function databaseDecision(
  snapshot: StagingInventorySnapshotV1,
  name: string,
  expectedJurisdiction: string,
  expectedReadReplication: string,
): StagingPreflightResourceDecisionV1 {
  const reasons: string[] = [];
  const matches = matching(snapshot.databases, name);
  if (matches.length === 0) return { kind: "database", name, action: "create", reasons };
  if (matches.length > 1) {
    addReason(reasons, `multiple database resources named ${name}`);
    return { kind: "database", name, action: "blocked", reasons };
  }

  const database = matches[0];
  if (!database.ownershipConfirmed) addReason(reasons, "database.ownershipConfirmed must be true");
  if (!nonEmpty(database.id)) addReason(reasons, "database.id must be known");
  requireEqual(database.jurisdiction, expectedJurisdiction, "database.jurisdiction", reasons);
  requireEqual(
    database.readReplication,
    expectedReadReplication,
    "database.readReplication",
    reasons,
  );
  if (snapshot.production.databaseIds.includes(database.id)) {
    addReason(reasons, "staging database must not reuse a production database");
  }

  return {
    kind: "database",
    name,
    action: reasons.length === 0 ? "reuse" : "blocked",
    reasons,
  };
}

function dlqDecision(
  snapshot: StagingInventorySnapshotV1,
  name: string,
): StagingPreflightResourceDecisionV1 {
  const reasons: string[] = [];
  const matches = matching(snapshot.queues, name);
  if (matches.length === 0) return { kind: "queue", name, action: "create", reasons };
  if (matches.length > 1) {
    addReason(reasons, `multiple queue resources named ${name}`);
    return { kind: "queue", name, action: "blocked", reasons };
  }

  const queue = matches[0];
  if (!queue.ownershipConfirmed) addReason(reasons, "dlq.ownershipConfirmed must be true");
  if (!nonEmpty(queue.id)) addReason(reasons, "dlq.id must be known");
  if (
    queue.messageRetentionSeconds !== null
    && (!validFiniteInteger(queue.messageRetentionSeconds) || queue.messageRetentionSeconds < 60)
  ) {
    addReason(reasons, "dlq.messageRetentionSeconds must be a positive bounded duration");
  }
  requireEqual(queue.deadLetterQueue, null, "dlq.deadLetterQueue", reasons);
  if (queue.consumers.length !== 0) addReason(reasons, "dlq.consumers must be empty before staging activation");
  if (snapshot.production.queueIds.includes(queue.id)) {
    addReason(reasons, "staging DLQ must not reuse a production queue");
  }

  return {
    kind: "queue",
    name,
    action: reasons.length === 0 ? "reuse" : "blocked",
    reasons,
  };
}

function sourceQueueDecision(
  snapshot: StagingInventorySnapshotV1,
  plan: RuntimeProvisioningPlanV1,
): StagingPreflightResourceDecisionV1 {
  const target = plan.shadow.queue;
  const reasons: string[] = [];
  const matches = matching(snapshot.queues, target.name);
  if (matches.length === 0) {
    return { kind: "queue", name: target.name, action: "create", reasons };
  }
  if (matches.length > 1) {
    addReason(reasons, `multiple queue resources named ${target.name}`);
    return { kind: "queue", name: target.name, action: "blocked", reasons };
  }

  const queue = matches[0];
  if (!queue.ownershipConfirmed) addReason(reasons, "queue.ownershipConfirmed must be true");
  if (!nonEmpty(queue.id)) addReason(reasons, "queue.id must be known");
  requireEqual(
    queue.messageRetentionSeconds,
    target.messageRetentionSeconds,
    "queue.messageRetentionSeconds",
    reasons,
  );
  requireEqual(queue.deadLetterQueue, target.deadLetterQueue, "queue.deadLetterQueue", reasons);
  if (snapshot.production.queueIds.includes(queue.id)) {
    addReason(reasons, "staging source queue must not reuse a production queue");
  }

  if (queue.consumers.length > 1) {
    addReason(reasons, "queue must have zero or one staging consumer before activation");
  } else if (queue.consumers.length === 1) {
    const consumer = queue.consumers[0];
    requireEqual(consumer.worker, target.consumerWorker, "queue.consumer.worker", reasons);
    requireEqual(
      consumer.maxBatchSize,
      target.maxBatchSize,
      "queue.consumer.maxBatchSize",
      reasons,
    );
    requireEqual(
      consumer.maxBatchTimeoutSeconds,
      target.maxBatchTimeoutSeconds,
      "queue.consumer.maxBatchTimeoutSeconds",
      reasons,
    );
    requireEqual(
      consumer.maxRetries,
      target.maxRetries,
      "queue.consumer.maxRetries",
      reasons,
    );
  }

  return {
    kind: "queue",
    name: target.name,
    action: reasons.length === 0 ? "reuse" : "blocked",
    reasons,
  };
}

function validateWorkerBindings(
  worker: StagingInventoryWorkerV1,
  expectedRole: "events" | "ingest",
  snapshot: StagingInventorySnapshotV1,
  plan: RuntimeProvisioningPlanV1,
  reasons: string[],
): void {
  if (worker.publicRoutes.length > 0) {
    addReason(reasons, "worker.publicRoutes must be empty during staging shadow");
  }
  if (worker.secretBindings.length > 0) {
    addReason(reasons, "worker.secretBindings must be empty during staging shadow");
  }

  if (expectedRole === "events") {
    if (worker.d1Bindings.length > 1) addReason(reasons, "events worker may have at most one D1 binding");
    if (worker.d1Bindings.length === 1) {
      const binding = worker.d1Bindings[0];
      requireEqual(binding.binding, plan.shadow.database.binding, "worker.d1.binding", reasons);
      requireEqual(binding.databaseName, plan.shadow.database.name, "worker.d1.databaseName", reasons);
      if (snapshot.production.databaseIds.includes(binding.databaseId)) {
        addReason(reasons, "events staging worker must not bind a production database");
      }
    }

    if (worker.queueProducerBindings.length > 0) {
      addReason(reasons, "events staging worker must not produce to ingest-events queue");
    }
    if (worker.queueConsumerBindings.length > 1) {
      addReason(reasons, "events staging worker may have at most one queue consumer binding");
    }
    if (worker.queueConsumerBindings.length === 1) {
      const binding = worker.queueConsumerBindings[0];
      requireEqual(binding.queueName, plan.shadow.queue.name, "worker.queueConsumer.queueName", reasons);
      if (snapshot.production.queueIds.includes(binding.queueId)) {
        addReason(reasons, "events staging worker must not consume a production queue");
      }
    }
    return;
  }

  if (worker.d1Bindings.length > 0) addReason(reasons, "ingest staging worker must not bind D1");
  if (worker.queueConsumerBindings.length > 0) {
    addReason(reasons, "ingest staging worker must not consume ingest-events queue");
  }
  if (worker.queueProducerBindings.length > 1) {
    addReason(reasons, "ingest staging worker may have at most one queue producer binding");
  }
  if (worker.queueProducerBindings.length === 1) {
    const binding = worker.queueProducerBindings[0];
    requireEqual(binding.binding, plan.shadow.queue.producerBinding, "worker.queueProducer.binding", reasons);
    requireEqual(binding.queueName, plan.shadow.queue.name, "worker.queueProducer.queueName", reasons);
    if (snapshot.production.queueIds.includes(binding.queueId)) {
      addReason(reasons, "ingest staging worker must not bind a production queue");
    }
  }
}

function workerDecision(
  snapshot: StagingInventorySnapshotV1,
  plan: RuntimeProvisioningPlanV1,
  expectedRole: "events" | "ingest",
  expectedRepositorySha: string,
): StagingPreflightResourceDecisionV1 {
  const name = expectedRole === "events" ? plan.shadow.eventsWorker : plan.shadow.ingestWorker;
  const reasons: string[] = [];
  const matches = matching(snapshot.workers, name);
  if (matches.length === 0) return { kind: "worker", name, action: "create", reasons };
  if (matches.length > 1) {
    addReason(reasons, `multiple worker resources named ${name}`);
    return { kind: "worker", name, action: "blocked", reasons };
  }

  const worker = matches[0];
  if (!worker.ownershipConfirmed) addReason(reasons, "worker.ownershipConfirmed must be true");
  requireEqual(
    worker.deploymentCommitSha,
    expectedRepositorySha,
    "worker.deploymentCommitSha",
    reasons,
  );
  if (snapshot.production.workerNames.includes(worker.name)) {
    addReason(reasons, "staging worker name must not be classified as a production worker");
  }
  validateWorkerBindings(worker, expectedRole, snapshot, plan, reasons);

  return {
    kind: "worker",
    name,
    action: reasons.length === 0 ? "reuse" : "blocked",
    reasons,
  };
}


function crossResourceReasons(
  snapshot: StagingInventorySnapshotV1,
  plan: RuntimeProvisioningPlanV1,
): string[] {
  const reasons: string[] = [];
  const databases = matching(snapshot.databases, plan.shadow.database.name);
  const sourceQueues = matching(snapshot.queues, plan.shadow.queue.name);
  const dlqs = matching(snapshot.queues, plan.shadow.queue.deadLetterQueue);
  const eventWorkers = matching(snapshot.workers, plan.shadow.eventsWorker);
  const ingestWorkers = matching(snapshot.workers, plan.shadow.ingestWorker);

  const database = databases.length === 1 ? databases[0] : null;
  const sourceQueue = sourceQueues.length === 1 ? sourceQueues[0] : null;
  const dlq = dlqs.length === 1 ? dlqs[0] : null;
  const eventWorker = eventWorkers.length === 1 ? eventWorkers[0] : null;
  const ingestWorker = ingestWorkers.length === 1 ? ingestWorkers[0] : null;

  if (sourceQueue && sourceQueue.deadLetterQueue === plan.shadow.queue.deadLetterQueue && !dlq) {
    addReason(reasons, "source queue references planned DLQ but complete inventory says the DLQ is absent");
  }

  if (eventWorker) {
    for (const binding of eventWorker.d1Bindings) {
      if (binding.databaseName !== plan.shadow.database.name) continue;
      if (!database) {
        addReason(reasons, "events worker references planned staging database but complete inventory says it is absent");
      } else if (binding.databaseId !== database.id) {
        addReason(reasons, "events worker D1 binding ID must match inventoried staging database ID");
      }
    }

    for (const binding of eventWorker.queueConsumerBindings) {
      if (binding.queueName !== plan.shadow.queue.name) continue;
      if (!sourceQueue) {
        addReason(reasons, "events worker references planned staging queue but complete inventory says it is absent");
      } else if (binding.queueId !== sourceQueue.id) {
        addReason(reasons, "events worker queue binding ID must match inventoried staging queue ID");
      }
    }
  }

  if (ingestWorker) {
    for (const binding of ingestWorker.queueProducerBindings) {
      if (binding.queueName !== plan.shadow.queue.name) continue;
      if (!sourceQueue) {
        addReason(reasons, "ingest worker references planned staging queue but complete inventory says it is absent");
      } else if (binding.queueId !== sourceQueue.id) {
        addReason(reasons, "ingest worker queue binding ID must match inventoried staging queue ID");
      }
    }
  }

  if (sourceQueue?.consumers.length === 1) {
    if (!eventWorker) {
      addReason(reasons, "source queue has an events-staging consumer but complete worker inventory says events-staging is absent");
    } else {
      const workerBindings = eventWorker.queueConsumerBindings.filter(
        (binding) => binding.queueName === plan.shadow.queue.name,
      );
      if (workerBindings.length !== 1) {
        addReason(reasons, "source queue consumer and events worker queue binding must agree");
      }
    }
  }

  if (
    sourceQueue?.consumers.length === 0
    && eventWorker?.queueConsumerBindings.some(
      (binding) => binding.queueName === plan.shadow.queue.name,
    )
  ) {
    addReason(reasons, "events worker queue binding exists while source queue inventory has no consumer");
  }

  return reasons;
}

function globalReasons(
  plan: RuntimeProvisioningPlanV1,
  snapshot: StagingInventorySnapshotV1,
  expectedAccountId: string,
  expectedRepositorySha: string,
  nowMs: number,
): string[] {
  const reasons = validateRuntimeProvisioningPlanV1(plan).map((reason) => `plan.${reason}`);

  if (snapshot.schemaVersion !== 1) addReason(reasons, "snapshot.schemaVersion must equal 1");
  if (!nonEmpty(expectedAccountId)) addReason(reasons, "expectedAccountId must be known");
  if (snapshot.accountId !== expectedAccountId) addReason(reasons, "snapshot.accountId does not match expected account");
  if (!nonEmpty(expectedRepositorySha)) addReason(reasons, "expectedRepositorySha must be known");

  const observedAtMs = Date.parse(snapshot.observedAt);
  if (!Number.isFinite(observedAtMs)) {
    addReason(reasons, "snapshot.observedAt must be a valid timestamp");
  } else {
    if (observedAtMs > nowMs + CLOCK_SKEW_MS) {
      addReason(reasons, "snapshot.observedAt must not be in the future");
    }
    if (nowMs - observedAtMs > MAX_STAGING_PREFLIGHT_AGE_MS) {
      addReason(reasons, "snapshot.observedAt is too old for provisioning preflight");
    }
  }

  for (const [field, value] of Object.entries(snapshot.coverage)) {
    if (value !== "complete") addReason(reasons, `coverage.${field} must equal complete`);
  }

  requireEqual(
    snapshot.controlPlane.mechanism,
    "secrets_store_edge_proxy",
    "controlPlane.mechanism",
    reasons,
  );
  requireEqual(
    snapshot.controlPlane.credentialClass,
    "CLOUDFLARE_API_TOKEN_W1",
    "controlPlane.credentialClass",
    reasons,
  );
  requireEqual(
    snapshot.controlPlane.serverSideOnly,
    true,
    "controlPlane.serverSideOnly",
    reasons,
  );
  requireEqual(
    snapshot.controlPlane.credentialValueExported,
    false,
    "controlPlane.credentialValueExported",
    reasons,
  );
  requireEqual(
    snapshot.controlPlane.permissionsVerified,
    true,
    "controlPlane.permissionsVerified",
    reasons,
  );

  return reasons;
}

export function evaluateStagingProvisioningPreflightV1(
  plan: RuntimeProvisioningPlanV1,
  snapshot: StagingInventorySnapshotV1,
  expectedAccountId: string,
  expectedRepositorySha: string,
  nowMs = Date.now(),
): StagingPreflightResultV1 {
  const reasons = globalReasons(
    plan,
    snapshot,
    expectedAccountId,
    expectedRepositorySha,
    nowMs,
  );
  for (const reason of crossResourceReasons(snapshot, plan)) addReason(reasons, reason);
  const resources: StagingPreflightResourceDecisionV1[] = [
    databaseDecision(
      snapshot,
      plan.shadow.database.name,
      plan.shadow.database.jurisdiction,
      plan.shadow.database.readReplication,
    ),
    dlqDecision(snapshot, plan.shadow.queue.deadLetterQueue),
    sourceQueueDecision(snapshot, plan),
    workerDecision(snapshot, plan, "events", expectedRepositorySha),
    workerDecision(snapshot, plan, "ingest", expectedRepositorySha),
  ];

  for (const resource of resources) {
    for (const reason of resource.reasons) {
      addReason(reasons, `${resource.kind}:${resource.name}: ${reason}`);
    }
  }

  if (reasons.length > 0) {
    return {
      ready: false,
      reasons,
      resources: resources.map((resource) => ({
        ...resource,
        action: "blocked",
        reasons: resource.reasons.length > 0
          ? resource.reasons
          : ["global preflight requirements are not satisfied"],
      })),
    };
  }

  return { ready: true, reasons: [], resources };
}
