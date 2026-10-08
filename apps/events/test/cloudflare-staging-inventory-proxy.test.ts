import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  CloudflareControlPlaneReadError,
  CloudflareStagingInventoryProxyServiceV1,
  type CloudflareReadFetchV1,
} from "../control-plane/cloudflare-staging-inventory-proxy.ts";

const ACCOUNT_ID = "a".repeat(32);
const TOKEN = "w1-secret-value-that-must-never-leak";

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function success(result: unknown, result_info?: unknown): Response {
  return jsonResponse({
    success: true,
    errors: [],
    messages: [],
    result,
    ...(result_info === undefined ? {} : { result_info }),
  });
}

function service(
  fetcher: CloudflareReadFetchV1,
  timeout = 1_000,
): CloudflareStagingInventoryProxyServiceV1 {
  return new CloudflareStagingInventoryProxyServiceV1(
    {
      CLOUDFLARE_ACCOUNT_ID: ACCOUNT_ID,
      CLOUDFLARE_API_TOKEN_W1: { get: async () => TOKEN },
    },
    { fetcher, requestTimeoutMs: timeout },
  );
}

test("proxy only emits GET requests and keeps W1 server-side", async () => {
  const requests: Request[] = [];
  const proxy = service(async (input, init) => {
    const request = new Request(input, init);
    requests.push(request);
    return success([]);
  });

  assert.deepEqual(await proxy.listWorkers(), []);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].method, "GET");
  assert.equal(requests[0].headers.get("authorization"), `Bearer ${TOKEN}`);
  assert.equal(JSON.stringify(await proxy.listWorkers()).includes(TOKEN), false);
});

test("D1 pagination is complete and detail is allowlisted to the planned staging DB", async () => {
  const urls: string[] = [];
  const proxy = service(async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    urls.push(url.pathname + url.search);
    if (url.pathname.endsWith("/d1/database") && url.searchParams.get("page") === "1") {
      return success(
        [{ name: "avkroken-events-preview-eu", uuid: "stage-db", jurisdiction: "eu", ignored: TOKEN }],
        { page: 1, per_page: 1000, total_count: 2 },
      );
    }
    if (url.pathname.endsWith("/d1/database") && url.searchParams.get("page") === "2") {
      return success(
        [{ name: "other", uuid: "other-db", jurisdiction: "eu" }],
        { page: 2, per_page: 1000, total_count: 2 },
      );
    }
    if (url.pathname.endsWith("/d1/database/stage-db")) {
      return success({
        name: "avkroken-events-preview-eu",
        uuid: "stage-db",
        jurisdiction: "eu",
        read_replication: { mode: "disabled", ignored: TOKEN },
        ignored: TOKEN,
      });
    }
    throw new Error("unexpected request");
  });

  const databases = await proxy.listD1Databases();
  assert.equal(Array.isArray(databases), true);
  assert.equal(JSON.stringify(databases).includes(TOKEN), false);
  assert.deepEqual(await proxy.getD1Database("stage-db"), {
    name: "avkroken-events-preview-eu",
    uuid: "stage-db",
    jurisdiction: "eu",
    read_replication: { mode: "disabled" },
  });
  await assert.rejects(
    () => proxy.getD1Database("other-db"),
    (error: unknown) =>
      error instanceof CloudflareControlPlaneReadError
      && error.code === "not_allowlisted",
  );
  assert.ok(urls.some((url) => url.includes("page=2")));
});

