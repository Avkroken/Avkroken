---
layout: default
title: Projektkontext
permalink: /project-context/
---

# Projektkontext

Senast verifierad för GitHub owner-/Portalintegrationen: 2026-09-26.

## Repository

- repository: `blixten85/Avkroken`
- app path: `apps/skvallerbyttan`
- default branch: `main`
- runtime: TypeScript Cloudflare Worker
- production domain: `https://skvallerbyttan.denied.se`
- dashboard: privat
- appdokumentation: versionsstyrd i monorepot; ingen separat Pages-publicering
- Portal-publicering: `portal.public.json` är appens explicita opt-in till Avkrokens publika projekt- och dokumentationskatalog; Portalen får rendera appens README/`docs/` med canonical original-länk, men manifestet publicerar ingen dashboard-URL och ändrar inte dashboardens privata accessmodell
- full repository check: `npm run check`

## Produktansvar

Skvallerbyttan är Avkrokens centrala **read-only observationslager och eventnav** för GitHub och Cloudflare. Dashboard och machine API delar samma canonical normaliserade state. Provider-webhooks ska termineras här; andra Avkroken-tjänster reagerar via interna signaler i stället för att skapa parallella provider-integrationer.

Skvallerbyttans app-local tekniska current-state ägs av `apps/skvallerbyttan`. Portal och andra appar i samma monorepo har egna ansvar; delad monorepo-kontext dokumenteras endast när den faktiskt delas.

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

- **GitHub App-auth:** koden använder `GAMNACKEN_GITHUB_APP_*`-bindings för read-only GitHub-observationer. Faktisk App-installation och eventuell äldre App-state är extern GitHub-state.
- **GitHub OAuth:** interaktiv login går direkt mot GitHub med state, PKCE S256 och numerisk GitHub-ID-allowlist.
- **GitHub webhook-ingress:** runtime verifierar signerade provider-webhooks och begränsar accepterade repositoryevents till konfigurerad owner `blixten85` via `organization.login` eller `repository.owner.login`; faktisk hookkonfiguration är extern GitHub-state.
- **Avkroken portal signal:** docs-relevanta GitHub-events skickas internt via Cloudflare Service Binding `AVKROKEN_PORTAL_DOCS` till deklarerat service target `avkroken`/`DocsInvalidationService`; portalen behöver därmed ingen egen provider-webhook för detta.
- **Operativ heartbeat:** runtime skickar receiver-observerad liveness/readiness via `AVKROKEN_OPERATIONS` till `avkroken`/`OperationalHeartbeatService`; portalens oberoende watchdog larmar vid utebliven förväntad leverans.
- **Portal Drift & insyn:** Skvallerbyttan exporterar named RPC-entrypointen `PortalObservationsService`. Avkroken-portalen binder till just den entrypointen och kan endast läsa en public-safe snapshot av provider health och capability status/dataState/freshness/last-success.
- **Portal repository-CI:** samma named entrypoint exponerar `getPublicRepositoryCi(repoName)`, som endast läser canonical `overview` source cache, kräver en cachead publik/icke-arkiverad repositoryrad och returnerar en sanerad sampled Actions-summary med explicit freshness. Metoden gör ingen GitHub-providerrequest.
- **Portal repository-Activity:** samma named entrypoint exponerar `getPublicActivity(repositoryNames, days)`. Metoden intersectar en bounded repositorylista med cachead publik/icke-arkiverad `overview`-state och queryar därefter endast D1 `observation_events` för `provider = github` och de godkända repositorykortnamnen. Ingen providerrequest görs; public snapshot saknar resource-ID:n, actors, permissions, providerfel och rå webhookpayload.

GitHub REST API-version: `2026-03-10`.

GitHub-providerobservationer använder endast read-behörigheter. Administration read får användas där GitHub kräver den nivån. Repository effective rulesets används med Metadata read.

