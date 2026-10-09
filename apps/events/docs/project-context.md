# Events — project context

**Senast verifierad:** 2026-10-08  
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


## Runtime preparation

`runtime-provisioning.v1.json` is the exact planned resource contract. The shadow consumer must run as persistent
`events-staging` because Worker Previews cannot consume Queues. No runtime resource IDs are recorded until
provisioning has been explicitly approved and verified live.

`evaluateShadowCutoverGateV1` is fail-closed: insufficient observation time/traffic, parity differences, mirror
failures, unresolved retries/DLQ, unknown/old backlog, migration drift, production-resource leakage or read mismatch
all keep Skvallerbyttan canonical.

Cutover evidence also expires after 15 minutes: both report generation and the
shadow window end are checked against the evaluation clock, with at most one
minute of future clock skew. Retimestamping an old report cannot refresh its window.


## Staging preflight

`evaluateStagingProvisioningPreflightV1` evaluates a caller-supplied, live
read-only inventory snapshot before any staging create operation. It fails
closed on stale/incomplete coverage, wrong account/control-plane evidence,
ambiguous ownership/configuration or production resource reuse.

The evaluator itself performs no provider/API call and no mutation.


## Staging inventory collector

The next preflight slice uses a read-only inventory port to build
`StagingInventorySnapshotV1`. Provider read failures degrade coverage to
`partial`/`unavailable`; they are never interpreted as proof that a resource is absent.
The collector exposes no create/update/delete/deploy operation. The snapshot account
identity is read through the provider-backed read port; caller-supplied account
evidence cannot override the account actually queried.


## Cloudflare staging inventory adapter

`CloudflareStagingInventoryReaderV1` maps current Cloudflare read-only inventory
shapes into `StagingInventoryReadPortV1` through a named server-side proxy
contract. Worker detail inspection is allowlisted to `events-staging` and
`ingest-staging`; the adapter never receives a token or exposes a generic
Cloudflare API proxy. Existing Worker reuse is bound to the active deployment:
every serving version is resolved. Reuse is allowed only for a single active
version whose commit matches the expected repository commit; bindings are read
from that active version rather than from independently mutable script settings.


## Staging inventory control-plane proxy

The W1-backed preflight proxy is a separate operator/control-plane seam under
`apps/events/control-plane/`, outside the Events runtime source tree. Its public
surface is named GET-only inventory operations, and it sanitizes Cloudflare
responses before returning them to the Events inventory adapter. No runtime
binding/deployment exists yet.


## Operator staging preflight runner

`control-plane/staging-preflight-runner.ts` composes the named Cloudflare proxy,
`CloudflareStagingInventoryReaderV1`, the inventory collector and
`evaluateStagingProvisioningPreflightV1` into one operator-only read path.

The runner owns the observation timestamp, binds the report to the provider-read
account identity and returns only sanitized decisions, coverage, counts and
evidence metadata. Production resource ID lists and credential values are not
returned by the report. It has no provider-write, deploy or provisioning method.

No control-plane Worker/binding has been deployed yet; live read-only execution
remains a separate operational gate.


## Live preflight deployment gate

`live-preflight-deployment.v1.json` now locks the smallest allowed temporary
topology for the first provider-backed staging inventory run: a private
`events-staging-inventory-proxy` with W1 bound server-side from the existing
Secrets Store, GET-only provider access, no runtime resource bindings and no
public route/workers.dev/preview URL.

The operator remains local and may reach only the named
`CloudflareStagingInventoryProxyEntrypoint` through a remote Service Binding.
Deployment and teardown are separate provider-write operations and have not been
performed by this repository slice.
