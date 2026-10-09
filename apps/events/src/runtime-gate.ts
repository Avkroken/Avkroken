export const MIN_STANDARD_SHADOW_HOURS = 72;
export const MIN_LOW_VOLUME_SHADOW_HOURS = 168;
export const STANDARD_VOLUME_EVENTS = 20;
export const MAX_QUEUE_BACKLOG_AGE_SECONDS = 60;
export const MAX_SHADOW_CUTOVER_EVIDENCE_AGE_MS = 15 * 60 * 1000;
const CLOCK_SKEW_MS = 60 * 1000;

export type RuntimeProvisioningPlanV1 = {
  schemaVersion: number;
  status: string;
  cloudflare: {
    accountBinding: string;
    wranglerMinimum: string;
  };
  production: RuntimeTargetV1;
  shadow: RuntimeTargetV1 & {
    mode: string;
    source: {
      canonicalWorker: string;
      serviceBinding: string;
      targetWorker: string;
      entrypoint: string;
      providerSecretsRequired: boolean;
      failSoft: boolean;
    };
  };
};

export type RuntimeTargetV1 = {
  eventsWorker: string;
  ingestWorker: string;
  database: {
    binding: string;
    name: string;
    jurisdiction: string;
    readReplication: string;
    databaseId: string | null;
  };
  queue: {
    producerBinding: string;
    name: string;
    deadLetterQueue: string;
    messageRetentionSeconds: number;
    consumerWorker: string;
    maxBatchSize: number;
    maxBatchTimeoutSeconds: number;
    maxRetries: number;
  };
};

export type ShadowParityEvidenceV1 = {
  schemaVersion: 1;
  generatedAt: string;
  window: {
    from: string;
    to: string;
  };
  provisioning: {
    eventsWorker: string;
    ingestWorker: string;
    databaseName: string;
    databaseJurisdiction: string;
    databaseReadReplication: string;
    migrationsApplied: boolean;
    noPendingMigrations: boolean;
    queueName: string;
    deadLetterQueue: string;
    messageRetentionSeconds: number;
    consumerWorker: string;
    consumerCount: number;
    maxBatchSize: number;
    maxBatchTimeoutSeconds: number;
    maxRetries: number;
    productionDatabaseReferenced: boolean;
    productionQueueReferenced: boolean;
    productionProviderSecretsBound: boolean;
    ingestPublicProviderRouteConfigured: boolean;
    eventsPublicRouteConfigured: boolean;
    shadowServiceBindingTarget: string;
    shadowServiceBindingEntrypoint: string;
  };
  parity: {
    canonicalCount: number;
    shadowCount: number;
    matched: number;
    missingInShadow: number;
    extraInShadow: number;
    contentMismatches: number;
    idempotencyConflicts: number;
    mirrorFailures: number;
  };
  queue: {
    accepted: number;
    inserted: number;
    duplicates: number;
    unresolvedRetries: number;
    dlqCount: number;
    backlogKnown: boolean;
    backlogMessages: number;
    oldestMessageAgeSeconds: number | null;
  };
  backfill: {
    completed: boolean;
    beforeExclusive: string;
    latestImportedReceivedAt: string | null;
    invalidRows: number;
    conflicts: number;
  };
  reads: {
    comparisons: number;
    mismatches: number;
    errors: number;
  };
};

export type ShadowGateResultV1 = {
  pass: boolean;
  reasons: string[];
  actualShadowHours: number;
  requiredShadowHours: number;
};

function finiteNonNegative(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

function parseIso(value: string, field: string, reasons: string[]): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    reasons.push(`${field} must be a valid ISO timestamp`);
    return Number.NaN;
  }
  return parsed;
}

function requireEqual<T>(
  actual: T,
  expected: T,
  field: string,
  reasons: string[],
): void {
  if (actual !== expected) reasons.push(`${field} must equal ${String(expected)}`);
}

