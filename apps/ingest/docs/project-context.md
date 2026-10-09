# Ingest — project context

**Senast verifierad:** 2026-10-09
**Repository:** `Avkroken/Avkroken`  
**App path:** `apps/ingest`  
**Default branch:** `main`

## Roll

Ingest är målarkitekturens provider-callback boundary. Den ska autentisera/signaturverifiera, reducera payloaden till en explicit allowlist och lämna över `IngressMessageV1` durably till Events.

## Current repository state

Ingest är deploy-neutral:

- ingen `wrangler.jsonc`;
- ingen provisionerad Worker-service;
- ingen DNS-route;
- ingen Queue/DLQ;
- inga egna provider read credentials;
- inga egna canonical state stores.

Skvallerbyttans webhook-routes är fortsatt live/canonical provider destination.

## Contract

Planerade callback paths:

- `POST /github`;
- `POST /cloudflare/notifications`;
- `POST /cloudflare/issues`;
- `POST /cloudflare/casb`.

Koden återanvänder befintliga secret-bindingnamn under migration, men inga credentialvärden finns i repositoryt.

Durable handoff-seamen är `EVENTS_QUEUE.send(IngressMessageV1)`. När Queue senare provisioneras får HTTP 202 endast ges efter lyckad handoff; missing/failure ger 503 för provider retry.

## Ownership

Ingest äger inte:

- canonical dedup;
- event ledger;
- current provider state/reconciliation;
- Activity/security projections;
- source cache;
- Portal/docs-invalidation;
- machine API;
- dashboard.

Canonical idempotency ägs av Events.

## Security

- GitHub HMAC verifieras innan accepterad handoff;
- Cloudflare auth verifieras innan känslig Workers Issues-body parse;
- raw diagnostic `text`/`data`/stack/log/request-kontext skickas inte vidare;
- inga provider writes;
- inga secrets loggas eller returneras.

## Cutover gate

Provider destination flyttas inte förrän Events-consumer, Queue/DLQ, preview-isolering, shadow/parity, deployment och rollback är verifierade.


## Preverified shadow seam

Repositoryt exporterar en named `VerifiedShadowIngressService`-adapter och ren
`acceptVerifiedShadowDelivery()`-logik. Detta är fortfarande deploy-neutralt: ingen Worker,
Service Binding, Queue eller provider destination är konfigurerad.

Shadow-input är en bounded migration-only `VerifiedShadowDeliveryV1`. Ingest validerar
schema/timestamp/delivery identity/body-size, reducerar med samma provider reducers som den
framtida publika callbackvägen och skriver endast `IngressMessageV1` till `EVENTS_QUEUE`.
Provider secret/signaturvärden ingår aldrig i shadow-envelope.

## Outcome metrics

HTTP-ingress och shadow-RPC har valfri best-effort-instrumentering via
`INGEST_METRICS.writeDataPoint()`. Schemat `ingest-v1` innehåller endast fasta
surface/source/outcome-kategorier, antal och förfluten tid inklusive Queue-send.
Accepterad handoff räknas först efter lyckad send; ignorerade callbacks skiljs från
accepterade meddelanden. Metrics-fel påverkar inte leverans eller provider retries.

Inga payloads, credentials, URL:er, leveransidentiteter eller feltexter skickas till
metrics. [README](../README.md#outcome-metrics-ing-109) beskriver fältschemat.
Ingen Analytics Engine-binding/dataset är provisionerad av denna kodändring;
live-observability och cutover-verifiering återstår.
