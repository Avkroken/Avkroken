import type {
  VerifiedShadowDeliveryResultV1,
  VerifiedShadowDeliveryV1,
} from "../../../packages/observability-contracts/src/index.ts";
import { enqueueIngressMessage } from "./handoff.ts";
import {
  githubOwner,
  hasCloudflareIssueIdentity,
  isGenericCloudflareWebhookTest,
  isRetiredGitHubAppWebhook,
  parseObjectJson,
  reduceCloudflareWebhook,
  reduceGitHubWebhook,
} from "./reducers.ts";
import type { IngestEnv } from "./types.ts";

export const MAX_VERIFIED_SHADOW_BODY_BYTES = 1_048_576;

export class InvalidVerifiedShadowDeliveryError extends Error {
  constructor(readonly field: string) {
    super(`invalid verified shadow delivery: ${field}`);
    this.name = "InvalidVerifiedShadowDeliveryError";
  }
}

function requiredString(value: unknown, field: string, max: number): string {
  if (typeof value !== "string") throw new InvalidVerifiedShadowDeliveryError(field);
  const normalized = value.trim();
  if (!normalized || normalized.length > max) throw new InvalidVerifiedShadowDeliveryError(field);
  return normalized;
}

function normalizeReceivedAt(value: unknown): string {
  const raw = requiredString(value, "receivedAt", 64);
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) throw new InvalidVerifiedShadowDeliveryError("receivedAt");
  return new Date(parsed).toISOString();
}

function normalizeBody(value: unknown): string {
  if (typeof value !== "string" || !value) throw new InvalidVerifiedShadowDeliveryError("body");
  if (new TextEncoder().encode(value).byteLength > MAX_VERIFIED_SHADOW_BODY_BYTES) {
    throw new InvalidVerifiedShadowDeliveryError("body.size");
  }
  return value;
}

export function normalizeVerifiedShadowDelivery(value: unknown): VerifiedShadowDeliveryV1 {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new InvalidVerifiedShadowDeliveryError("delivery");
  }
  const input = value as Record<string, unknown>;
  if (input.schemaVersion !== 1) throw new InvalidVerifiedShadowDeliveryError("schemaVersion");
  const kind = requiredString(input.kind, "kind", 40);
  const deliveryId = requiredString(input.deliveryId, "deliveryId", 512);
  const receivedAt = normalizeReceivedAt(input.receivedAt);
  const body = normalizeBody(input.body);

  if (kind === "github") {
    return { schemaVersion: 1, kind: "github", deliveryId, event: requiredString(input.event, "event", 160), receivedAt, body };
  }
  if (kind === "cloudflare") {
    const source = requiredString(input.source, "source", 40);
    if (source !== "notifications" && source !== "issues" && source !== "casb") {
      throw new InvalidVerifiedShadowDeliveryError("source");
    }
    return { schemaVersion: 1, kind: "cloudflare", source, deliveryId, receivedAt, body };
  }
  throw new InvalidVerifiedShadowDeliveryError("kind");
}

export async function acceptVerifiedShadowDelivery(
  env: IngestEnv,
  value: unknown,
): Promise<VerifiedShadowDeliveryResultV1> {
  const delivery = normalizeVerifiedShadowDelivery(value);
  const payload = parseObjectJson(delivery.body);
  if (!payload) throw new InvalidVerifiedShadowDeliveryError("body.json");

  const message = delivery.kind === "github"
    ? (() => {
        if (isRetiredGitHubAppWebhook("", delivery.body)) throw new InvalidVerifiedShadowDeliveryError("github.retired_app");
        const owner = githubOwner(payload);
        const expectedOwner = env.SKVALLERBYTTAN_GITHUB_OWNER?.trim() || "Avkroken";
        if (owner && owner.toLowerCase() !== expectedOwner.toLowerCase()) {
          throw new InvalidVerifiedShadowDeliveryError("github.owner");
        }
        return reduceGitHubWebhook({
          deliveryId: delivery.deliveryId,
          event: delivery.event,
          payload,
          receivedAt: delivery.receivedAt,
        });
      })()
    : await (async () => {
        if (delivery.source === "issues") {
          if (isGenericCloudflareWebhookTest(payload)) throw new InvalidVerifiedShadowDeliveryError("cloudflare.issues.test");
          if (!hasCloudflareIssueIdentity(payload)) throw new InvalidVerifiedShadowDeliveryError("cloudflare.issues.identity");
        }
        return reduceCloudflareWebhook({
          source: delivery.source,
          payload,
          body: delivery.body,
          deliveryId: delivery.deliveryId,
          receivedAt: delivery.receivedAt,
        });
      })();

  await enqueueIngressMessage(env, message);
  return { schemaVersion: 1, accepted: true, messageId: message.messageId, idempotencyKey: message.idempotencyKey };
}
