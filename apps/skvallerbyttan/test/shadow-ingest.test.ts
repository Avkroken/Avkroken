import assert from "node:assert/strict";
import test from "node:test";
import type {
  VerifiedShadowDeliveryResultV1,
  VerifiedShadowDeliveryV1,
} from "../../../packages/observability-contracts/src/index.ts";
import type { Env } from "../src/env";
import { handleGitHubWebhook } from "../src/webhook";
import { scheduleVerifiedShadowDelivery } from "../src/shadow-ingest";

class FakeStatement {
  params: unknown[] = [];
  constructor(
    readonly sql: string,
    private readonly db: FakeDb,
  ) {}
  bind(...values: unknown[]): FakeStatement {
    this.params = values;
    return this;
  }
  async run() {
    this.db.statements.push(this);
    const changes = this.sql.includes("webhook_deliveries")
      ? this.db.webhookChanges
      : 1;
    return { success: true, meta: { changes }, results: [] };
  }
}

class FakeDb {
  readonly statements: FakeStatement[] = [];
  webhookChanges = 1;
  prepare(sql: string): FakeStatement {
    return new FakeStatement(sql, this);
  }
  async batch(statements: FakeStatement[]) {
    for (const statement of statements) this.statements.push(statement);
    return statements.map(() => ({ success: true, meta: { changes: 1 }, results: [] }));
  }
}

class WaitUntilCapture {
  readonly tasks: Promise<unknown>[] = [];
  waitUntil(task: Promise<unknown>): void {
    this.tasks.push(task);
  }
}

async function signature(body: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(body)));
  return `sha256=${[...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function githubRequest(body: string, signatureValue: string): Request {
  return new Request("https://skvallerbyttan.invalid/webhooks/github", {
    method: "POST",
    headers: {
      "x-github-event": "workflow_run",
      "x-github-delivery": "delivery-shadow",
      "x-hub-signature-256": signatureValue,
    },
    body,
  });
}

function env(
  db: FakeDb,
  shadow?: {
    acceptVerifiedDelivery(delivery: VerifiedShadowDeliveryV1): Promise<VerifiedShadowDeliveryResultV1>;
  },
): Env {
  return {
    STATS_DB: db as unknown as D1Database,
    SKVALLERBYTTAN_WEBHOOK_SECRET: "shadow-secret",
    SKVALLERBYTTAN_GITHUB_OWNER: "Avkroken",
    AVKROKEN_INGEST_SHADOW: shadow,
  } as unknown as Env;
}

test("shadow helper is a no-op without binding or context", () => {
  const delivery: VerifiedShadowDeliveryV1 = {
    schemaVersion: 1,
    kind: "github",
    deliveryId: "delivery",
    event: "push",
    receivedAt: "2026-10-07T12:00:00.000Z",
    body: "{}",
  };
  assert.equal(scheduleVerifiedShadowDelivery({} as Env, undefined, delivery), false);
  assert.equal(
    scheduleVerifiedShadowDelivery(
      { AVKROKEN_INGEST_SHADOW: { acceptVerifiedDelivery: async () => ({ schemaVersion: 1, accepted: true, messageId: "m", idempotencyKey: "k" }) } } as unknown as Env,
      undefined,
      delivery,
    ),
    false,
  );
});

test("shadow helper absorbs synchronous RPC throws", async () => {
  const delivery: VerifiedShadowDeliveryV1 = {
    schemaVersion: 1,
    kind: "github",
    deliveryId: "sync-throw",
    event: "push",
    receivedAt: "2026-10-07T12:00:00.000Z",
    body: "{}",
  };
  const wait = new WaitUntilCapture();
  const errors: unknown[][] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => { errors.push(args); };
  try {
    const scheduled = scheduleVerifiedShadowDelivery(
      {
        AVKROKEN_INGEST_SHADOW: {
          acceptVerifiedDelivery() {
            throw new Error("sensitive-sync-error");
          },
        },
      } as unknown as Env,
      wait as unknown as ExecutionContext,
      delivery,
    );
    assert.equal(scheduled, true);
    await Promise.all(wait.tasks);
  } finally {
    console.error = originalError;
  }
  assert.equal(JSON.stringify(errors).includes("sensitive-sync-error"), false);
});

test("shadow failure does not change GitHub provider response and does not log raw body", async () => {
  const body = JSON.stringify({
    organization: { login: "Avkroken" },
    repository: { name: "Avkroken", owner: { login: "Avkroken" } },
    workflow_run: { id: 42 },
    privateDiagnostic: "raw-sensitive-shadow-body",
  });
  const sig = await signature(body, "shadow-secret");

  const baselineDb = new FakeDb();
  const baseline = await handleGitHubWebhook(githubRequest(body, sig), env(baselineDb));
  const baselineJson = await baseline.json();

  const deliveries: VerifiedShadowDeliveryV1[] = [];
  const shadowDb = new FakeDb();
  const wait = new WaitUntilCapture();
  const errors: unknown[][] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => { errors.push(args); };
  try {
    const response = await handleGitHubWebhook(
      githubRequest(body, sig),
      env(shadowDb, {
        async acceptVerifiedDelivery(delivery) {
          deliveries.push(delivery);
          throw new Error("raw-sensitive-shadow-body");
        },
      }),
      wait as unknown as ExecutionContext,
    );
    assert.equal(response.status, baseline.status);
    assert.deepEqual(await response.json(), baselineJson);
    assert.equal(wait.tasks.length, 1);
    await Promise.all(wait.tasks);
  } finally {
    console.error = originalError;
  }

  assert.equal(deliveries.length, 1);
  const mirrored = deliveries[0];
  assert.equal(mirrored.kind, "github");
  assert.equal(mirrored.deliveryId, "delivery-shadow");
  assert.equal(mirrored.body, body);

  const activityInsert = shadowDb.statements.find((statement) =>
    statement.sql.includes("INSERT OR IGNORE INTO observation_events")
  );
  if (!activityInsert) throw new Error("expected canonical Activity insert");
  assert.equal(activityInsert.params.at(-1), mirrored.receivedAt);

  assert.equal(JSON.stringify(errors).includes("raw-sensitive-shadow-body"), false);
});

test("duplicate legacy delivery is not shadowed", async () => {
  const body = JSON.stringify({
    organization: { login: "Avkroken" },
    repository: { name: "Avkroken", owner: { login: "Avkroken" } },
    workflow_run: { id: 42 },
  });
  const sig = await signature(body, "shadow-secret");
  const db = new FakeDb();
  db.webhookChanges = 0;
  const deliveries: VerifiedShadowDeliveryV1[] = [];
  const wait = new WaitUntilCapture();

  const response = await handleGitHubWebhook(
    githubRequest(body, sig),
    env(db, {
      async acceptVerifiedDelivery(delivery) {
        deliveries.push(delivery);
        return { schemaVersion: 1, accepted: true, messageId: "m", idempotencyKey: "k" };
      },
    }),
    wait as unknown as ExecutionContext,
  );

  assert.equal(response.status, 202);
  assert.deepEqual(await response.json(), { ok: true, duplicate: true });
  assert.equal(deliveries.length, 0);
  assert.equal(wait.tasks.length, 0);
});