Var 15:e minut körs en begränsad GitHub capability-reconciliation för GitHub App-installationens repository inventory, verkliga PR/issues-reads, Actions och repository effective rulesets. Organization-only security/governance-capabilities returnerar `not_supported` när installationens account type är User. PR/issues, Actions och effective rulesets persisteras per repository och aggregeras med explicit scope coverage. Capability freshness för dessa ytor är 20 minuter så normal 15-minuterskadens inte växlar till stale mellan körningarna.

Runtime behåller endast sanerad GitHub App-permissionmetadata från installationen/tokenen och endpointens `X-Accepted-GitHub-Permissions`; inga token- eller private-key-värden exponeras.

## Cloudflare

Skvallerbyttans Cloudflare-provider är read-only. Den stabila credentialmodellen är en del av Skvallerbyttans eget kod- och säkerhetskontrakt; `../../../docs/organization/cloudflare-credential-standard.md` är endast en monorepo-lokal sammanfattning, inte extern source of truth.

Provider-reads är partitionerade och rangordnade utan arv:

- **R1 — Platform / Resource Read:** Zones, Workers, D1 inventory, KV namespace inventory och R2 bucket inventory.
- **R2 — Analytics / Content / Operations Read:** Account, Notifications, Audit Logs och Analytics Engine SQL för read telemetry.
- **R3 — Security / Identity Read:** Access applications, Tunnels och CASB.

Runtime binder `CLOUDFLARE_API_TOKEN_R1`, `CLOUDFLARE_API_TOKEN_R2` och `CLOUDFLARE_API_TOKEN_R3` direkt från Cloudflare Secrets Store utan generisk tokenfallback.

GitHub Actions som muterar Cloudflare använder W1-credentialen när den finns. Runtime-secret-sync kopierar inte längre R1/R2/R3 från GitHub till vanliga Worker secrets.

Cloudflare-account-ID är versionerad icke-hemlig config. GitHub- och Cloudflare-webhooks använder var sitt canonical secret; Notifications och CASB delar Cloudflare-webhooksecretet. Runtime implementerar push-ingress för Cloudflare Notifications/CASB samt read-paths för Audit Logs och reconciliation. Faktisk Cloudflare webhookkonfiguration är extern providerstate. Observationskoden använder inga provider-write-operationer.

## Interna event-signaler

Downstream-tjänster får inte behöva duplicera providerautentisering enbart för cache/freshness-signaler.

För publik repositorydokumentation:

1. GitHub levererar `push`/`repository` till Skvallerbyttan.
2. Skvallerbyttan verifierar webhooksignaturen och owner-gränsen.
3. Relevanta docs-events signaleras till deklarerat service target `avkroken` genom Service Bindingen `AVKROKEN_PORTAL_DOCS`.
4. Portalens `DocsInvalidationService` purgar endast `docs-catalog` och berörda `docs-repo-*` cache-tags.
5. Activity/deduplication ligger fortsatt i Skvallerbyttan; portalen blir inte ett parallellt eventlager.

Portalens kod har ingen parallell GitHub-providerendpoint för detta flöde; repositoryts interna docs-signaler produceras från Skvallerbyttans webhookkod.

Service Bindingen är intern Cloudflare-RPC och kräver ingen separat webhook-secret.

För operativ drift gäller dessutom:

1. Skvallerbyttan kör readiness-probes och GitHub capability-reconciliation var 15:e minut och persisterar reducerad provider-/scope-state i D1.
2. Resultatet skickas som reducerad heartbeat till `OperationalHeartbeatService`.
3. Portalens Durable Object tidsstämplar mottagningen själv.
4. Utebliven heartbeat i mer än 35 minuter ger e-postnotis; återkommen leverans ger recovery-notis.
5. Publika `/health`/`/ready` används inte och behöver inga edge-undantag.
6. När Portalens Drift & insyn-vy läses anropar Portal `PortalObservationsService.getPublicOperationsSummary()` via account-intern Service Binding.
7. RPC-snapshoten innehåller inte provider-endpoints/required permissions, accepterade permissions, HTTP-status/felsträngar eller installation-/budgetmetadata.
8. Den generella Drift-snapshoten skickar inte scope coverage/repositoryantal eller organisationsomfattande Activity/eventvolym till Portalen.
9. För repository-CI läser `getPublicRepositoryCi()` endast D1 source cache-keyn `overview`; repoName måste matcha en cachead rad med `visibility = public` och `archived != true`.
10. CI-RPC:n returnerar sampled Actions-summary och `sourceRefreshedAt`/freshness, men inte actor, provider-permissions/fel, event breakdown eller rå runpayload. Saknad cache är `not_observed`, inte healthy.
11. För Portal-Activity tar `getPublicActivity()` endast bounded repositorykortnamn, intersectar dem med cachead publik/icke-arkiverad `overview`, och queryar därefter D1-ledgern med explicit repositoryfilter. En explicit lista som blir tom fail-closed och kan inte bli en owner-wide query.
12. Activity-RPC:n returnerar endast GitHub aggregate counts/coverage och sanerade repositoryevents utan `resourceId`, actor eller rå payload. Endast capabilities `github.avkroken.repositories`, `github.avkroken.pull_requests` och `github.avkroken.actions` får publiceras; security, Custom Properties och effective-ruleset-events filtreras bort. Cloudflare account-/org-events går inte genom detta kontrakt.

## Data

Produktionsbindingen `STATS_DB` ska peka på en D1-databas skapad med Cloudflare-jurisdiction `eu`. Jurisdiction är providerstate som sätts vid databasskapande och ska verifieras live vid replacement/cutover.

D1 används för persistent state, cache, detailed events och reconciliation state. `0004_cloudflare_events.sql` innehåller Cloudflare-eventledgern, `0005_observations.sql` introducerar capability observations och generic Activity ledger, och `0006_capability_scope_observations.sql` lägger till repository-scopeade capability observations, scope coverage samt provider-accepterad permissionmetadata. Produktionsdeploy ska applicera samtliga väntande versionerade D1-migrationer via Wrangler före Worker-deploy.

Workers Analytics Engine dataset `skvallerbyttan_observability` tar read telemetry med consumer-attribution.

## API

Canonical HTTP-kontrakt ligger under `/api/v1`. Det kan läsas av:

- autentiserad dashboard-session
- machine bearer-token `SKVALLERBYTTAN_READ_API_TOKEN`

Machine access är GET-only och attribueras consumer `chatgpt`.

Portalens Drift & insyn, repository-CI och public-safe repository-Activity använder **inte** detta HTTP-kontrakt och får ingen bearer-token. De använder endast named `PortalObservationsService`, som är ett separat sanerat downstream-kontrakt.

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
## Observability

Skvallerbyttans Wrangler-konfiguration använder Cloudflare-native observability utan externa telemetry-sinks.

Repository-deklarerad observability-konfiguration:

- Worker-entrypointen använder ingen extern telemetry-SDK.
- Cloudflare Workers Observability samlar invocation logs, exceptions och traces.
- Logs persisteras i Cloudflare med `head_sampling_rate = 0.1`.
- Traces persisteras i Cloudflare med `head_sampling_rate = 0.01`.
- `observability.redact_query_string = true` skyddar OAuth `code`/`state` och andra query-värden före persistens.
- `observability.logs.destinations` och `observability.traces.destinations` ska vara tomma/odeklarerade i den normala produktionstopologin.
- Extern telemetry-export är inte en del av Skvallerbyttans normala produktionskontrakt.
- Produktionsverifieringen kontrollerar externa observability-destinationer och de samplinggränser som repositoryt själv deklarerar.

Skvallerbyttan har för närvarande ingen AI/LLM- eller Workers AI-anropsväg. Ingen artificiell `gen_ai.conversation.id`-telemetri ska skapas utan en faktisk AI-konversation.
