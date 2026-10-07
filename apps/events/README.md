# Events

`apps/events` är den deploy-neutrala bootstrap-seamen för framtida
`events`-modulen i Avkrokens observationsarkitektur.

## Status

Den här appen är ännu **inte** en deployad Queue-consumer och har avsiktligt ingen
`wrangler.jsonc` eller provisionerad D1-binding. Dagens
`apps/skvallerbyttan` / `observation_events` är fortsatt canonical tills
shadow ingest, backfill och read parity är verifierade.

## Canonical ansvar efter cutover

Events ska äga:

- normaliserade `ObservationEventV1`;
- canonical idempotency/dedup;
- provider delivery identity;
- provenance/coverage;
- correlation;
- 90 dagars hot event retention;
- bounded read/projection interfaces.

Raw providerpayload hör inte hemma i Events.

## Bootstrap-seam

Den första seamen implementerar:

1. strikt runtime-validering av `IngressMessageV1`;
2. deterministic event-ID från `idempotencyKey`;
3. semantic content hash som ignorerar retry-volatila `messageId`/`receivedAt`;
4. unique insert på `idempotency_key`;
5. duplicate = idempotent success;
6. samma idempotency key + annan semantic payload = conflict;
7. compatibility-projection mot dagens Activity-fält;
8. bounded keyset-paginerad read/query-seam;
9. deterministic legacy-backfill transform med strict pre-shadow cutover boundary + 90-dagars prune-seam;
10. deploy-neutral item-level Queue ack/retry-adapter.

## Planerad storage

ADR-namn:

- production: `avkroken-events-eu`;
- preview: `avkroken-events-preview-eu`.

Den här PR:n skapar inga providerresurser. `migrations/0001_events.sql` är
schema source som ska appliceras först när den separata provisioning-gaten öppnas.


## Runtime/cutover preparation

The machine-validated target plan is `runtime-provisioning.v1.json`.
`src/runtime-gate.ts` evaluates shadow/parity evidence before any production provider destination may move.
See `docs/runtime-provisioning.md`.


## Staging provisioning preflight

The read-only inventory evaluator is `src/staging-preflight.ts`.
Its contract and stop conditions are documented in
[`docs/staging-preflight.md`](docs/staging-preflight.md). A passing preflight
does not authorize Cloudflare writes.
