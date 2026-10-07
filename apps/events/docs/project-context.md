# Events — project context

**Senast verifierad:** 2026-10-07  
**Repository:** `Avkroken/Avkroken`  
**App path:** `apps/events`  
**Default branch:** `main`

## Roll

Events är målarkitekturens canonical ägare för normaliserade provider-/observationshändelser.

Bootstrap-läget är deploy-neutralt. Appen har ingen `wrangler.jsonc`, ingen provisionerad D1 och ingen Queue-consumer. Skvallerbyttans `STATS_DB.observation_events` förblir canonical tills Events har schema, live shadow ingest, dedup/parity och read-adapter parity.

## Contract

Ingress från `apps/ingest` sker genom `IngressMessageV1`.

Events normaliserar till `ObservationEventV1` och ansvarar för:

- deterministic event-ID;
- canonical idempotency;
- conflict detection;
- provenance/coverage;
- correlation;
- bounded resource/actor/metadata;
- compatibility projection under migration;
- bounded keyset-paginerad event query;
- deterministic legacy import/backfill transform med strict `received_at < shadowStart`-gräns;
- 90-dagars retention/prune seam;
- item-level Queue ack/retry-adapter utan provisionerad Queue.

Retry-volatila `messageId` och `receivedAt` ingår inte i semantic content hash.

## Storage target

Planerad production D1: `avkroken-events-eu`.  
Planerad preview D1: `avkroken-events-preview-eu`.

Provider IDs och bindings är extern/runtime state och får inte antas från detta dokument innan provisionering verifierats live.

## Security

- inga provider credentials ska ägas av Events;
- inga provider writes;
- raw webhook body lagras inte;
- invalid schema och idempotency conflicts ska inte ackas som canonical success;
- deterministic poison messages ska senare gå till DLQ genom bounded Queue retry.

## Migration

Current `observation_events` förblir source of truth tills cutover-gaten i storage/transport-ADR:n är uppfylld. Ingen distributed dual-write correctness antas.