export function validateRuntimeProvisioningPlanV1(plan: RuntimeProvisioningPlanV1): string[] {
  const reasons: string[] = [];
  if (plan.schemaVersion !== 1) reasons.push("schemaVersion must be 1");
  if (plan.status !== "planned" && plan.status !== "provisioned") reasons.push("status is invalid");
  if (plan.cloudflare.wranglerMinimum !== "4.135.0") {
    reasons.push("cloudflare.wranglerMinimum must remain 4.135.0");
  }
  if (plan.cloudflare.accountBinding !== "CLOUDFLARE_ACCOUNT_ID") {
    reasons.push("cloudflare.accountBinding must remain CLOUDFLARE_ACCOUNT_ID");
  }

  const validateTarget = (
    target: RuntimeTargetV1,
    expected: {
      eventsWorker: string;
      ingestWorker: string;
      databaseName: string;
      queueName: string;
      dlqName: string;
    },
    prefix: string,
  ) => {
    requireEqual(target.eventsWorker, expected.eventsWorker, `${prefix}.eventsWorker`, reasons);
    requireEqual(target.ingestWorker, expected.ingestWorker, `${prefix}.ingestWorker`, reasons);
    requireEqual(target.database.binding, "EVENTS_DB", `${prefix}.database.binding`, reasons);
    requireEqual(target.database.name, expected.databaseName, `${prefix}.database.name`, reasons);
    requireEqual(target.database.jurisdiction, "eu", `${prefix}.database.jurisdiction`, reasons);
    requireEqual(target.database.readReplication, "disabled", `${prefix}.database.readReplication`, reasons);
    requireEqual(target.queue.producerBinding, "EVENTS_QUEUE", `${prefix}.queue.producerBinding`, reasons);
    requireEqual(target.queue.name, expected.queueName, `${prefix}.queue.name`, reasons);
    requireEqual(target.queue.deadLetterQueue, expected.dlqName, `${prefix}.queue.deadLetterQueue`, reasons);
    requireEqual(target.queue.messageRetentionSeconds, 604800, `${prefix}.queue.messageRetentionSeconds`, reasons);
    requireEqual(target.queue.consumerWorker, expected.eventsWorker, `${prefix}.queue.consumerWorker`, reasons);
    requireEqual(target.queue.maxBatchSize, 10, `${prefix}.queue.maxBatchSize`, reasons);
    requireEqual(target.queue.maxBatchTimeoutSeconds, 1, `${prefix}.queue.maxBatchTimeoutSeconds`, reasons);
    requireEqual(target.queue.maxRetries, 5, `${prefix}.queue.maxRetries`, reasons);
  };

  validateTarget(plan.production, {
    eventsWorker: "events",
    ingestWorker: "ingest",
    databaseName: "avkroken-events-eu",
    queueName: "avkroken-ingest-events-v1",
    dlqName: "avkroken-ingest-events-v1-dlq",
  }, "production");

  validateTarget(plan.shadow, {
    eventsWorker: "events-staging",
    ingestWorker: "ingest-staging",
    databaseName: "avkroken-events-preview-eu",
    queueName: "avkroken-ingest-events-preview-v1",
    dlqName: "avkroken-ingest-events-preview-v1-dlq",
  }, "shadow");

  requireEqual(plan.shadow.mode, "persistent_staging_environment", "shadow.mode", reasons);
  requireEqual(plan.shadow.source.canonicalWorker, "skvallerbyttan", "shadow.source.canonicalWorker", reasons);
  requireEqual(plan.shadow.source.serviceBinding, "AVKROKEN_INGEST_SHADOW", "shadow.source.serviceBinding", reasons);
  requireEqual(plan.shadow.source.targetWorker, "ingest-staging", "shadow.source.targetWorker", reasons);
  requireEqual(plan.shadow.source.entrypoint, "VerifiedShadowIngressService", "shadow.source.entrypoint", reasons);
  requireEqual(plan.shadow.source.providerSecretsRequired, false, "shadow.source.providerSecretsRequired", reasons);
  requireEqual(plan.shadow.source.failSoft, true, "shadow.source.failSoft", reasons);

  return reasons;
}

