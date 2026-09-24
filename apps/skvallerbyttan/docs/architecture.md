---
layout: default
title: Arkitektur
permalink: /architecture/
---

# Arkitektur

## Mål

Skvallerbyttan är Avkrokens centrala read-only observationslager och eventnav. GitHub och Cloudflare är auktoritativa providers; provider-webhooks terminerar i Skvallerbyttan, som normaliserar deras state, lagrar begränsad historik och exponerar samma canonical underlag till dashboard och auktoriserade maskinklienter. `Avkroken/Avkroken` är den samlade interna repositoryytan och `apps/portal` driver `avkroken.denied.se`; portalen är inte ett separat provider-observationslager.

```text
GitHub APIs ───────────────┐
GitHub org webhook ────────┤
                           ▼
                     Skvallerbyttan
Cloudflare APIs ───────────┤
CF Notifications webhook ──┤
CF CASB webhook ────────────┤
CF Audit Logs ──────────────┘
                           │
                           ▼
                 Canonical normalized state
                           │
              ┌────────────┼─────────────┐
              ▼            ▼             ▼
         source cache    D1 history   Analytics Engine
         / current       / events     read telemetry
              └────────────┼─────────────┘
                           │
                 ┌─────────┴──────────┐
                 ▼                    ▼
            /api/v1 contract    internal signals
             ├── dashboard            │
             └── machine clients      ▼
                              avkroken RPC
                              ├─ docs cache invalidation
                              └─ operational heartbeat
                                   │
                                   ▼
                              independent watchdog
                              + missing-delivery notice
```

## Systemgräns

Provider-events ska ha **en canonical ingress**: Skvallerbyttan. Fronten på `avkroken.denied.se` ska inte behöva GitHub- eller Cloudflare-webhookhemligheter för att reagera på observerade händelser.

När ett signerat GitHub-event ändrar `README.md` eller `docs/**` på repositoryts publika default branch, signalerar Skvallerbyttan Avkroken-portalen genom Cloudflare Service Binding `AVKROKEN_PORTAL_DOCS`. Bindingen pekar på den namngivna RPC-entrypointen `DocsInvalidationService` i den live Cloudflare-tjänsten `avkroken` (portalens källkod ligger i `apps/portal` i `Avkroken/Avkroken`). Anropet går internt inom Cloudflare-kontot och exponerar ingen publik intern endpoint eller ytterligare secret.

Repository-events signalerar också portalens dokumentationskatalog, inklusive tidigare repositorynamn vid rename. Service-signalen sker före webhook-dedupliceringen så en manuell GitHub-redelivery kan reparera en tidigare misslyckad portalinvalidering utan att dubbellagra Activity-eventet.

Cloudflare-providerhändelser kommer redan in genom Notifications- och CASB-webhooks och skrivs till samma observationsmodell. Audit Logs och den sex-timmars reconciliation-körningen är safety net för det som inte exponeras som push-event.

Operativ liveness följer motsatt riktning mot klassiska health-checks: Skvallerbyttan skickar heartbeat var 15:e minut genom `AVKROKEN_OPERATIONS` till `avkroken`/`OperationalHeartbeatService`. Receiver-state ligger i portalens Durable Object och är därmed inte beroende av Skvallerbyttans egen D1 eller HTTP-route. Utebliven leverans efter 35 minuter genererar notifiering från mottagarsidan.

Readinesspayloaden produceras av faktiska lokala/provider-probes men innehåller endast booleska resultat. Heartbeat skickas även när readiness är false, så liveness och readiness förblir separata signaler.

## Runtime

Runtime är en TypeScript-baserad Cloudflare Worker.

- entrypoint: `src/entry.ts`
- request/scheduled orchestration: `src/worker.ts`
- canonical observations-API: `src/observations-api.ts`
- GitHub provider: `src/github.ts`, `src/github-governance.ts`
- Cloudflare provider: `src/cloudflare.ts`
- capability/statusmodell: `src/capabilities.ts`, `src/observation-model.ts`
- Activity: `src/activity.ts`
- read telemetry: `src/telemetry.ts`
- provider health: `src/provider-health.ts`
- push heartbeat/readiness: `src/runtime-heartbeat.ts`
- source cache: `src/source-cache.ts`

## Canonical state