test("Queue list fallback pagination is completed and consumer reads are allowlisted", async () => {
  const consumerCalls: string[] = [];
  const proxy = service(async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    if (url.pathname.endsWith("/queues") && !url.searchParams.has("page")) {
      return success(
        [{
          queue_name: "avkroken-ingest-events-preview-v1",
          queue_id: "stage-queue",
          settings: { message_retention_period: 604800 },
        }],
        { page: 1, per_page: 1, total_count: 2, total_pages: 2 },
      );
    }
    if (url.pathname.endsWith("/queues") && url.searchParams.get("page") === "2") {
      return success(
        [{
          queue_name: "unrelated",
          queue_id: "other-queue",
          settings: { message_retention_period: 604800 },
        }],
        { page: 2, per_page: 1, total_count: 2, total_pages: 2 },
      );
    }
    if (url.pathname.endsWith("/queues/stage-queue/consumers")) {
      consumerCalls.push(url.pathname);
      return success([{
        type: "worker",
        script_name: "events-staging",
        dead_letter_queue: "avkroken-ingest-events-preview-v1-dlq",
        settings: {
          batch_size: 10,
          max_wait_time_ms: 1000,
          max_retries: 5,
          ignored: TOKEN,
        },
        ignored: TOKEN,
      }]);
    }
    throw new Error("unexpected request");
  });

  const queues = await proxy.listQueues();
  assert.equal((queues as unknown[]).length, 2);
  const consumers = await proxy.listQueueConsumers("stage-queue");
  assert.equal(JSON.stringify(consumers).includes(TOKEN), false);
  assert.deepEqual(consumers, [{
    type: "worker",
    script_name: "events-staging",
    dead_letter_queue: "avkroken-ingest-events-preview-v1-dlq",
    settings: {
      batch_size: 10,
      max_wait_time_ms: 1000,
      max_retries: 5,
    },
  }]);
  await assert.rejects(
    () => proxy.listQueueConsumers("other-queue"),
    (error: unknown) =>
      error instanceof CloudflareControlPlaneReadError
      && error.code === "not_allowlisted",
  );
  assert.deepEqual(consumerCalls, [
    `/client/v4/accounts/${ACCOUNT_ID}/queues/stage-queue/consumers`,
  ]);
});

test("worker inspection is named, complete, and sanitizes binding values", async () => {
  const seenMethods: string[] = [];
  const proxy = service(async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    seenMethods.push(request.method);
    const path = url.pathname;

    if (path.endsWith("/workers/workers")) {
      return success(
        [{ id: "worker-id", name: "events-staging", ignored: TOKEN }],
        { page: 1, per_page: 100, total_count: 1 },
      );
    }
    if (path.endsWith("/workers/workers/worker-id")) {
      return success({
        id: "worker-id",
        name: "events-staging",
        subdomain: { enabled: false, previews_enabled: false },
        references: {
          queues: [{
            queue_id: "stage-queue",
            queue_name: "avkroken-ingest-events-preview-v1",
            ignored: TOKEN,
          }],
        },
        ignored: TOKEN,
      });
    }
    if (path.endsWith("/workers/scripts/events-staging/schedules")) {
      return success({ schedules: [{ cron: "*/5 * * * *", ignored: TOKEN }] });
    }
    if (path.endsWith("/workers/domains")) {
      return success([{
        service: "events-staging",
        hostname: "events-staging.example.test",
        ignored: TOKEN,
      }], { page: 1, per_page: 20, total_count: 1, total_pages: 1 });
    }
    if (path === "/client/v4/zones") {
      return success([{
        id: "zone-id",
        account: { id: ACCOUNT_ID },
        ignored: TOKEN,
      }], { page: 1, per_page: 50, total_count: 1, total_pages: 1 });
    }
    if (path.endsWith("/zones/zone-id/workers/routes")) {
      return success([
        { pattern: "example.test/events/*", script: "events-staging", ignored: TOKEN },
        { pattern: "example.test/other/*", script: "other-worker" },
      ]);
    }
    throw new Error(`unexpected ${path}`);
  });

  const inspected = await proxy.inspectPlannedWorker("events-staging");
  assert.ok(seenMethods.every((method) => method === "GET"));
  assert.equal(JSON.stringify(inspected).includes(TOKEN), false);
  assert.deepEqual(inspected, {
    worker: {
      name: "events-staging",
      subdomain: { enabled: false, previews_enabled: false },
      references: {
        domains: [{ hostname: "events-staging.example.test" }],
        queues: [{
          queue_id: "stage-queue",
          queue_name: "avkroken-ingest-events-preview-v1",
        }],
      },
    },
    schedules: { schedules: [{ cron: "*/5 * * * *" }] },
    routes: ["example.test/events/*"],
  });
});

