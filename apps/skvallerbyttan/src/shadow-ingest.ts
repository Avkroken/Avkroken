import type { VerifiedShadowDeliveryV1 } from "../../../packages/observability-contracts/src/index.ts";
import type { Env } from "./env";

export function scheduleVerifiedShadowDelivery(
  env: Env,
  context: ExecutionContext | undefined,
  delivery: VerifiedShadowDeliveryV1,
): boolean {
  const service = env.AVKROKEN_INGEST_SHADOW;
  if (!service || !context) return false;

  const task = service.acceptVerifiedDelivery(delivery)
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