/** Evaluate parity and freshness against the operator's current clock before cutover. */
export function evaluateShadowCutoverGateV1(
  plan: RuntimeProvisioningPlanV1,
  evidence: ShadowParityEvidenceV1,
  now = Date.now(),
): ShadowGateResultV1 {
  const reasons = validateRuntimeProvisioningPlanV1(plan);
  if (evidence.schemaVersion !== 1) reasons.push("evidence.schemaVersion must be 1");

  const from = parseIso(evidence.window.from, "window.from", reasons);
  const to = parseIso(evidence.window.to, "window.to", reasons);
  const generatedAt = parseIso(evidence.generatedAt, "generatedAt", reasons);
  if (!Number.isFinite(now)) {
    reasons.push("now must be a valid timestamp");
  } else {
    for (const [field, timestamp] of [["generatedAt", generatedAt], ["window.to", to]] as const) {
      if (!Number.isFinite(timestamp)) continue;
      if (timestamp > now + CLOCK_SKEW_MS) reasons.push(`${field} is in the future`);
      if (now - timestamp > MAX_SHADOW_CUTOVER_EVIDENCE_AGE_MS) reasons.push(`${field} is stale`);
    }
  }

  const actualShadowHours = Number.isFinite(from) && Number.isFinite(to)
    ? Math.max(0, (to - from) / 3_600_000)
    : 0;
  if (Number.isFinite(from) && Number.isFinite(to) && from >= to) {
    reasons.push("window.to must be after window.from");
  }
  if (Number.isFinite(generatedAt) && Number.isFinite(to) && generatedAt < to) {
    reasons.push("generatedAt must not be before window.to");
  }

  const canonicalCount = evidence.parity.canonicalCount;
  const requiredShadowHours = canonicalCount >= STANDARD_VOLUME_EVENTS
    ? MIN_STANDARD_SHADOW_HOURS
    : MIN_LOW_VOLUME_SHADOW_HOURS;

  if (canonicalCount <= 0) reasons.push("shadow window must contain at least one canonical event");
  if (actualShadowHours < requiredShadowHours) {
    reasons.push(`shadow window must be at least ${requiredShadowHours} hours for this volume`);
  }

  for (const [field, value] of Object.entries(evidence.parity)) {
    if (!finiteNonNegative(value)) reasons.push(`parity.${field} must be a non-negative finite number`);
  }
  requireEqual(evidence.parity.shadowCount, canonicalCount, "parity.shadowCount", reasons);
  requireEqual(evidence.parity.matched, canonicalCount, "parity.matched", reasons);
  requireEqual(evidence.parity.missingInShadow, 0, "parity.missingInShadow", reasons);
  requireEqual(evidence.parity.extraInShadow, 0, "parity.extraInShadow", reasons);
  requireEqual(evidence.parity.contentMismatches, 0, "parity.contentMismatches", reasons);
  requireEqual(evidence.parity.idempotencyConflicts, 0, "parity.idempotencyConflicts", reasons);
  requireEqual(evidence.parity.mirrorFailures, 0, "parity.mirrorFailures", reasons);

  const target = plan.shadow;
  requireEqual(evidence.provisioning.eventsWorker, target.eventsWorker, "provisioning.eventsWorker", reasons);
  requireEqual(evidence.provisioning.ingestWorker, target.ingestWorker, "provisioning.ingestWorker", reasons);
  requireEqual(evidence.provisioning.databaseName, target.database.name, "provisioning.databaseName", reasons);
  requireEqual(evidence.provisioning.databaseJurisdiction, "eu", "provisioning.databaseJurisdiction", reasons);
  requireEqual(
    evidence.provisioning.databaseReadReplication,
    target.database.readReplication,
    "provisioning.databaseReadReplication",
    reasons,
  );
  requireEqual(evidence.provisioning.migrationsApplied, true, "provisioning.migrationsApplied", reasons);
  requireEqual(evidence.provisioning.noPendingMigrations, true, "provisioning.noPendingMigrations", reasons);
  requireEqual(evidence.provisioning.queueName, target.queue.name, "provisioning.queueName", reasons);
  requireEqual(evidence.provisioning.deadLetterQueue, target.queue.deadLetterQueue, "provisioning.deadLetterQueue", reasons);
  requireEqual(evidence.provisioning.messageRetentionSeconds, target.queue.messageRetentionSeconds, "provisioning.messageRetentionSeconds", reasons);
  requireEqual(evidence.provisioning.consumerWorker, target.queue.consumerWorker, "provisioning.consumerWorker", reasons);
  requireEqual(evidence.provisioning.consumerCount, 1, "provisioning.consumerCount", reasons);
  requireEqual(evidence.provisioning.maxBatchSize, target.queue.maxBatchSize, "provisioning.maxBatchSize", reasons);
  requireEqual(evidence.provisioning.maxBatchTimeoutSeconds, target.queue.maxBatchTimeoutSeconds, "provisioning.maxBatchTimeoutSeconds", reasons);
  requireEqual(evidence.provisioning.maxRetries, target.queue.maxRetries, "provisioning.maxRetries", reasons);
  requireEqual(evidence.provisioning.productionDatabaseReferenced, false, "provisioning.productionDatabaseReferenced", reasons);
  requireEqual(evidence.provisioning.productionQueueReferenced, false, "provisioning.productionQueueReferenced", reasons);
  requireEqual(evidence.provisioning.productionProviderSecretsBound, false, "provisioning.productionProviderSecretsBound", reasons);
  requireEqual(evidence.provisioning.ingestPublicProviderRouteConfigured, false, "provisioning.ingestPublicProviderRouteConfigured", reasons);
  requireEqual(evidence.provisioning.eventsPublicRouteConfigured, false, "provisioning.eventsPublicRouteConfigured", reasons);
  requireEqual(
    evidence.provisioning.shadowServiceBindingTarget,
    plan.shadow.source.targetWorker,
    "provisioning.shadowServiceBindingTarget",
    reasons,
  );
  requireEqual(
    evidence.provisioning.shadowServiceBindingEntrypoint,
    plan.shadow.source.entrypoint,
    "provisioning.shadowServiceBindingEntrypoint",
    reasons,
  );

  for (const [field, value] of Object.entries(evidence.queue)) {
    if (field === "backlogKnown" || field === "oldestMessageAgeSeconds") continue;
    if (!finiteNonNegative(value as number)) reasons.push(`queue.${field} must be a non-negative finite number`);
  }
  requireEqual(evidence.queue.backlogKnown, true, "queue.backlogKnown", reasons);
  requireEqual(evidence.queue.unresolvedRetries, 0, "queue.unresolvedRetries", reasons);
  requireEqual(evidence.queue.dlqCount, 0, "queue.dlqCount", reasons);
  requireEqual(evidence.queue.inserted, canonicalCount, "queue.inserted", reasons);
  requireEqual(
    evidence.queue.inserted + evidence.queue.duplicates,
    evidence.queue.accepted,
    "queue.inserted+duplicates",
    reasons,
  );
  if (evidence.queue.backlogMessages === 0) {
    if (evidence.queue.oldestMessageAgeSeconds !== null && evidence.queue.oldestMessageAgeSeconds !== 0) {
      reasons.push("queue.oldestMessageAgeSeconds must be null or 0 when backlog is empty");
    }
  } else if (
    evidence.queue.oldestMessageAgeSeconds === null ||
    !finiteNonNegative(evidence.queue.oldestMessageAgeSeconds) ||
    evidence.queue.oldestMessageAgeSeconds > MAX_QUEUE_BACKLOG_AGE_SECONDS
  ) {
    reasons.push(`queue.oldestMessageAgeSeconds must be <= ${MAX_QUEUE_BACKLOG_AGE_SECONDS} when backlog exists`);
  }

  requireEqual(evidence.backfill.completed, true, "backfill.completed", reasons);
  requireEqual(evidence.backfill.invalidRows, 0, "backfill.invalidRows", reasons);
  requireEqual(evidence.backfill.conflicts, 0, "backfill.conflicts", reasons);
  const boundary = parseIso(evidence.backfill.beforeExclusive, "backfill.beforeExclusive", reasons);
  if (Number.isFinite(from) && Number.isFinite(boundary) && boundary !== from) {
    reasons.push("backfill.beforeExclusive must equal shadow window start");
  }
  if (evidence.backfill.latestImportedReceivedAt !== null) {
    const latest = parseIso(evidence.backfill.latestImportedReceivedAt, "backfill.latestImportedReceivedAt", reasons);
    if (Number.isFinite(latest) && Number.isFinite(boundary) && latest >= boundary) {
      reasons.push("backfill.latestImportedReceivedAt must be before cutover boundary");
    }
  }

  if (!finiteNonNegative(evidence.reads.comparisons) || evidence.reads.comparisons <= 0) {
    reasons.push("reads.comparisons must be greater than zero");
  }
  requireEqual(evidence.reads.comparisons, canonicalCount, "reads.comparisons", reasons);
  requireEqual(evidence.reads.mismatches, 0, "reads.mismatches", reasons);
  requireEqual(evidence.reads.errors, 0, "reads.errors", reasons);

  return {
    pass: reasons.length === 0,
    reasons,
    actualShadowHours,
    requiredShadowHours,
  };
}