test("arbitrary worker names are rejected before any provider call", async () => {
  let called = false;
  const proxy = service(async () => {
    called = true;
    return success([]);
  });

  await assert.rejects(
    () => proxy.inspectPlannedWorker("skvallerbyttan" as "events-staging"),
    (error: unknown) =>
      error instanceof CloudflareControlPlaneReadError
      && error.code === "not_allowlisted",
  );
  assert.equal(called, false);
});

test("provider errors are sanitized and never include response bodies", async () => {
  const proxy = service(async () => jsonResponse({
    success: false,
    errors: [{ message: `sensitive ${TOKEN}` }],
  }, 403));

  await assert.rejects(
    async () => proxy.listWorkers(),
    (error: unknown) => {
      assert.ok(error instanceof CloudflareControlPlaneReadError);
      assert.equal(error.code, "http_403");
      assert.equal(String(error).includes(TOKEN), false);
      assert.equal(String(error).includes("sensitive"), false);
      return true;
    },
  );
});

test("request timeout is bounded and sanitized", async () => {
  const proxy = service(
    async (_input, init) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new Error(`aborted ${TOKEN}`)));
    }),
    5,
  );

  await assert.rejects(
    () => proxy.listWorkers(),
    (error: unknown) =>
      error instanceof CloudflareControlPlaneReadError
      && error.code === "network"
      && !String(error).includes(TOKEN),
  );
});

test("timeout remains active while reading a hanging response body", async () => {
  const proxy = service(
    async (_input, init) => new Response(new ReadableStream<Uint8Array>({
      start(controller) {
        init?.signal?.addEventListener("abort", () => {
          controller.error(new Error(`body ${TOKEN}`));
        }, { once: true });
      },
    }), { status: 200 }),
    5,
  );

  await assert.rejects(
    () => proxy.listWorkers(),
    (error: unknown) =>
      error instanceof CloudflareControlPlaneReadError
      && error.code === "body_read"
      && !String(error).includes(TOKEN),
  );
});

