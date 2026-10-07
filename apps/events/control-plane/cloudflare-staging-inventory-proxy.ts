import { WorkerEntrypoint } from "cloudflare:workers";
import type {
  CloudflareStagingInventoryProxyV1,
  CloudflareWorkerInspectionPayloadV1,
} from "../src/cloudflare-staging-inventory-reader.ts";

const CLOUDFLARE_API_BASE = "https://api.cloudflare.com/client/v4";
const PLANNED_D1_NAME = "avkroken-events-preview-eu";
const PLANNED_QUEUE_NAMES = new Set([
  "avkroken-ingest-events-preview-v1",
  "avkroken-ingest-events-preview-v1-dlq",
]);
const PLANNED_WORKER_NAMES = new Set(["events-staging", "ingest-staging"]);
const MAX_RESPONSE_BYTES = 2_000_000;
const MAX_PAGES = 100;
const MAX_LIST_ITEMS = 5_000;
const MAX_ZONE_ROUTE_SCAN = 100;
const DEFAULT_TIMEOUT_MS = 5_000;
const ZONE_ROUTE_CONCURRENCY = 4;

type UnknownRecord = Record<string, unknown>;

export interface SecretsStoreSecretBindingV1 {
  get(): Promise<string>;
}

export interface CloudflareStagingInventoryProxyEnvV1 {
  CLOUDFLARE_ACCOUNT_ID: string;
  CLOUDFLARE_API_TOKEN_W1: SecretsStoreSecretBindingV1;
}

export type CloudflareReadFetchV1 = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export type CloudflareStagingInventoryProxyOptionsV1 = {
  fetcher?: CloudflareReadFetchV1;
  requestTimeoutMs?: number;
};

export class CloudflareControlPlaneReadError extends Error {
  constructor(
    readonly operation: string,
    readonly code: string,
  ) {
    super(`Cloudflare control-plane read failed: ${operation}:${code}`);
    this.name = "CloudflareControlPlaneReadError";
  }
}

function record(value: unknown, operation: string): UnknownRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new CloudflareControlPlaneReadError(operation, "invalid_shape");
  }
  return value as UnknownRecord;
}

function array(value: unknown, operation: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new CloudflareControlPlaneReadError(operation, "invalid_shape");
  }
  return value;
}

