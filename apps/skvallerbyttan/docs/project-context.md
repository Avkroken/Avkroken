---
layout: default
title: Projektkontext
permalink: /project-context/
---

# Projektkontext

Senast verifierad för observationslagerarbetet: 2026-09-23.

## Repository

- repository: `Avkroken/Avkroken`
- app path: `apps/skvallerbyttan`
- default branch: `main`
- runtime: TypeScript Cloudflare Worker
- production domain: `https://skvallerbyttan.denied.se`
- dashboard: privat
- appdokumentation: versionsstyrd i monorepot; ingen separat Pages-publicering
- full repository check: `npm run check`

`docs/organization/` i `Avkroken/Avkroken` är central källa för organisationsgemensam engineering-, CI- och governance-kontext.

## Produktansvar

Skvallerbyttan är Avkrokens centrala **read-only observationslager och eventnav** för GitHub och Cloudflare. Dashboard och machine API delar samma canonical normaliserade state. Provider-webhooks ska termineras här; andra Avkroken-tjänster reagerar via interna signaler i stället för att skapa parallella provider-integrationer.

`Avkroken/Avkroken` är central organisations-/engineeringkälla och `avkroken.denied.se` är fronten. Skvallerbyttan är underförrådet som äger eventström, Activity och samlad historik.

Skvallerbyttan är inte ett administrativt provider-API.

## Dashboard

Top-level navigation:

1. Översikt
2. GitHub
3. Cloudflare
4. Aktivitet
5. Insyn

Navigationen är tangentbordsnavigerbar, deep-linkbar och data lazy-laddas per flik.

## GitHub integrationer

- **Gamnacken GitHub App:** Avkrokens canonical provideridentitet för read-only GitHub-observationer i Skvallerbyttan. En separat Skvallerbyttan GitHub App ska inte användas.
- **Krösa-Maja:** OAuth login för människan.
- **GitHub organization webhook:** canonical event-ingress för Activity, security ledger och cache invalidation; Custom Property-definitioner/värden används som governance freshness-signaler när de levereras.
- **Avkroken portal signal:** docs-relevanta GitHub-events skickas internt via Cloudflare Service Binding `AVKROKEN_PORTAL_DOCS` till live Worker-tjänsten `avkroken`/`DocsInvalidationService`; portalen behöver därmed ingen egen provider-webhook för detta.
- **Operativ heartbeat:** runtime skickar receiver-observerad liveness/readiness via `AVKROKEN_OPERATIONS` till `avkroken`/`OperationalHeartbeatService`; portalens oberoende watchdog larmar vid utebliven förväntad leverans.

GitHub REST API-version: `2026-03-10`.

GitHub-providerobservationer använder endast read-behörigheter. Administration read får användas där GitHub kräver den nivån. Repository effective rulesets används med Metadata read.

Var 15:e minut körs en begränsad GitHub capability-reconciliation för repository inventory, verkliga PR/issues-reads, Actions, organization security alerts och repository effective rulesets. PR/issues, Actions och effective rulesets persisteras per repository och aggregeras med explicit scope coverage. Capability freshness för dessa ytor är 20 minuter så normal 15-minuterskadens inte växlar till stale mellan körningarna.

Runtime behåller endast sanerad GitHub App-permissionmetadata från installationen/tokenen och endpointens `X-Accepted-GitHub-Permissions`; inga token- eller private-key-värden exponeras.

## Cloudflare

Skvallerbyttans Cloudflare-provider är read-only och följer Avkrokens centrala credentialmodell i `../../docs/organization/cloudflare-credential-standard.md`.

Provider-reads är partitionerade och rangordnade utan arv:

- **R1 — Platform / Resource Read:** Zones, Workers, D1 inventory, KV namespace inventory och R2 bucket inventory.
- **R2 — Analytics / Content / Operations Read:** Account, Notifications, Audit Logs och Analytics Engine SQL för read telemetry.
- **R3 — Security / Identity Read:** Access applications, Tunnels och CASB.

Runtime binder `CLOUDFLARE_API_TOKEN_R1`, `CLOUDFLARE_API_TOKEN_R2` och `CLOUDFLARE_API_TOKEN_R3` direkt från Cloudflare Secrets Store utan generisk tokenfallback.

GitHub Actions som muterar Cloudflare använder W1-credentialen när den finns. Runtime-secret-sync kopierar inte längre R1/R2/R3 från GitHub till vanliga Worker secrets.

Cloudflare-account-ID är versionerad icke-hemlig config. GitHub- och Cloudflare-webhooks använder var sitt canonical secret; Notifications och CASB delar Cloudflare-webhooksecretet. Cloudflare Notifications och CASB är canonical push-ingress för Cloudflare-event som providern exponerar den vägen. Audit Logs och reconciliation täcker resterande observerbara ändringar. Observationskoden använder inga provider-write-operationer.

