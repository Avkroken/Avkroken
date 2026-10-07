import type { RuntimeProvisioningPlanV1 } from "./runtime-gate.ts";
import type {
  ProviderDatabaseInventoryV1,
  ProviderQueueConsumerInventoryV1,
  ProviderQueueInventoryV1,
  ProviderWorkerInspectionV1,
  ProviderWorkerInventoryV1,
  StagingInventoryReadPortV1,
} from "./staging-inventory-collector.ts";

type UnknownRecord = Record<string, unknown>;

export type CloudflareWorkerInspectionPayloadV1 = {
  worker: unknown;
  settings: unknown;
  schedules: unknown;
  routes: unknown;
};

export interface CloudflareStagingInventoryProxyV1 {
  listD1Databases(): Promise<unknown>;
  getD1Database(databaseId: string): Promise<unknown>;
  listQueues(): Promise<unknown>;
  listQueueConsumers(queueId: string): Promise<unknown>;
  listWorkers(): Promise<unknown>;
  inspectPlannedWorker(
    workerName: "events-staging" | "ingest-staging",
  ): Promise<CloudflareWorkerInspectionPayloadV1>;
}

export class CloudflareInventoryShapeError extends Error {
  constructor(readonly field: string) {
    super(`invalid Cloudflare staging inventory: ${field}`);
    this.name = "CloudflareInventoryShapeError";
  }
}

function record(value: unknown, field: string): UnknownRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new CloudflareInventoryShapeError(field);
  }
  return value as UnknownRecord;
}

function array(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) throw new CloudflareInventoryShapeError(field);
  return value;
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new CloudflareInventoryShapeError(field);
  }
  return value.trim();
}

function optionalString(value: unknown, field: string): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string") throw new CloudflareInventoryShapeError(field);
  const normalized = value.trim();
  return normalized || null;
}

function optionalNumber(value: unknown, field: string): number | null {
  if (value == null) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new CloudflareInventoryShapeError(field);
  }
  return value;
}

function optionalBoolean(value: unknown, field: string): boolean | null {
  if (value == null) return null;
  if (typeof value !== "boolean") throw new CloudflareInventoryShapeError(field);
  return value;
}

function directArrayResult(value: unknown, field: string): unknown[] {
  return array(value, field);
}

function workerName(value: unknown, field: string): string {
  return requiredString(record(value, field).name, `${field}.name`);
}

function plannedWorkerName(
  plan: RuntimeProvisioningPlanV1,
  value: string,
): "events-staging" | "ingest-staging" {
  if (value === plan.shadow.eventsWorker && value === "events-staging") return value;
  if (value === plan.shadow.ingestWorker && value === "ingest-staging") return value;
  throw new CloudflareInventoryShapeError("worker.name");
}

function annotationCommitSha(settings: UnknownRecord): string | null {
  const annotations = settings.annotations;
  if (annotations == null) return null;
  const values = record(annotations, "worker.settings.annotations");
  const commit = optionalString(values["workers/commit_sha"], "worker.settings.annotations.workers/commit_sha");
  if (commit !== null && !/^[0-9a-f]{40,64}$/i.test(commit)) {
    throw new CloudflareInventoryShapeError("worker.settings.annotations.workers/commit_sha");
  }
  return commit;
}

export class CloudflareStagingInventoryReaderV1 implements StagingInventoryReadPortV1 {
  private databaseListPromise?: Promise<ProviderDatabaseInventoryV1[]>;
  private queueListPromise?: Promise<ProviderQueueInventoryV1[]>;

  constructor(
    private readonly plan: RuntimeProvisioningPlanV1,
    private readonly proxy: CloudflareStagingInventoryProxyV1,
  ) {}

  private async loadDatabases(): Promise<ProviderDatabaseInventoryV1[]> {
    if (this.databaseListPromise) return this.databaseListPromise;
    this.databaseListPromise = (async () => {
      const raw = directArrayResult(await this.proxy.listD1Databases(), "d1.list");
      const parsed = raw.map((value, index) => {
        const item = record(value, `d1.list[${index}]`);
        return {
          name: requiredString(item.name, `d1.list[${index}].name`),
          id: requiredString(item.uuid, `d1.list[${index}].uuid`),
          jurisdiction: optionalString(item.jurisdiction, `d1.list[${index}].jurisdiction`),
          readReplication: null,
        } satisfies ProviderDatabaseInventoryV1;
      });

      const planned = parsed.find((item) => item.name === this.plan.shadow.database.name);
      if (!planned) return parsed;

      const detail = record(await this.proxy.getD1Database(planned.id), "d1.detail");
      const detailId = requiredString(detail.uuid, "d1.detail.uuid");
      const detailName = requiredString(detail.name, "d1.detail.name");
      if (detailId !== planned.id || detailName !== planned.name) {
        throw new CloudflareInventoryShapeError("d1.detail.identity");
      }
      const replication = detail.read_replication == null
        ? null
        : optionalString(
            record(detail.read_replication, "d1.detail.read_replication").mode,
            "d1.detail.read_replication.mode",
          );
      return parsed.map((item) => item.id === planned.id ? {
        ...item,
        jurisdiction: optionalString(detail.jurisdiction, "d1.detail.jurisdiction"),
        readReplication: replication,
      } : item);
    })();
    return this.databaseListPromise;
  }