test("control-plane service contains no provider write HTTP verbs and entrypoint stays thin", async () => {
  const [source, entrypoint] = await Promise.all([
    readFile(
      new URL("../control-plane/cloudflare-staging-inventory-proxy.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../control-plane/cloudflare-staging-inventory-proxy-entrypoint.ts", import.meta.url),
      "utf8",
    ),
  ]);
  assert.doesNotMatch(source, /method:\s*["'](?:POST|PUT|PATCH|DELETE)["']/);
  assert.match(source, /method:\s*"GET"/);
  assert.match(entrypoint, /extends WorkerEntrypoint/);
  assert.doesNotMatch(entrypoint, /fetch\s*\(/);
  assert.doesNotMatch(entrypoint, /https:\/\/api\.cloudflare\.com/);
});

test("credential lookup failures are sanitized before network access", async () => {
  let called = false;
  const proxy = new CloudflareStagingInventoryProxyServiceV1(
    {
      CLOUDFLARE_ACCOUNT_ID: ACCOUNT_ID,
      CLOUDFLARE_API_TOKEN_W1: {
        get: async () => { throw new Error(`secret-store ${TOKEN}`); },
      },
    },
    {
      fetcher: async () => {
        called = true;
        return success([]);
      },
    },
  );

  await assert.rejects(
    () => proxy.listD1Databases(),
    (error: unknown) =>
      error instanceof CloudflareControlPlaneReadError
      && error.code === "credential_unavailable"
      && !String(error).includes(TOKEN),
  );
  assert.equal(called, false);
});


test("Worker pagination fails closed when provider count metadata is inconsistent", async () => {
  const proxy = service(async () => success(
    [{ id: "worker-id", name: "events-staging" }],
    { page: 1, per_page: 100, total_count: 2, total_pages: 1 },
  ));

  await assert.rejects(
    () => proxy.listWorkers(),
    (error: unknown) =>
      error instanceof CloudflareControlPlaneReadError
      && error.code === "pagination_incomplete",
  );
});


test("missing schedule inventory fails closed", async () => {
  const proxy = service(async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    const path = url.pathname;

    if (path.endsWith("/workers/workers")) {
      return success([{ id: "worker-id", name: "events-staging" }]);
    }
    if (path.endsWith("/workers/workers/worker-id")) {
      return success({ name: "events-staging", references: {} });
    }
    if (path.endsWith("/workers/scripts/events-staging/schedules")) {
      return success({});
    }
    if (path.endsWith("/workers/domains")) {
      return success([]);
    }
    if (path === "/client/v4/zones") {
      return success([]);
    }
    throw new Error(`unexpected ${path}`);
  });

  await assert.rejects(
    () => proxy.inspectPlannedWorker("events-staging"),
    (error: unknown) =>
      error instanceof CloudflareControlPlaneReadError
      && error.code === "invalid_shape",
  );
});


test("response body limit is enforced while streaming", async () => {
  let pulls = 0;
  const proxy = service(async () => new Response(new ReadableStream<Uint8Array>({
    pull(controller) {
      pulls += 1;
      if (pulls === 1) {
        controller.enqueue(new Uint8Array(2_000_001));
        return;
      }
      throw new Error(`body should have been cancelled ${TOKEN}`);
    },
  }), { status: 200, headers: { "content-type": "application/json" } }));

  await assert.rejects(
    () => proxy.listWorkers(),
    (error: unknown) =>
      error instanceof CloudflareControlPlaneReadError
      && error.code === "response_too_large"
      && !String(error).includes(TOKEN),
  );
  assert.ok(pulls <= 2);
});


test("account identity is provider-bound and sanitized", async () => {
  const proxy = service(async (input) => {
    const url = new URL(String(input));
    assert.equal(url.pathname, `/client/v4/accounts/${ACCOUNT_ID}`);
    return success({ id: ACCOUNT_ID, name: TOKEN, settings: { secret: TOKEN } });
  });

  const identity = await proxy.getAccountIdentity();
  assert.deepEqual(identity, { id: ACCOUNT_ID });
  assert.equal(JSON.stringify(identity).includes(TOKEN), false);
});

test("active Worker deployment resolves every serving version without leaking metadata", async () => {
  const proxy = service(async (input) => {
    const url = new URL(String(input));
    const path = url.pathname;
    if (path.endsWith("/workers/workers")) {
      return success(
        [{ id: "worker-id", name: "events-staging" }],
        { page: 1, per_page: 100, total_count: 1, total_pages: 1 },
      );
    }
    if (path.endsWith("/workers/scripts/events-staging/deployments")) {
      return success({
        deployments: [{
          id: "deployment-id",
          versions: [
            { version_id: "version-a", percentage: 60 },
            { version_id: "version-b", percentage: 40 },
          ],
          annotations: { "workers/message": TOKEN },
        }],
      });
    }
    if (path.endsWith("/workers/workers/worker-id/versions/version-a")) {
      return success({
        id: "version-a",
        annotations: {
          "workers/commit_sha": "a".repeat(40),
          "workers/message": TOKEN,
        },
        bindings: [{ type: "secret_text", name: "ACTIVE_SECRET", text: TOKEN }],
        ignored: TOKEN,
      });
    }
    if (path.endsWith("/workers/workers/worker-id/versions/version-b")) {
      return success({
        id: "version-b",
        annotations: {
          "workers/commit_sha": "b".repeat(40),
          "workers/message": TOKEN,
        },
        bindings: [],
        ignored: TOKEN,
      });
    }
    throw new Error(`unexpected ${path}`);
  });

  const deployment = await proxy.getActiveWorkerDeployment("events-staging");
  assert.deepEqual(deployment, {
    versions: [
      {
        version_id: "version-a",
        percentage: 60,
        commit_sha: "a".repeat(40),
        bindings: [{ type: "secret_text", name: "ACTIVE_SECRET" }],
      },
      {
        version_id: "version-b",
        percentage: 40,
        commit_sha: "b".repeat(40),
        bindings: [],
      },
    ],
  });
  assert.equal(JSON.stringify(deployment).includes(TOKEN), false);
});