Externa klienter får normaliserade modeller, inte generella provider-dumpar. Relevant state bär status, freshness och provenance. Repository governance skiljer mellan `direct`, `inherited` och `effective` där providern ger tillräckligt underlag.

GitHub-providerobservationer använder endast read-behörigheter. Administration: read används där GitHub kräver den nivån; provider-write ingår inte i observationslagret.

## GitHub

Skvallerbyttan använder **Gamnacken**, Avkrokens canonical GitHub App, för read-only maskinåtkomst. Installation tokens är kortlivade och cacheas endast i Worker-instansen. En separat Skvallerbyttan GitHub App ingår inte i målarkitekturen.

Canonical GitHub-state omfattar bland annat:

- repositories, PR/issues och Actions
- Actions organization permissions och allowed-actions/workflow-permissions
- repository effective rulesets
- Custom Property-definitioner och assignments
- code security configurations
- security alerts och webhookbaserad security history
- GitHub App installation/token permissionnivåer och endpointens accepterade permissions, utan credentialvärden
- repository-scope coverage för PR/issues, Actions och effective rulesets
- rate-limit headers och provider health

## Cloudflare

Cloudflare-klienten använder ett account-scopat API-token med endast read-permissions. Canonical readyta omfattar:

- Account metadata
- Zones
- Workers metadata
- D1 database inventory
- KV namespace inventory
- R2 bucket inventory
- Access applications och begränsad policymetadata
- Tunnels
- Notifications/CASB
- Audit Logs

D1 queries, KV values och R2 object content läses inte för inventory-funktionerna. Worker secret binding values returneras inte.

## Capability- och statusmodell

Capability-registret är ett maskinkontrakt. Varje capability har separat:

- implementation support
- provider support
- permission state
- data state
- freshness
- supported operations
- provider endpoint och required permission
- provider-accepterade permissions där GitHub returnerar dem
- scope coverage för repository-scopeade capabilities

Statusvokabulären är:

`available`, `unavailable`, `permission_denied`, `not_configured`, `not_supported`, `not_exposed_by_provider`, `unknown`, `not_observed`, `stale`, `error`.

## Activity

Activity lagras i D1-tabellen `observation_events`. Normaliserade event innehåller endast den metadata som behövs för aktivitet och filtrering.

Source-prioritet:

1. webhook
2. Audit Log/event API
3. snapshot diff
4. reconciliation

Nuvarande generella ledger använder GitHub-organisationswebhooken, Cloudflare Notifications/CASB och Cloudflare Audit Logs. Coverage anges explicit. Webhookdata är normalt `since_first_observation`; Audit Log-ingest markeras `partial`. Downstream-signaler till andra Avkroken-tjänster är effekter av redan verifierade events och är inte en ny provider-källa.

## Reads

Read telemetry är separat från provideraktivitet. En datapunkt innehåller capability, provider, consumer, operation, result, cache-state och duration.

Consumers:

- `dashboard`
- `chatgpt`
- `reconciliation`
- `background_refresh`
- `internal`

Telemetry skrivs till Workers Analytics Engine. SQL-aggregat väger `_sample_interval` så eventuell adaptiv sampling inte presenteras som exakta råa counts.

## Cache och reconciliation

Canonical source cache ligger i D1 och har TTL per capability:

- organization governance: 5 minuter
- PR/issues, Actions och repository effective rulesets: 20 minuter
- Workers/Zero Trust: 10–15 minuter
- account/zones: 15 minuter
- Storage inventory: 30 minuter

Stale cache kan returneras samtidigt som en single-flight background refresh startas. Webhooks invaliderar berörda cache keys där samband är känt.

GitHub capability-reconciliation kör var 15:e minut med bounded concurrency och uppdaterar PR/issues, Actions, security samt repository effective rulesets. Den sex-timmars reconciliation-körningen fortsätter som bredare safety net för governance, Cloudflare-källor, Audit Logs och pruning.

## Lagring

D1 ansvarar för state som behöver detaljhistorik eller konsistens:

- snapshots
- source cache
- webhook-deduplication
- security events
- Cloudflare events
- capability observations och repository-scopeade capability observations
- canonical Activity-events

Analytics Engine används för högfrekvent read telemetry. Detta undviker en D1-write för varje trivial read/cache-hit.
