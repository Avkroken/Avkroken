---
layout: default
title: Arkitektur
permalink: /architecture/
---

# Arkitektur

## Mål

Skvallerbyttan är repositoryts read-only observationslager och eventnav. Koden exponerar webhook-ingress för GitHub och Cloudflare, normaliserar provider-state, lagrar begränsad historik och exponerar samma normaliserade underlag till dashboard och auktoriserade maskinklienter. Faktisk webhookkonfiguration är extern providerstate. `blixten85/Avkroken` och `avkroken.denied.se` är den centrala monorepo- och frontytan, inte ett separat provider-observationslager.

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
                 ┌─────────┴──────────────────┐
                 ▼                            ▼
            /api/v1 contract        PortalObservationsService
             ├── dashboard          (sanitized read-only RPC)
             └── machine clients        ├─ provider/capability snapshot
                 │                    ├─ cached repository CI snapshot
                 │                    └─ allowlistad repository Activity
                 │                           │
                 │                           ▼
                 │                    avkroken Drift & insyn / Builds / Aktivitet
                 │
                 └──────── internal signals ────────────────► avkroken RPC
                                                      ├─ docs cache invalidation
                                                      └─ operational heartbeat
                                                           │
                                                           ▼
                                                      independent watchdog
                                                      + missing-delivery notice
