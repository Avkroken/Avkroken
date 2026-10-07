import type { VerifiedShadowDeliveryV1 } from "../../../packages/observability-contracts/src/index.ts";
import type { Env } from "./env";

export const SHADOW_INGEST_TIMEOUT_MS = 2_000;

function withTimeout<T>(promise: Promise<T>, timeoutMs = SHADOW_INGEST_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("shadow ingest timeout")), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  });
}

export function scheduleVerifiedShadowDelivery(
  env: Env,
  context: ExecutionContext | undefined,
  delivery: VerifiedShadowDeliveryV1,
): boolean {
  const service = env.AVKROKEN_INGEST_SHADOW;
  if (!service || !context) return false;

  const task = Promise.resolve()
    .then(() => withTimeout(Promise.resolve(service.acceptVerifiedDelivery(delivery))))
    .then((result) => {
      if (!result?.accepted) {
        console.error("shadow ingest delivery was not accepted", {
          kind: delivery.kind,
          deliveryId: delivery.deliveryId,
        });
      }
    })
    .catch(() => {
      console.error("shadow ingest delivery failed", {
        kind: delivery.kind,
        deliveryId: delivery.deliveryId,
      });
    });

  try {
    context.waitUntil(task);
    return true;
  } catch {
    console.error("shadow ingest scheduling failed", {
      kind: delivery.kind,
      deliveryId: delivery.deliveryId,
    });
    return false;
  }
}