  async listDatabases(): Promise<ProviderDatabaseInventoryV1[]> {
    return this.loadDatabases();
  }

  private async loadQueues(): Promise<ProviderQueueInventoryV1[]> {
    if (this.queueListPromise) return this.queueListPromise;
    this.queueListPromise = (async () => directArrayResult(
      await this.proxy.listQueues(),
      "queues.list",
    ).map((value, index) => {
      const item = record(value, `queues.list[${index}]`);
      const settings = item.settings == null
        ? null
        : record(item.settings, `queues.list[${index}].settings`);
      return {
        name: requiredString(item.queue_name, `queues.list[${index}].queue_name`),
        id: requiredString(item.queue_id, `queues.list[${index}].queue_id`),
        messageRetentionSeconds: settings
          ? optionalNumber(
              settings.message_retention_period,
              `queues.list[${index}].settings.message_retention_period`,
            )
          : null,
      } satisfies ProviderQueueInventoryV1;
    }))();
    return this.queueListPromise;
  }

  async listQueues(): Promise<ProviderQueueInventoryV1[]> {
    return this.loadQueues();
  }

  async listQueueConsumers(queueId: string): Promise<ProviderQueueConsumerInventoryV1[]> {
    if (!queueId.trim()) throw new CloudflareInventoryShapeError("queueId");
    const queues = await this.loadQueues();
    const queue = queues.find((item) => item.id === queueId);
    const allowedNames = new Set([
      this.plan.shadow.queue.name,
      this.plan.shadow.queue.deadLetterQueue,
    ]);
    if (!queue || !allowedNames.has(queue.name)) {
      throw new CloudflareInventoryShapeError("queueId");
    }
    const raw = directArrayResult(
      await this.proxy.listQueueConsumers(queueId),
      "queues.consumers",
    );
    return raw.map((value, index) => {
      const item = record(value, `queues.consumers[${index}]`);
      const type = optionalString(item.type, `queues.consumers[${index}].type`);
      if (type !== null && type !== "worker") {
        throw new CloudflareInventoryShapeError(`queues.consumers[${index}].type`);
      }
      const settings = item.settings == null
        ? {}
        : record(item.settings, `queues.consumers[${index}].settings`);
      const waitMs = optionalNumber(
        settings.max_wait_time_ms,
        `queues.consumers[${index}].settings.max_wait_time_ms`,
      );
      if (waitMs !== null && !Number.isInteger(waitMs)) {
        throw new CloudflareInventoryShapeError(
          `queues.consumers[${index}].settings.max_wait_time_ms`,
        );
      }
      return {
        worker: requiredString(item.script_name, `queues.consumers[${index}].script_name`),
        maxBatchSize: optionalNumber(
          settings.batch_size,
          `queues.consumers[${index}].settings.batch_size`,
        ),
        maxBatchTimeoutSeconds: waitMs === null ? null : waitMs / 1000,
        maxRetries: optionalNumber(
          settings.max_retries,
          `queues.consumers[${index}].settings.max_retries`,
        ),
        deadLetterQueue: optionalString(
          item.dead_letter_queue,
          `queues.consumers[${index}].dead_letter_queue`,
        ),
      };
    });
  }

  async listWorkers(): Promise<ProviderWorkerInventoryV1[]> {
    return directArrayResult(await this.proxy.listWorkers(), "workers.list")
      .map((value, index) => ({
        name: workerName(value, `workers.list[${index}]`),
      }));
  }

