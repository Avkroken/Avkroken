# Events staging provisioning preflight v1

This is the repository seam for the **read-only inventory phase** before the first
Ingest → Events staging resources are created.

The pure evaluator does not call Cloudflare and never provisions or mutates anything.
The operator-only runner in `../control-plane/staging-preflight-runner.ts` composes
the named read-only proxy, Cloudflare reader, collector and evaluator without adding
any provider-write operation.

Live execution is bounded by the machine-validated
[`../live-preflight-deployment.v1.json`](../live-preflight-deployment.v1.json) and
the [live preflight deployment gate](live-preflight-deployment-gate.md).
That separate gate requires explicit approval to deploy the temporary private
inventory proxy, local operator access through the named remote Service Binding,
and mandatory proxy deletion plus route/residual-binding verification after the
run. The plan itself performs no deployment or staging provisioning.

## Decision semantics

Each planned staging resource is classified as:

- `create` — the complete live inventory proves that the exact planned name is absent;
- `reuse` — exactly one existing resource with that name has confirmed ownership and
  satisfies the allowed staging configuration;
- `blocked` — inventory is stale/incomplete, identity is ambiguous, production state is
  reused, ownership is unproven, or configuration drifts from the v1 plan.

Any global or resource-specific blocker makes the overall result `ready: false`
and forces all resource actions to `blocked`.

**`ready: true` means only that the inventory is internally safe to enter the
separate provisioning gate. It is not authorization to execute control-plane writes.**

## Freshness and coverage

The snapshot must:

- be schema version 1;
- target the explicitly expected Cloudflare account, with that identity read back
  from the same provider-backed proxy used for resource inventory;
- be no older than 15 minutes;
- have complete D1, Queue, Worker, control-plane and production provider-destination coverage;
- confirm that GitHub, Cloudflare Notifications, Workers Issues and CASB destinations remain unchanged.

Every required coverage category is checked explicitly. A missing serialized
coverage key therefore fails closed rather than being interpreted as proof of
resource absence.

Partial, unavailable or unknown coverage fails closed.

The snapshot must be refreshed and re-evaluated before each create-operation in
the provisioning sequence; a previous `ready` result is not a lease over future
provider state.

## Control-plane evidence

The current v1 preflight expects the existing repository-documented mechanism:

- mechanism: `secrets_store_edge_proxy`;
- credential class: `CLOUDFLARE_API_TOKEN_W1`;
- credential remains server-side;
- credential value was not exported;
- required provisioning permissions were verified.

Only the class/boundary is represented. A credential value must never be placed
in the snapshot, repository, logs or PR.

## Planned staging resources

The exact names/settings still come from `../runtime-provisioning.v1.json`:

- D1: `avkroken-events-preview-eu`;
- source Queue: `avkroken-ingest-events-preview-v1`;
- DLQ: `avkroken-ingest-events-preview-v1-dlq`;
- Workers: `events-staging`, `ingest-staging`.

If the D1 already exists it must have confirmed ownership, EU jurisdiction,
read replication disabled and a non-production ID.

If the source Queue already exists it must have confirmed ownership and seven-day
retention. Before the consumer exists, the Queue may have zero consumers and no DLQ
relationship yet. Once the consumer exists it must be exactly the planned
`events-staging` consumer with batch 10 / timeout 1 s / retries 5 and the exact
staging DLQ. Cloudflare models DLQ on the consumer, not on the Queue resource.

An existing DLQ must have confirmed ownership, no chained DLQ and no consumer
before shadow activation.

Existing staging Workers must:

- have confirmed ownership;
- resolve the active deployment and require a single serving version with the
  exact expected repository commit; gradual/multi-version deployment blocks reuse;
- derive Worker binding evidence from that active version, not from an unrelated
  latest-upload/settings view;
- expose no public routes during shadowing;
- bind no secrets or plain-text vars in this v1 staging shape;
- have no unplanned KV/R2/service/other bindings or scheduled/runtime triggers;
- never bind a production D1 or Queue;
- bind the exact live staging D1/Queue IDs reported by the same complete inventory;
- agree with the Queue-side consumer inventory;
- have only the bounded role-appropriate staging bindings.

## Production isolation

The snapshot supplies the live IDs/names currently classified as production.
The evaluator rejects any staging D1/Queue binding that reuses those IDs and
rejects a planned staging Worker name classified as production.

Resource IDs are configuration evidence, not authentication secrets. They still
must come from live inventory and must never be guessed.

## Next phase

After a passing snapshot is recorded, the separate operational provisioning gate
may be considered. That gate is responsible for explicit approval, creation,
migration application, consumer configuration and post-create verification.

Skvallerbyttan remains provider-facing and canonical throughout this preflight.


## Operator report

`runStagingProvisioningPreflightV1()` returns a sanitized report containing
`ready`, reasons, per-resource `create|reuse|blocked` decisions, coverage,
collection errors, account identity, timestamps and inventory/evidence counts.

The report intentionally does not return production resource ID lists, provider
payload bodies, credential values or secret/plaintext binding values.

A passing report remains evidence for a separate provisioning decision. It is
not authorization to create, update, deploy or delete Cloudflare resources.