```

## Systemgräns

Provider-events ska ha **en canonical ingress**: Skvallerbyttan. Fronten på `avkroken.denied.se` ska inte behöva GitHub- eller Cloudflare-webhookhemligheter för att reagera på observerade händelser.

När ett signerat GitHub-event ändrar `README.md` eller `docs/**` på repositoryts publika default branch, signalerar Skvallerbyttan Avkroken-portalen genom Cloudflare Service Binding `AVKROKEN_PORTAL_DOCS`. Bindingen deklarerar service target `avkroken` och RPC-entrypointen `DocsInvalidationService` (portalens källkod ligger i `Avkroken/Avkroken/apps/portal`). Anropet går internt inom Cloudflare-kontot och exponerar ingen publik intern endpoint eller ytterligare secret.

Repository-events signalerar också portalens dokumentationskatalog, inklusive tidigare repositorynamn vid rename. Service-signalen sker före webhook-dedupliceringen så en manuell GitHub-redelivery kan reparera en tidigare misslyckad portalinvalidering utan att dubbellagra Activity-eventet.

Koden har ingressvägar för Cloudflare Notifications/CASB och read-paths för Audit Logs/reconciliation. Vilka externa providerintegrationer som faktiskt är aktiva är Cloudflare-state och fastställs inte av repositoryt.

Operativ liveness följer motsatt riktning mot klassiska health-checks: Skvallerbyttan skickar heartbeat var 15:e minut genom `AVKROKEN_OPERATIONS` till `avkroken`/`OperationalHeartbeatService`. Receiver-state ligger i portalens Durable Object och är därmed inte beroende av Skvallerbyttans egen D1 eller HTTP-route. Utebliven leverans efter 35 minuter genererar notifiering från mottagarsidan.

Readinesspayloaden produceras av faktiska lokala/provider-probes men innehåller endast booleska resultat. Heartbeat skickas även när readiness är false, så liveness och readiness förblir separata signaler.

Portalens operativa läsväg är separat från heartbeat och det skyddade HTTP-API:t. `PortalObservationsService` exporteras som named Worker RPC-entrypoint och läser samma canonical capability/provider-health/Activity-modeller, men passerar dem genom en explicit sanitization boundary innan de lämnar Skvallerbyttan.

Den generella Drift-snapshoten innehåller endast providerstatus/senaste observation samt capability key/name/provider/status/dataState/freshness/last-success. Provider-endpoints och permissionsträngar, accepterade permissions, HTTP-statusar/fel, installation-/budgetmetadata, scope coverage/repositoryantal och Activity/eventvolym publiceras inte genom den generella Drift-metoden.

Samma named entrypoint har ett separat repository-CI-kontrakt. `getPublicRepositoryCi(repoName)` läser endast D1 source cache-keyn `overview`; den startar ingen GitHub Actions-request. Repositoryraden måste själv vara `visibility = public` och icke-arkiverad. Utåt projiceras endast sampled Actions-summary, source cache-tid och explicit `fresh|stale|unknown`. Actor, permissions/fel, event breakdown och rå runpayload lämnar inte Skvallerbyttan.

Ett separat repository-Activity-kontrakt exponeras som `getPublicActivity(repositoryNames, days)`. Begärda repositorykortnamn begränsas till 50 och intersectas med den cacheade `overview`-state:n; endast rader med `visibility = public` och `archived != true` går vidare. Därefter queryas D1 `observation_events` med `provider = github` och ett explicit `repository IN (...)`-filter. En explicit lista som efter validering blir tom lägger till `1 = 0` och kan inte falla tillbaka till organisationsomfattande Activity.

Activity-sanitizern returnerar aggregate counts/coverage och recent event-rader med repository, capability, source, coverage, event/action och timestamps. `resourceId`, resource type, actor, providerfel, permissions och rå webhookpayload lämnar inte Skvallerbyttan. Capability-allowlisten innehåller endast `github.avkroken.repositories`, `github.avkroken.pull_requests` och `github.avkroken.actions`; security, Custom Properties och effective-ruleset-events publiceras inte. Cloudflare account-/org-Activity publiceras inte genom detta kontrakt.

## Runtime

Runtime är en TypeScript-baserad Cloudflare Worker.

- Worker module composition: `src/entry.ts`
- HTTP/noindex handler: `src/http-entry.ts`
- request/scheduled orchestration: `src/worker.ts`
- canonical observations-API: `src/observations-api.ts`
- GitHub provider: `src/github.ts`, `src/github-governance.ts`
- Cloudflare provider: `src/cloudflare.ts`
- capability/statusmodell: `src/capabilities.ts`, `src/observation-model.ts`
- Activity: `src/activity.ts`
- read telemetry: `src/telemetry.ts`
- provider health: `src/provider-health.ts`
- Workers RPC-entrypoint: `src/portal-observations.ts`
- ren public-safe Drift-sanitizationmodell: `src/portal-observations-model.ts`
- ren public-safe repository-CI-modell: `src/portal-ci-model.ts`
- ren public-safe repository-Activity-modell: `src/portal-activity-model.ts`
- push heartbeat/readiness: `src/runtime-heartbeat.ts`
- source cache: `src/source-cache.ts`

## Canonical state

Externa klienter får normaliserade modeller, inte generella provider-dumpar. Relevant state bär status, freshness och provenance. Repository governance skiljer mellan `direct`, `inherited` och `effective` där providern ger tillräckligt underlag.

Portalens publika Drift & insyn-, Builds- och Activity-konsumenter är ännu snävare än machine-API:t: de kan endast nå den sanerade named RPC-entrypointen och får inte återanvända dashboard-session eller machine bearer-token som genväg. Repository-CI läses från redan observerad/cachead state, och repository-Activity från den reducerade D1-eventledgern efter dubbel publiceringskontroll; inget av kontrakten får göra en ny providerread på Portalens begäran.

GitHub-providerobservationer använder endast read-behörigheter. Administration: read används där GitHub kräver den nivån; provider-write ingår inte i observationslagret.

## GitHub

GitHub-providerkoden använder credential-bindings med `GAMNACKEN_GITHUB_APP_*`-namn för GitHub App-auth. Installation tokens är kortlivade och cacheas endast i Worker-instansen. Vilken App-installation som faktiskt är aktiv är extern GitHub-state.

Canonical GitHub-state omfattar bland annat:

- repositories, PR/issues och Actions
- organization-only Actions permissions och allowed-actions/workflow-permissions (`not_supported` när current GitHub owner är ett User-konto)
- repository effective rulesets
- Custom Property-definitioner och assignments
- code security configurations
- security alerts och webhookbaserad security history
- GitHub App installation/token permissionnivåer och endpointens accepterade permissions, utan credentialvärden
- repository-scope coverage för PR/issues, Actions och effective rulesets
- rate-limit headers och provider health

## Portal repository-CI

Skvallerbyttans breda `overview` innehåller redan `actions.summary` för varje observerat repository. Portalens CI-RPC använder just detta cacheade underlag.

```text
scheduled / operator overview observation
        |
        v
D1 api_cache["overview"]
        |
        v
PortalObservationsService.getPublicRepositoryCi(repo)
        |
        +--> exact Avkroken/<repo>
        +--> visibility = public
        +--> archived != true
        +--> capability.actions = true
        |
        v
portal-ci-model.ts
        |
        +--> sampled pass/failure/duration/MTTR
        +--> sourceRefreshedAt
        +--> fresh / stale / unknown
        |
        v
Avkroken Portal /projekt/:slug/builds
```

Freshnesshorisonten för detta downstream-kontrakt är sex timmar eftersom det är `overview` source cache som läses. En invaliderad eller äldre cachepost kan fortfarande returneras som `stale`; den får inte presenteras som fresh. Om cache eller publik repositoryrad saknas returneras `not_observed`.

Detta kontrakt är medvetet summary-only. Individuella recent runs finns i Skvallerbyttans autentiserade repositorydetail men publiceras inte genom Portal-RPC:n i den här modellen.

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

Den generella ledgern kan normalisera GitHub-webhookevent, Cloudflare Notifications/CASB och Cloudflare Audit Logs. Coverage anges explicit. Webhookdata är normalt `since_first_observation`; Audit Log-ingest markeras `partial`. Downstream-signaler till andra Avkroken-tjänster är effekter av redan verifierade events och är inte en ny provider-källa.

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

- organization-only governance: 5 minuter när providerns account type stödjer ytan; annars `not_supported`
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
