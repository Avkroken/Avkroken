# Events staging provisioning preflight v1

This is the repository seam for the **read-only inventory phase** before the first
Ingest → Events staging resources are created.

It does not call Cloudflare and it never provisions or mutates anything. A caller
must collect a live inventory snapshot separately, then pass it to
`evaluateStagingProvisioningPreflightV1()`.

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
- target the explicitly expected Cloudflare account;
- be no older than 15 minutes;
- have complete D1, Queue, Worker and control-plane coverage.

Partial, unavailable or unknown coverage fails closed.

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

If the source Queue already exists it must have confirmed ownership, seven-day
retention, the exact staging DLQ and either zero consumers or exactly the planned
`events-staging` consumer with batch 10 / timeout 1 s / retries 5.

An existing DLQ must have confirmed ownership, no chained DLQ and no consumer
before shadow activation.

Existing staging Workers must:

- have confirmed ownership;
- expose no public routes during shadowing;
- bind no secrets in this v1 staging shape;
- never bind a production D1 or Queue;
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
