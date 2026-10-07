# Events runtime provisioning and cutover gate v1

**Status:** plan only — no Cloudflare resources are provisioned by this document.

## Purpose

This document converts the storage/transport ADR into an executable provisioning and cutover contract for the first Ingest → Events extraction.

The repository remains read-only toward GitHub and Cloudflare provider APIs. Creating D1/Queue/Worker infrastructure is an operator/control-plane action and is deliberately separated from the observations runtime.

## Platform constraints reverified 2026-10-07

- D1 jurisdiction must be selected when the database is created. The Events databases therefore use `jurisdiction=eu`; an existing non-EU database is not an acceptable substitute.
- Queue source retention is explicitly seven days.
- The ingest-events consumer contract is batch size 10, batch timeout 1 second, max retries 5, with a dedicated DLQ.
- Worker Previews can publish to a Queue but cannot be registered as Queue consumers. The isolated consumer therefore uses a persistent Wrangler `staging` environment / Worker rather than a branch Preview.
- Preview/staging resources must never reference production D1, production Queue, or production provider secrets.

The machine-readable source for the exact names/settings is `../runtime-provisioning.v1.json`.

## Resource plan

### Shadow/staging first

| Resource | Name |
| --- | --- |
| Events Worker | `events-staging` |
| Ingest Worker | `ingest-staging` |
| Events D1 | `avkroken-events-preview-eu` |
| Ingest → Events Queue | `avkroken-ingest-events-preview-v1` |
| DLQ | `avkroken-ingest-events-preview-v1-dlq` |

D1 binding: `EVENTS_DB`.  
Queue producer binding: `EVENTS_QUEUE`.

The staging Queue has exactly one push consumer: `events-staging`.

### Production, only after shadow gate passes

| Resource | Name |
| --- | --- |
| Events Worker | `events` |
| Ingest Worker | `ingest` |
| Events D1 | `avkroken-events-eu` |
| Ingest → Events Queue | `avkroken-ingest-events-v1` |
| DLQ | `avkroken-ingest-events-v1-dlq` |

No provider webhook destination moves merely because these resources exist.

## Provisioning sequence

This is a runbook, not an automatically executed script.

1. Verify the existing control-plane write mechanism and credential class without exporting the token value.
2. Check whether every planned resource already exists.
3. If a D1 database must be created, create it once with EU jurisdiction. Record the returned UUID in deployment configuration, never in shared contracts.
4. Create/update the staging source Queue with seven-day retention and ensure the staging DLQ exists.
5. Deploy `events-staging` with only the staging D1 and Queue consumer.
6. Apply `apps/events/migrations/0001_events.sql` through Wrangler migrations against the same staging D1.
7. Re-run migrations and require `No migrations to apply`.
8. Deploy `ingest-staging` with only the staging Queue producer. It does not receive production provider webhook secrets.
9. Verify exactly one Queue consumer, and verify batch/retry/DLQ settings against `runtime-provisioning.v1.json`.
10. Only then add the fail-soft shadow Service Binding from Skvallerbyttan to `ingest-staging/VerifiedShadowIngressService`.

## Shadow data flow

```text
provider
   |
   v
Skvallerbyttan live webhook
   |  verify + current canonical writes + provider ACK semantics unchanged
   |
   +---- fail-soft async Service Binding ----> ingest-staging
                                                | reduce only
                                                v
                                      preview ingest-events Queue
                                                |
                                                v
                                           events-staging
                                                |
                                                v
                                      avkroken-events-preview-eu
```

The shadow path is not allowed to affect the live provider HTTP status. A shadow failure is evidence against cutover, not a reason to reject an otherwise successfully handled provider delivery.

The shadow RPC is intentionally **preverified**. Skvallerbyttan remains the signature/auth boundary during shadowing, so staging does not need production webhook secrets. Production Ingest still keeps its own provider-auth verification for the eventual provider-destination cutover.

## Backfill boundary

At the instant shadowing is enabled, record one immutable `shadowStart` timestamp.

Legacy backfill imports only rows where:

```text
received_at < shadowStart
```

Live shadow is responsible for events at or after `shadowStart`.

This prevents overlap from creating two identity paths and is enforced by the existing legacy import code.

## Cutover evidence

`evaluateShadowCutoverGateV1()` is the repository gate.

Cutover requires, at minimum:

- all planned staging resources match exact names/settings;
- D1 jurisdiction is EU;
- migrations applied and no pending migration;
- no production D1/Queue/provider secret is referenced from staging;
- exactly one Queue consumer;
- zero missing/extra/content-mismatched events;
- zero idempotency conflicts;
- zero shadow mirror failures;
- zero unresolved retries and zero DLQ messages;
- known Queue backlog and no backlog older than 60 seconds;
- backfill complete with zero invalid rows/conflicts and strict pre-shadow boundary;
- read parity comparisons > 0 with zero mismatch/error;
- at least 72 hours shadowing if 20+ canonical events were observed;
- otherwise at least seven days;
- zero observed events never qualifies as sufficient evidence.

A gate failure leaves Skvallerbyttan canonical and leaves provider destinations unchanged.

## Production cutover order

Only after a passing shadow report:

1. provision production Events D1/Queue/DLQ with the exact production plan;
2. deploy Events production and apply migrations idempotently;
3. deploy Ingest production;
4. verify production Queue consumer/configuration and module health while no provider destination points at Ingest;
5. freeze the passing shadow evidence and record commit/deployment/resource identifiers;
6. change one provider destination at a time;
7. verify delivery evidence and canonical Events persistence;
8. keep legacy webhook route available for rollback during the observation window;
9. move Skvallerbyttan read consumer only after Events read parity remains clean;
10. retire legacy writes/routes only in DEC-900.

## Rollback

Before legacy cleanup, rollback is simple:

- restore provider destination to the existing Skvallerbyttan webhook route;
- disable/remove the shadow Service Binding if it is causing noise;
- leave Events data intact for forensic comparison;
- never delete or rewrite legacy canonical rows as part of rollback.

No rollback step requires a provider-write permission inside the observations runtime.