  async inspectWorker(name: string): Promise<ProviderWorkerInspectionV1> {
    const allowedName = plannedWorkerName(this.plan, name);
    const payload = await this.proxy.inspectPlannedWorker(allowedName);
    const worker = record(payload.worker, "worker.detail");
    const actualName = requiredString(worker.name, "worker.detail.name");
    if (actualName !== allowedName) throw new CloudflareInventoryShapeError("worker.detail.name");

    const settings = record(payload.settings, "worker.settings");
    const bindings = settings.bindings == null
      ? []
      : array(settings.bindings, "worker.settings.bindings");
    const databases = await this.loadDatabases();
    const queues = await this.loadQueues();
    const databaseById = new Map(databases.map((item) => [item.id, item.name]));
    const queueByName = new Map(queues.map((item) => [item.name, item.id]));

    const secretBindings: string[] = [];
    const plainTextVars: string[] = [];
    const otherBindings: string[] = [];
    const d1Bindings: ProviderWorkerInspectionV1["d1Bindings"] = [];
    const queueProducerBindings: ProviderWorkerInspectionV1["queueProducerBindings"] = [];

    for (let index = 0; index < bindings.length; index += 1) {
      const binding = record(bindings[index], `worker.settings.bindings[${index}]`);
      const type = requiredString(binding.type, `worker.settings.bindings[${index}].type`);
      const bindingName = requiredString(binding.name, `worker.settings.bindings[${index}].name`);

      if (type === "d1") {
        const databaseId = requiredString(
          binding.database_id ?? binding.id,
          `worker.settings.bindings[${index}].database_id`,
        );
        const databaseName = databaseById.get(databaseId);
        if (!databaseName) {
          throw new CloudflareInventoryShapeError(
            `worker.settings.bindings[${index}].database_id`,
          );
        }
        d1Bindings.push({ binding: bindingName, databaseId, databaseName });
        continue;
      }

      if (type === "queue") {
        const queueName = requiredString(
          binding.queue_name,
          `worker.settings.bindings[${index}].queue_name`,
        );
        const queueId = queueByName.get(queueName);
        if (!queueId) {
          throw new CloudflareInventoryShapeError(
            `worker.settings.bindings[${index}].queue_name`,
          );
        }
        queueProducerBindings.push({ binding: bindingName, queueId, queueName });
        continue;
      }

      if (type === "plain_text") {
        plainTextVars.push(bindingName);
        continue;
      }

      if (type === "secret_text" || type === "secrets_store_secret" || type === "secret_key") {
        secretBindings.push(bindingName);
        continue;
      }

      otherBindings.push(`${type}:${bindingName}`);
    }

    const references = worker.references == null
      ? {}
      : record(worker.references, "worker.detail.references");
    const domainValues = references.domains == null
      ? []
      : array(references.domains, "worker.detail.references.domains");
    const queueValues = references.queues == null
      ? []
      : array(references.queues, "worker.detail.references.queues");
    const publicRoutes: string[] = [];

    const subdomain = worker.subdomain == null
      ? null
      : record(worker.subdomain, "worker.detail.subdomain");
    if (subdomain) {
      if (optionalBoolean(subdomain.enabled, "worker.detail.subdomain.enabled") === true) {
        publicRoutes.push("workers.dev");
      }
      if (
        optionalBoolean(
          subdomain.previews_enabled,
          "worker.detail.subdomain.previews_enabled",
        ) === true
      ) {
        publicRoutes.push("preview_urls");
      }
    }

    for (let index = 0; index < domainValues.length; index += 1) {
      const domain = record(domainValues[index], `worker.detail.references.domains[${index}]`);
      publicRoutes.push(
        `custom_domain:${requiredString(
          domain.hostname,
          `worker.detail.references.domains[${index}].hostname`,
        )}`,
      );
    }

    for (const route of directArrayResult(payload.routes, "worker.routes")) {
      publicRoutes.push(`route:${requiredString(route, "worker.routes[]")}`);
    }

    const queueConsumerBindings: ProviderWorkerInspectionV1["queueConsumerBindings"] =
      queueValues.map((value, index) => {
        const queue = record(value, `worker.detail.references.queues[${index}]`);
        return {
          queueId: requiredString(
            queue.queue_id,
            `worker.detail.references.queues[${index}].queue_id`,
          ),
          queueName: requiredString(
            queue.queue_name,
            `worker.detail.references.queues[${index}].queue_name`,
          ),
        };
      });

    const schedules = record(payload.schedules, "worker.schedules");
    const triggerValues = schedules.schedules == null
      ? []
      : array(schedules.schedules, "worker.schedules.schedules");
    const triggers = triggerValues.map((value, index) => {
      const schedule = record(value, `worker.schedules.schedules[${index}]`);
      return `cron:${requiredString(
        schedule.cron,
        `worker.schedules.schedules[${index}].cron`,
      )}`;
    });

    return {
      name: allowedName,
      deploymentCommitSha: annotationCommitSha(settings),
      publicRoutes: [...new Set(publicRoutes)].sort(),
      secretBindings: [...new Set(secretBindings)].sort(),
      plainTextVars: [...new Set(plainTextVars)].sort(),
      otherBindings: [...new Set(otherBindings)].sort(),
      triggers: [...new Set(triggers)].sort(),
      d1Bindings,
      queueProducerBindings,
      queueConsumerBindings,
    };
  }
}
