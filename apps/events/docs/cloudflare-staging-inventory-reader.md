# Cloudflare staging inventory reader

**Status:** deploy-neutral read adapter  
**Verified provider documentation:** 2026-10-08

## Boundary

`CloudflareStagingInventoryReaderV1` implements the Events
`StagingInventoryReadPortV1` over a narrow server-side proxy contract.

The proxy is **not** a generic Cloudflare URL proxy. It exposes named inventory
operations only:

- read the configured account identity;
- read the active deployment of an allowlisted staging Worker;
- list D1 databases;
- read one D1 database detail;
- list Queues;
- list Queue consumers;
- list Workers;
- inspect one allowlisted staging Worker.

Only `events-staging` and `ingest-staging` may be passed to worker inspection.

The W1 credential remains inside the future server-side proxy/Secrets Store
boundary. Events never receives the token value.

## Provider GET surfaces

The adapter is based on the current Cloudflare API read surfaces:

- `GET /accounts/{account_id}`;
- `GET /accounts/{account_id}/d1/database`;
- `GET /accounts/{account_id}/d1/database/{database_id}`;
- `GET /accounts/{account_id}/queues`;
- `GET /accounts/{account_id}/queues/{queue_id}/consumers`;
- Worker inventory/detail, active deployments and active version detail GET surfaces;
- script/version settings GET surfaces;
- Worker schedules and route/domain/subdomain reads needed to prove staging has no public route.

The proxy implementation must paginate provider list endpoints completely before
returning a successful list result. Partial pagination is not `complete` inventory.

## Sanitization

The adapter returns only:

- resource IDs/names;
- jurisdiction/read-replication state;
- Queue retention and consumer policy;
- Worker binding names/types/resource IDs;
- route/trigger identifiers;
- provider-bound account ID;
- active deployment commit SHA and bindings from the single serving version.
  Gradual/two-version deployments do not qualify for reuse.

It intentionally drops:

- secret values;
- plaintext variable values;
- provider error message bodies;
- Worker source content;
- D1 contents;
- Queue message content.

Unknown/malformed provider shapes throw `CloudflareInventoryShapeError`. The
collector then marks the corresponding coverage partial/unavailable instead of
interpreting the failure as absence.

## Still not provisioned

This file adds no `wrangler` binding, Worker service, credential, Queue, D1,
DNS route or provider destination. The server-side proxy implementation is still
deploy-neutral; live read-only deployment/binding and execution remain separate steps.
