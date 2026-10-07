import { WorkerEntrypoint } from "cloudflare:workers";
import type {
  VerifiedShadowDeliveryResultV1,
  VerifiedShadowDeliveryV1,
} from "../../../packages/observability-contracts/src/index.ts";
import { acceptVerifiedShadowDelivery } from "./shadow.ts";
import type { IngestEnv } from "./types.ts";

export class VerifiedShadowIngressService extends WorkerEntrypoint<IngestEnv> {
  async acceptVerifiedDelivery(
    delivery: VerifiedShadowDeliveryV1,
  ): Promise<VerifiedShadowDeliveryResultV1> {
    return acceptVerifiedShadowDelivery(this.env, delivery);
  }
}
