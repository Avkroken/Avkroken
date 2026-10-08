# Staging inventory control-plane proxy seam

**Status:** deploy-neutral operator/control-plane code — not deployed  
**Verified provider documentation:** 2026-10-08

## Ownership boundary

This seam lives under `apps/events/control-plane/`, outside the Events runtime
source tree. It is an operator helper for staging preflight, not part of the
canonical Events data plane.

The future runtime may bind `CLOUDFLARE_API_TOKEN_W1` from Secrets Store to
this control-plane service only. Events itself must never receive W1.

## Named RPC surface

The exported RPC entrypoint is `CloudflareStagingInventoryProxyEntrypoint` in
`cloudflare-staging-inventory-proxy-entrypoint.ts`. It is deliberately a thin
Cloudflare-runtime wrapper around the pure, Node-testable
`CloudflareStagingInventoryProxyServiceV1`; all provider HTTP and sanitization
logic remains in the pure service. The entrypoint implements only:

- `getAccountIdentity()`, returning only the provider-read account ID;
- `getActiveWorkerDeployment(name)`, allowlisted to `events-staging` / `ingest-staging`;
- `listD1Databases()`;
- `getD1Database(databaseId)`, allowlisted to `avkroken-events-preview-eu`;
- `listQueues()`;
- `listQueueConsumers(queueId)`, allowlisted to the planned staging source/DLQ queues;
- `listWorkers()`;
- `inspectPlannedWorker(name)`, allowlisted to `events-staging` / `ingest-staging`.

There is no generic `get(path)`, URL method or arbitrary provider request.

## HTTP invariants

Internally every provider request is hard-coded `GET`.
There is no POST/PUT/PATCH/DELETE code path. The request timeout remains active
through response-body consumption, not only until headers arrive.

Reads are bounded by:

- 5 s default timeout per provider request;
- 2 MB max response body enforced while streaming;
- max 100 pages;
- max 5,000 list objects;
- max 100 zones for route inspection;
- max 4 concurrent zone-route reads.

D1, Worker and Zone list endpoints use documented `page/per_page`
pagination. Queue/domain endpoints are single-page in the current SDK contract;
if provider `result_info` reports multiple pages, the seam follows those pages
and otherwise fails closed if completeness cannot be proven.

## Sanitization before RPC return

Provider responses are minimized before leaving the control-plane seam:

- D1: name, UUID, jurisdiction, read-replication mode;
- Queue: name, ID, retention;
- consumer: type, Worker name, DLQ and bounded delivery policy;
- Worker: name, subdomain flags, queue/domain references;
- settings: binding type/name/resource reference plus non-secret annotations needed by the adapter;
- active deployment: serving version ID, traffic percentage and commit SHA only;
- account: account ID only;
- schedules: cron only;
- routes: pattern only for the requested staging Worker.

Secret values, plaintext variable values, provider error bodies, Worker source
and unrelated provider metadata are discarded before return.

## Provider surfaces

Current Cloudflare read surfaces used by the seam:

- Account detail for binding the inventory to the account actually queried;
- D1 list/detail;
- Queues list/consumers;
- Workers beta list/detail;
- Worker deployments plus active version detail;
- Worker script/version settings;
- Worker schedules;
- Worker custom domains;
- account-filtered Zones list + per-zone Worker routes.

The server-side W1 credential never appears in returned values or errors.

## Not a deployment

No `wrangler` config, Secrets Store binding, Worker service, DNS route, D1,
Queue or provider destination is introduced by this seam.


## Fail-closed completeness

Provider pagination is rejected when reported page/count metadata is inconsistent.
A successful schedules response must contain the documented schedule collection;
missing inventory is not treated as an empty collection.

The account identity used in the report comes from `GET /accounts/{account_id}`
and must equal the configured account. Worker deployment evidence is resolved from
the active deployment and each serving version; an unresolved/mixed commit cannot
qualify an existing Worker for reuse.