## Interna event-signaler

Downstream-tjänster får inte behöva duplicera providerautentisering enbart för cache/freshness-signaler.

För publik repositorydokumentation:

1. GitHub levererar `push`/`repository` till Skvallerbyttan.
2. Skvallerbyttan verifierar webhooksignaturen och organisationsgränsen.
3. Relevanta docs-events signaleras till live Worker-tjänsten `avkroken` genom den interna Service Bindingen `AVKROKEN_PORTAL_DOCS`.
4. Portalens `DocsInvalidationService` purgar endast `docs-catalog` och berörda `docs-repo-*` cache-tags.
5. Activity/deduplication ligger fortsatt i Skvallerbyttan; portalen blir inte ett parallellt eventlager.

Portalens tidigare direkta GitHub-providerwebhook och dess `/webhooks/github`-endpoint är borttagna. Canonical GitHub-ingress är Skvallerbyttan.

Service Bindingen är intern Cloudflare-RPC och kräver ingen separat webhook-secret.

För operativ drift gäller dessutom:

1. Skvallerbyttan kör readiness-probes och GitHub capability-reconciliation var 15:e minut och persisterar reducerad provider-/scope-state i D1.
2. Resultatet skickas som reducerad heartbeat till `OperationalHeartbeatService`.
3. Portalens Durable Object tidsstämplar mottagningen själv.
4. Utebliven heartbeat i mer än 35 minuter ger e-postnotis; återkommen leverans ger recovery-notis.
5. Publika `/health`/`/ready` används inte och behöver inga edge-undantag.

## Data

D1 används för persistent state, cache, detailed events och reconciliation state. `0004_cloudflare_events.sql` innehåller Cloudflare-eventledgern, `0005_observations.sql` introducerar capability observations och generic Activity ledger, och `0006_capability_scope_observations.sql` lägger till repository-scopeade capability observations, scope coverage samt provider-accepterad permissionmetadata. Produktionsdeploy ska applicera samtliga väntande versionerade D1-migrationer via Wrangler före Worker-deploy.

Workers Analytics Engine dataset `skvallerbyttan_observability` tar read telemetry med consumer-attribution.

## API

Canonical kontrakt ligger under `/api/v1`. Det kan läsas av:

- autentiserad dashboard-session
- machine bearer-token `SKVALLERBYTTAN_READ_API_TOKEN`

Machine access är GET-only och attribueras consumer `chatgpt`.

## Epistemisk modell

Data ska aldrig implikera högre säkerhet än källan stödjer.

- provider current state är högst prioritet
- stale cache är explicit stale
- Activity betyder observerad aktivitet
- derived relationer markeras derived
- provider gaps använder `not_exposed_by_provider` eller `permission_denied`
- frånvaro av observation använder `not_observed` eller `unknown`

## Metrics och kostnad

Read telemetry ligger i Analytics Engine; detailed events ligger i D1.

Analytics Engine har tre månaders retention. SQL-queries väger `_sample_interval` för sampled data. Nuvarande faktiska volume/cost kan först verifieras efter deployment och ska inte uppskattas som live-fakta i förväg.

## Deploymentstatus för detta arkitekturarbete

Repositorykod och dokumentation kan mergeas utan att automatiskt:

- migrera produktions-D1
- skapa machine token
- ändra GitHub App permissions
- ändra Cloudflare API-token permissions
- deploya Worker

Dessa är separata efterföljande driftåtgärder.
## Free-first observability

Skvallerbyttans runtime-observability är Cloudflare-native och ska som standard fungera på Workers Free utan externa telemetry-sinks.

Aktuell produktionskonfiguration:

- Worker-entrypointen använder ingen extern telemetry-SDK.
- Cloudflare Workers Observability samlar invocation logs, exceptions och traces.
- Logs persisteras i Cloudflare med `head_sampling_rate = 0.1`.
- Traces persisteras i Cloudflare med `head_sampling_rate = 0.01`.
- `observability.redact_query_string = true` skyddar OAuth `code`/`state` och andra query-värden före persistens.
- `observability.logs.destinations` och `observability.traces.destinations` ska vara tomma/odeklarerade i den normala produktionstopologin.
- Extern telemetry-export är inte en del av Skvallerbyttans normala produktionskontrakt.
- Produktionsverifieringen failar om externa observability-destinationer återintroduceras eller sampling överskrider organisationens 10%/1%-tak.

Skvallerbyttan har för närvarande ingen AI/LLM- eller Workers AI-anropsväg. Ingen artificiell `gen_ai.conversation.id`-telemetri ska skapas utan en faktisk AI-konversation.