function string(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function number(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

function boolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function resultInfo(value: unknown): UnknownRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as UnknownRecord
    : null;
}

function sanitizeD1ListItem(value: unknown): UnknownRecord {
  const item = record(value, "d1.list");
  return {
    name: item.name,
    uuid: item.uuid,
    jurisdiction: item.jurisdiction ?? null,
  };
}

function sanitizeD1Detail(value: unknown): UnknownRecord {
  const item = record(value, "d1.detail");
  const replication = item.read_replication == null
    ? null
    : record(item.read_replication, "d1.detail.read_replication");
  return {
    name: item.name,
    uuid: item.uuid,
    jurisdiction: item.jurisdiction ?? null,
    read_replication: replication ? { mode: replication.mode ?? null } : null,
  };
}

function sanitizeQueue(value: unknown): UnknownRecord {
  const item = record(value, "queues.list");
  const settings = item.settings == null
    ? null
    : record(item.settings, "queues.list.settings");
  return {
    queue_name: item.queue_name,
    queue_id: item.queue_id,
    settings: settings
      ? { message_retention_period: settings.message_retention_period ?? null }
      : null,
  };
}

function sanitizeConsumer(value: unknown): UnknownRecord {
  const item = record(value, "queues.consumers");
  const settings = item.settings == null
    ? null
    : record(item.settings, "queues.consumers.settings");
  return {
    type: item.type ?? null,
    script_name: item.script_name ?? null,
    dead_letter_queue: item.dead_letter_queue ?? null,
    settings: settings
      ? {
          batch_size: settings.batch_size ?? null,
          max_wait_time_ms: settings.max_wait_time_ms ?? null,
          max_retries: settings.max_retries ?? null,
        }
      : null,
  };
}

function sanitizeWorkerListItem(value: unknown): UnknownRecord {
  const item = record(value, "workers.list");
  return {
    id: item.id,
    name: item.name,
  };
}

function sanitizeBinding(value: unknown): UnknownRecord {
  const binding = record(value, "worker.settings.binding");
  const type = string(binding.type);
  const name = string(binding.name);
  const result: UnknownRecord = { type, name };
  if (type === "d1") {
    result.database_id = binding.database_id ?? binding.id ?? null;
  } else if (type === "queue") {
    result.queue_name = binding.queue_name ?? null;
  }
  return result;
}

function sanitizeWorkerDetail(
  value: unknown,
  domains: unknown[],
): UnknownRecord {
  const worker = record(value, "worker.detail");
  const subdomain = worker.subdomain == null
    ? null
    : record(worker.subdomain, "worker.detail.subdomain");
  const references = worker.references == null
    ? {}
    : record(worker.references, "worker.detail.references");
  const queues = references.queues == null
    ? []
    : array(references.queues, "worker.detail.references.queues").map((value) => {
        const queue = record(value, "worker.detail.references.queues[]");
        return {
          queue_id: queue.queue_id ?? null,
          queue_name: queue.queue_name ?? null,
        };
      });

  return {
    name: worker.name,
    subdomain: subdomain
      ? {
          enabled: boolean(subdomain.enabled),
          previews_enabled: boolean(subdomain.previews_enabled),
        }
      : null,
    references: {
      domains,
      queues,
    },
  };
}

function sanitizeSettings(value: unknown): UnknownRecord {
  const settings = record(value, "worker.settings");
  const annotations = settings.annotations == null
    ? {}
    : record(settings.annotations, "worker.settings.annotations");
  const bindings = settings.bindings == null
    ? []
    : array(settings.bindings, "worker.settings.bindings").map(sanitizeBinding);

  return {
    annotations: {
      "workers/commit_sha": annotations["workers/commit_sha"] ?? null,
    },
    bindings,
  };
}

function sanitizeSchedules(value: unknown): UnknownRecord {
  const schedule = record(value, "worker.schedules");
  const schedules = schedule.schedules == null
    ? []
    : array(schedule.schedules, "worker.schedules.schedules").map((value) => {
        const item = record(value, "worker.schedules.schedules[]");
        return { cron: item.cron ?? null };
      });
  return { schedules };
}

export class CloudflareStagingInventoryProxyServiceV1
implements CloudflareStagingInventoryProxyV1 {
  private readonly fetcher: CloudflareReadFetchV1;
  private readonly requestTimeoutMs: number;
  private readonly accountId: string;

  constructor(
    private readonly env: CloudflareStagingInventoryProxyEnvV1,
    options: CloudflareStagingInventoryProxyOptionsV1 = {},
  ) {
    this.fetcher = options.fetcher ?? fetch;
    this.requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_TIMEOUT_MS;
    const accountId = env.CLOUDFLARE_ACCOUNT_ID?.trim() ?? "";
    if (!/^[A-Za-z0-9_-]{1,32}$/.test(accountId)) {
      throw new CloudflareControlPlaneReadError("config", "invalid_account_id");
    }
    if (
      !Number.isFinite(this.requestTimeoutMs)
      || this.requestTimeoutMs < 1
      || this.requestTimeoutMs > 30_000
    ) {
      throw new CloudflareControlPlaneReadError("config", "invalid_timeout");
    }
    this.accountId = accountId;
  }

  private async token(operation: string): Promise<string> {
    try {
      const value = (await this.env.CLOUDFLARE_API_TOKEN_W1.get()).trim();
      if (!value || value.length > 8_192) {
        throw new Error("invalid secret");
      }
      return value;
    } catch {
      throw new CloudflareControlPlaneReadError(operation, "credential_unavailable");
    }
  }

  private async getEnvelope(
    token: string,
    operation: string,
    path: string,
    query: URLSearchParams = new URLSearchParams(),
  ): Promise<{ result: unknown; resultInfo: UnknownRecord | null }> {
    const url = new URL(`${CLOUDFLARE_API_BASE}${path}`);
    query.forEach((value, key) => url.searchParams.append(key, value));

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.requestTimeoutMs);
    try {
      let response: Response;
      try {
        response = await this.fetcher(url, {
          method: "GET",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        });
      } catch {
        throw new CloudflareControlPlaneReadError(operation, "network");
      }

      if (!response.ok) {
        throw new CloudflareControlPlaneReadError(operation, `http_${response.status}`);
      }

      const declaredLength = Number(response.headers.get("content-length"));
      if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
        throw new CloudflareControlPlaneReadError(operation, "response_too_large");
      }

      let body: string;
      try {
        body = await response.text();
      } catch {
        throw new CloudflareControlPlaneReadError(operation, "body_read");
      }
      if (new TextEncoder().encode(body).byteLength > MAX_RESPONSE_BYTES) {
        throw new CloudflareControlPlaneReadError(operation, "response_too_large");
      }

      let parsed: UnknownRecord;
      try {
        parsed = record(JSON.parse(body), operation);
      } catch (error) {
        if (error instanceof CloudflareControlPlaneReadError) throw error;
        throw new CloudflareControlPlaneReadError(operation, "invalid_json");
      }
      if (parsed.success !== true || !Object.prototype.hasOwnProperty.call(parsed, "result")) {
        throw new CloudflareControlPlaneReadError(operation, "provider_failure");
      }
      return {
        result: parsed.result,
        resultInfo: resultInfo(parsed.result_info),
      };
    } finally {
      clearTimeout(timer);
    }
  }

  private async pagedArray(
    token: string,
    operation: string,
    path: string,
    perPage: number,
    baseQuery: URLSearchParams = new URLSearchParams(),
  ): Promise<unknown[]> {
    const collected: unknown[] = [];
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const query = new URLSearchParams(baseQuery);
      query.set("page", String(page));
      query.set("per_page", String(perPage));
      const envelope = await this.getEnvelope(token, operation, path, query);
      const items = array(envelope.result, operation);
      collected.push(...items);
      if (collected.length > MAX_LIST_ITEMS) {
        throw new CloudflareControlPlaneReadError(operation, "too_many_items");
      }
      const info = envelope.resultInfo;
      const totalPages = number(info?.total_pages);
      const totalCount = number(info?.total_count);
      if (totalPages !== null) {
        if (page >= totalPages) return collected;
      } else if (totalCount !== null) {
        if (collected.length >= totalCount) return collected;
      } else if (items.length < perPage) {
        return collected;
      } else {
        throw new CloudflareControlPlaneReadError(operation, "pagination_unknown");
      }
    }
    throw new CloudflareControlPlaneReadError(operation, "page_limit");
  }

  private async singlePageArray(
    token: string,
    operation: string,
    path: string,
  ): Promise<unknown[]> {
    const first = await this.getEnvelope(token, operation, path);
    const items = array(first.result, operation);
    if (items.length > MAX_LIST_ITEMS) {
      throw new CloudflareControlPlaneReadError(operation, "too_many_items");
    }
    const info = first.resultInfo;
    const totalPages = number(info?.total_pages);
    const totalCount = number(info?.total_count);
    if ((totalPages ?? 1) <= 1 && (totalCount === null || totalCount <= items.length)) {
      return items;
    }

    const perPage = number(info?.per_page);
    const currentPage = number(info?.page) ?? 1;
    if (perPage === null || perPage < 1 || currentPage !== 1) {
      throw new CloudflareControlPlaneReadError(operation, "pagination_unknown");
    }

    const collected = [...items];
    const pages = totalPages ?? Math.ceil((totalCount ?? items.length) / perPage);
    if (pages > MAX_PAGES) {
      throw new CloudflareControlPlaneReadError(operation, "page_limit");
    }
    for (let page = 2; page <= pages; page += 1) {
      const query = new URLSearchParams({
        page: String(page),
        per_page: String(perPage),
      });
      const envelope = await this.getEnvelope(token, operation, path, query);
      collected.push(...array(envelope.result, operation));
      if (collected.length > MAX_LIST_ITEMS) {
        throw new CloudflareControlPlaneReadError(operation, "too_many_items");
      }
    }
    if (totalCount !== null && collected.length < totalCount) {
      throw new CloudflareControlPlaneReadError(operation, "pagination_incomplete");
    }
    return collected;
  }

  private async listD1WithToken(token: string): Promise<unknown[]> {
    const items = await this.pagedArray(
      token,
      "d1.list",
      `/accounts/${encodeURIComponent(this.accountId)}/d1/database`,
      1_000,
    );
    return items.map(sanitizeD1ListItem);
  }

  async listD1Databases(): Promise<unknown> {
    return this.listD1WithToken(await this.token("d1.list"));
  }

  async getD1Database(databaseId: string): Promise<unknown> {
    const token = await this.token("d1.detail");
    const databases = await this.listD1WithToken(token);
    const planned = databases
      .map((value) => record(value, "d1.list"))
      .find((value) => string(value.name) === PLANNED_D1_NAME);
    if (!planned || string(planned.uuid) !== databaseId) {
      throw new CloudflareControlPlaneReadError("d1.detail", "not_allowlisted");
    }
    const envelope = await this.getEnvelope(
      token,
      "d1.detail",
      `/accounts/${encodeURIComponent(this.accountId)}/d1/database/${encodeURIComponent(databaseId)}`,
    );
    return sanitizeD1Detail(envelope.result);
  }

  private async listQueuesWithToken(token: string): Promise<unknown[]> {
    return (await this.singlePageArray(
      token,
      "queues.list",
      `/accounts/${encodeURIComponent(this.accountId)}/queues`,
    )).map(sanitizeQueue);
  }

  async listQueues(): Promise<unknown> {
    return this.listQueuesWithToken(await this.token("queues.list"));
  }

  async listQueueConsumers(queueId: string): Promise<unknown> {
    const token = await this.token("queues.consumers");
    const queues = await this.listQueuesWithToken(token);
    const allowed = queues
      .map((value) => record(value, "queues.list"))
      .find((value) =>
        string(value.queue_id) === queueId
        && PLANNED_QUEUE_NAMES.has(string(value.queue_name) ?? "")
      );
    if (!allowed) {
      throw new CloudflareControlPlaneReadError("queues.consumers", "not_allowlisted");
    }
    const envelope = await this.getEnvelope(
      token,
      "queues.consumers",
      `/accounts/${encodeURIComponent(this.accountId)}/queues/${encodeURIComponent(queueId)}/consumers`,
    );
    return array(envelope.result, "queues.consumers").map(sanitizeConsumer);
  }

  private async listWorkersWithToken(token: string): Promise<unknown[]> {
    const items = await this.pagedArray(
      token,
      "workers.list",
      `/accounts/${encodeURIComponent(this.accountId)}/workers/workers`,
      100,
      new URLSearchParams({ order_by: "name", order: "asc" }),
    );
    return items.map(sanitizeWorkerListItem);
  }

  async listWorkers(): Promise<unknown> {
    return this.listWorkersWithToken(await this.token("workers.list"));
  }

  private async listDomainsWithToken(token: string): Promise<unknown[]> {
    return this.singlePageArray(
      token,
      "workers.domains",
      `/accounts/${encodeURIComponent(this.accountId)}/workers/domains`,
    );
  }

  private async listZonesWithToken(token: string): Promise<unknown[]> {
    return this.pagedArray(
      token,
      "zones.list",
      "/zones",
      50,
      new URLSearchParams({ "account.id": this.accountId }),
    );
  }

  private async routesForWorker(
    token: string,
    workerName: string,
  ): Promise<string[]> {
    const zones = await this.listZonesWithToken(token);
    if (zones.length > MAX_ZONE_ROUTE_SCAN) {
      throw new CloudflareControlPlaneReadError("workers.routes", "too_many_zones");
    }

    const patterns: string[] = [];
    for (let offset = 0; offset < zones.length; offset += ZONE_ROUTE_CONCURRENCY) {
      const batch = zones.slice(offset, offset + ZONE_ROUTE_CONCURRENCY);
      const results = await Promise.all(batch.map(async (value) => {
        const zone = record(value, "zones.list");
        const zoneId = string(zone.id);
        if (!zoneId) {
          throw new CloudflareControlPlaneReadError("zones.list", "invalid_shape");
        }
        const envelope = await this.getEnvelope(
          token,
          "workers.routes",
          `/zones/${encodeURIComponent(zoneId)}/workers/routes`,
        );
        return array(envelope.result, "workers.routes");
      }));
      for (const routes of results) {
        for (const value of routes) {
          const route = record(value, "workers.routes");
          if (string(route.script) === workerName) {
            const pattern = string(route.pattern);
            if (!pattern) {
              throw new CloudflareControlPlaneReadError("workers.routes", "invalid_shape");
            }
            patterns.push(pattern);
          }
        }
      }
    }
    return [...new Set(patterns)].sort();
  }

  async inspectPlannedWorker(
    workerName: "events-staging" | "ingest-staging",
  ): Promise<CloudflareWorkerInspectionPayloadV1> {
    if (!PLANNED_WORKER_NAMES.has(workerName)) {
      throw new CloudflareControlPlaneReadError("worker.inspect", "not_allowlisted");
    }

    const token = await this.token("worker.inspect");
    const workers = await this.listWorkersWithToken(token);
    const workerSummary = workers
      .map((value) => record(value, "workers.list"))
      .find((value) => string(value.name) === workerName);
    const workerId = string(workerSummary?.id);
    if (!workerId) {
      throw new CloudflareControlPlaneReadError("worker.inspect", "not_found");
    }

    const account = encodeURIComponent(this.accountId);
    const script = encodeURIComponent(workerName);
    const [detailEnvelope, settingsEnvelope, schedulesEnvelope, domains, routes] =
      await Promise.all([
        this.getEnvelope(
          token,
          "worker.detail",
          `/accounts/${account}/workers/workers/${encodeURIComponent(workerId)}`,
        ),
        this.getEnvelope(
          token,
          "worker.settings",
          `/accounts/${account}/workers/scripts/${script}/settings`,
        ),
        this.getEnvelope(
          token,
          "worker.schedules",
          `/accounts/${account}/workers/scripts/${script}/schedules`,
        ),
        this.listDomainsWithToken(token),
        this.routesForWorker(token, workerName),
      ]);

    const domainReferences = domains
      .map((value) => record(value, "workers.domains"))
      .filter((value) => string(value.service) === workerName)
      .map((value) => ({ hostname: value.hostname ?? null }));

    return {
      worker: sanitizeWorkerDetail(detailEnvelope.result, domainReferences),
      settings: sanitizeSettings(settingsEnvelope.result),
      schedules: sanitizeSchedules(schedulesEnvelope.result),
      routes,
    };
  }
}


export class CloudflareStagingInventoryProxyEntrypoint
extends WorkerEntrypoint<CloudflareStagingInventoryProxyEnvV1>
implements CloudflareStagingInventoryProxyV1 {
  private service(): CloudflareStagingInventoryProxyServiceV1 {
    return new CloudflareStagingInventoryProxyServiceV1(this.env);
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
