# Ingest

`apps/ingest` är den deploy-neutrala första extraction-seamen för framtida
`ingest`-modulen i Avkrokens observationsarkitektur.

## Status

Den här appen är **inte** provider-destination och **inte** en deploybar
production-Worker ännu. Den har medvetet ingen `wrangler.jsonc`, ingen DNS-route,
ingen Queue-resource och inga egna provisionerade secrets.

Den aktiva provider-ingressen ligger fortsatt i Skvallerbyttan tills Events-ledgern,
Queue-resurser, preview-isolering och cutover-verifiering finns på plats.

## Ansvar

Ingest ska endast göra följande på provider-callbackens critical path:

1. kräva `POST`;
2. verifiera provider-auth/signatur;
3. reducera payloaden till explicit allowlistad metadata;
4. skapa en stabil `idempotencyKey` och en unik attempt/message-identitet;
5. lämna över `IngressMessageV1` till `EVENTS_QUEUE`;
6. svara `202` först efter lyckad Queue-handoff.

Queue saknas eller `send()` misslyckas -> `503`, så provider retry kan användas.

Ingest äger inte Activity, security ledger, source-cache, docs-invalidation,
provider polling eller canonical event persistence.

## Planerade externa paths

När modulen senare provisioneras används:

- `POST /github`
- `POST /cloudflare/notifications`
- `POST /cloudflare/issues`
- `POST /cloudflare/casb`

## Credential contract under migration

Koden återanvänder befintliga secret-bindingnamn så att framtida cutover inte
kräver parallella secretvärden:

- `SKVALLERBYTTAN_WEBHOOK_SECRET`
- `CLOUDFLARE_NOTIFICATIONS_WEBHOOK_SECRET`
- `CLOUDFLARE_CASB_WEBHOOK_SECRET`

Secretvärden får aldrig loggas, returneras eller committas.

## Validation

Ingest har tills vidare ingen egen dependency-installation. Repository-CI installerar
Skvallerbyttans befintliga, låsta dev-toolchain och använder dess `tsx`/`tsc` för att
köra Ingest-test och strict typecheck. Detta är endast build-tooling och inte ett
runtimeberoende.


## Preverified shadow RPC

`VerifiedShadowIngressService` är den deploy-neutrala named RPC-adaptern för shadowfasen.
Den tar endast emot `VerifiedShadowDeliveryV1` från en framtida Service Binding efter att
Skvallerbyttan redan har verifierat provider-auth/signatur och skrivit sin canonical legacy-event.

RPC-envelope innehåller delivery identity, original `receivedAt` och providerbody endast som
transient reducer-input. Body får aldrig lagras, loggas eller följa med `IngressMessageV1`.
Shadow-RPC kräver inga provider webhook-secrets; Service Binding-capability är trust boundary.

Ingen Wrangler-binding eller Worker deploy deklareras ännu.
