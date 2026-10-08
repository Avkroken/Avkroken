import {
  CloudflareStagingInventoryReaderV1,
  type CloudflareStagingInventoryProxyV1,
} from "../src/cloudflare-staging-inventory-reader.ts";
import {
  collectStagingInventorySnapshotV1,
  type StagingInventoryEvidenceV1,
} from "../src/staging-inventory-collector.ts";
import {
  evaluateStagingProvisioningPreflightV1,
  type StagingInventorySnapshotV1,
  type StagingPreflightResourceDecisionV1,
} from "../src/staging-preflight.ts";
import type { RuntimeProvisioningPlanV1 } from "../src/runtime-gate.ts";

export type StagingPreflightRunnerEvidenceV1 = Omit<
  StagingInventoryEvidenceV1,
  "observedAt" | "accountId"
>;

export type StagingPreflightRunnerInputV1 = {
  plan: RuntimeProvisioningPlanV1;
  proxy: CloudflareStagingInventoryProxyV1;
  evidence: StagingPreflightRunnerEvidenceV1;
  expectedAccountId: string;
  expectedRepositorySha: string;
  nowMs?: number;
};

export type StagingPreflightOperatorReportV1 = {
  schemaVersion: 1;
  observedAt: string;
  evaluatedAt: string;
  accountId: string;
  ready: boolean;
  reasons: string[];
  resources: StagingPreflightResourceDecisionV1[];
  coverage: StagingInventorySnapshotV1["coverage"];
  collectionErrors: string[];
  inventoryCounts: {
    databases: number;
    queues: number;
    workers: number;
  };
  evidence: {
    providerDestinations: StagingInventorySnapshotV1["providerDestinations"];
    controlPlane: StagingInventorySnapshotV1["controlPlane"];
    productionCounts: {
      databases: number;
      queues: number;
      workers: number;
    };
    ownershipCounts: {
      databases: number;
      queues: number;
      workers: number;
    };
  };
};

function copyResources(
  resources: readonly StagingPreflightResourceDecisionV1[],
): StagingPreflightResourceDecisionV1[] {
  return resources.map((resource) => ({
    kind: resource.kind,
    name: resource.name,
    action: resource.action,
    reasons: [...resource.reasons],
  }));
}

export async function runStagingProvisioningPreflightV1(
  input: StagingPreflightRunnerInputV1,
): Promise<StagingPreflightOperatorReportV1> {
  const nowMs = input.nowMs ?? Date.now();
  if (!Number.isFinite(nowMs)) {
    throw new TypeError("nowMs must be finite");
  }

  const observedAt = new Date(nowMs).toISOString();
  const reader = new CloudflareStagingInventoryReaderV1(input.plan, input.proxy);
  const collection = await collectStagingInventorySnapshotV1(
    input.plan,
    reader,
    {
      ...input.evidence,
      observedAt,
      accountId: input.expectedAccountId,
    },
  );
  const decision = evaluateStagingProvisioningPreflightV1(
    input.plan,
    collection.snapshot,
    input.expectedAccountId,
    input.expectedRepositorySha,
    nowMs,
  );

  return {
    schemaVersion: 1,
    observedAt: collection.snapshot.observedAt,
    evaluatedAt: new Date(nowMs).toISOString(),
    accountId: collection.snapshot.accountId,
    ready: decision.ready,
    reasons: [...decision.reasons],
    resources: copyResources(decision.resources),
    coverage: { ...collection.snapshot.coverage },
    collectionErrors: [...collection.errors],
    inventoryCounts: {
      databases: collection.snapshot.databases.length,
      queues: collection.snapshot.queues.length,
      workers: collection.snapshot.workers.length,
    },
    evidence: {
      providerDestinations: { ...collection.snapshot.providerDestinations },
      controlPlane: { ...collection.snapshot.controlPlane },
      productionCounts: {
        databases: input.evidence.production.databaseIds.length,
        queues: input.evidence.production.queueIds.length,
        workers: input.evidence.production.workerNames.length,
      },
      ownershipCounts: {
        databases: input.evidence.ownership.databaseIds.length,
        queues: input.evidence.ownership.queueIds.length,
        workers: input.evidence.ownership.workerNames.length,
      },
    },
  };
}
