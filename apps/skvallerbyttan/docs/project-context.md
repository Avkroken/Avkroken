---
layout: default
title: Projektkontext
permalink: /project-context/
---

# Projektkontext

Senast verifierad för GitHub owner-/Portalintegrationen och Portalens public-safe repository-RPC: 2026-09-30.

## Repository

- repository: `Avkroken/Avkroken`
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

Dashboarden erbjuder `legacy`, `forest` (visas som **Avkroken**) och `blackout` via samma presentationskontrakt som Portal, med Legacy som fallback. Skvallerbyttans cyanblå observationsaccent och informationshierarki är app-lokala och behålls. `avkroken_theme` är endast presentationsstate och påverkar aldrig dashboard-auth, machine API eller providerbehörigheter.

## GitHub integrationer

- **GitHub App-auth:** koden använder `GAMNACKEN_GITHUB_APP_*`-bindings för read-only GitHub-observationer. Faktisk App-installation och eventuell äldre App-state är extern GitHub-state.
- **GitHub OAuth:** interaktiv login går direkt mot GitHub med state, PKCE S256 och numerisk GitHub-ID-allowlist.
- **GitHub webhook-ingress:** runtime verifierar signerade provider-webhooks och begränsar accepterade repositoryevents till konfigurerad owner `Avkroken` via `organization.login` eller `repository.owner.login`; faktisk hookkonfiguration är extern GitHub-state.
- **Avkroken portal signal:** docs-relevanta GitHub-events skickas internt via Cloudflare Service Binding `AVKROKEN_PORTAL_DOCS` till deklarerat service target `avkroken`/`DocsInvalidationService`; portalen behöver därmed ingen egen provider-webhook för detta.
- **Operativ heartbeat:** runtime skickar receiver-observerad liveness/readiness via `AVKROKEN_OPERATIONS` till `avkroken`/`OperationalHeartbeatService`; portalens oberoende watchdog larmar vid utebliven förväntad leverans.
- **Portal Drift & insyn:** Skvallerbyttan exporterar named RPC-entrypointen `PortalObservationsService`. Avkroken-portalen binder till just den entrypointen och kan endast läsa public-safe downstreammodeller.
- **Portal repository-inventory:** samma named entrypoint exponerar `getPublicRepositories()`. Metoden läser GitHub App-installationens repositoryinventory med befintlig read-only auth och returnerar endast sanerad publik repositorymetadata som Portalens publiceringsadapter behöver; private/archived/annan owner, permissions, rate-limit/budget, installationmetadata och credentials lämnar inte observationslagret. Productionvägen verifierades 2026-09-30 genom samtidig Worker-tail (`PortalObservationsService.getPublicRepositories - Ok`) och Portalens lyckade första v9-projektkatalogbuild.
- **Portal documentation inventory:** `getPublicDocumentationIndex(repositoryNames)` intersectar begärda namn med samma live-public inventory och läser därefter Git-tree med GitHub App-auth. Endast root `README.md`, Markdown under `docs/` samt app-lokal README/`docs/` för de uttryckligen publika monorepo-apparna `apps/skvallerbyttan` och `apps/dumpen` lämnar observationslagret; `apps/jobb` och övriga app-prefix är fortsatt spärrade. Tree SHA:n, blobs, permissions och providerbudget gör det inte.
- **Portal release candidates:** `getPublicRepositoryReleases(repositoryNames, limit)` använder samma publiceringsgrind och returnerar endast bounded, canonical publicerade releasekandidater. Drafts och cross-repository URLs filtreras bort före RPC-svaret.
- **Portal repository-CI:** samma named entrypoint exponerar `getPublicRepositoryCi(repoName)`, som endast läser canonical `overview` source cache, kräver en cachead publik/icke-arkiverad repositoryrad och returnerar en sanerad sampled Actions-summary med explicit freshness. Metoden gör ingen GitHub-providerrequest.
- **Portal repository-Activity:** samma named entrypoint exponerar `getPublicActivity(repositoryNames, days)`. Metoden intersectar en bounded repositorylista med cachead publik/icke-arkiverad `overview`-state och queryar därefter endast D1 `observation_events` för `provider = github` och de godkända repositorykortnamnen. Ingen providerrequest görs; public snapshot saknar resource-ID:n, actors, permissions, providerfel och rå webhookpayload.
- **Portal release-deployments:** `getPublicReleaseDeployments(requests)` verifierar först live GitHub App-installationens repositoryinventory och accepterar endast public/icke-arkiverade repositories. Därefter läses högst två deployment-sidor per högst åtta repositories och högst 20 exakta commit-SHA per repository matchas. Svaret innehåller endast repository, SHA, sanerat environment och created/updated-tid; deployment-ID, ref, providerpayload, creator och externa deployment-URL:er exponeras inte.

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

Produktionsdeployment utförs av Cloudflare Workers Builds med Cloudflare-ägd buildidentitet. GitHub Actions bär ingen Cloudflare deploycredential och synkar inte runtime-secrets till Workern.

Cloudflare-account-ID är versionerad icke-hemlig config. GitHub- och Cloudflare-webhooks använder var sitt canonical secret. Cloudflare Notifications och Workers Issues använder `CLOUDFLARE_NOTIFICATIONS_WEBHOOK_SECRET` via `cf-webhook-auth`; CASB använder sitt befintliga separata secret. Runtime implementerar push-ingress för Cloudflare Notifications, Workers Issues och CASB samt read-paths för Audit Logs och reconciliation. Workers Issues-ingressen läser request-body först efter godkänd webhook-auth och persisterar endast en explicit top-level allowlist; `text`, `data`, stack traces, loggar och request-/application-context lagras inte. Faktisk Cloudflare webhookkonfiguration är extern providerstate. Observationskoden använder inga provider-write-operationer.

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
13. Release-deployment-RPC:n använder samma befintliga read-only GitHub App, gör en live public-repository-grind före deploymentread och korrelerar endast exakta 40-teckens commit-SHA. Om deploymentinventory är trunkerat och ingen match hittas får frånvaro inte tolkas som komplett; Portal visar då `unknown`.

## Data

Produktionsbindingen `STATS_DB` ska peka på en D1-databas skapad med Cloudflare-jurisdiction `eu`. Jurisdiction är providerstate som sätts vid databasskapande och ska verifieras live vid replacement/cutover.

D1 används för persistent state, cache, detailed events och reconciliation state. `0004_cloudflare_events.sql` introducerar Cloudflare-eventledgern, `0005_observations.sql` introducerar capability observations och generic Activity ledger, `0006_capability_scope_observations.sql` lägger till repository-scopeade capability observations, scope coverage samt provider-accepterad permissionmetadata och `0007_cloudflare_issue_events.sql` utökar den reducerade Cloudflare-eventkällan med `issues` utan att lägga till rå diagnostik. Produktionsdeploy ska applicera samtliga väntande versionerade D1-migrationer via Wrangler före Worker-deploy.

Workers Analytics Engine dataset `skvallerbyttan_observability` tar read telemetry med consumer-attribution.

## API

Canonical HTTP-kontrakt ligger under `/api/v1`. Det kan läsas av:

- autentiserad dashboard-session
- machine bearer-token `SKVALLERBYTTAN_READ_API_TOKEN`

Machine access är GET-only och attribueras consumer `chatgpt`.

Portalens publika repository-/dokumentationsinventory, releasekandidater, Drift & insyn, repository-CI, release-deployment-korrelation och public-safe repository-Activity använder **inte** detta HTTP-kontrakt och får ingen bearer-token. De använder endast named `PortalObservationsService`, som är ett separat sanerat downstream-kontrakt.

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

## Deploymentmodell

Merge till `main` kan utlösa Cloudflare Workers Builds. Repositoryts produktionskommando är `npm run deploy:workers-builds` och gör verifiering, väntande D1-migrationer, Worker-deploy och produktionskontraktsverifiering i ordning.

Secret-provisionering, GitHub App-permissions och Cloudflare provider-tokenpermissions ändras inte av repositorydeployen och förblir separat providerstate.

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
