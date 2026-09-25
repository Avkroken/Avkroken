---
layout: default
title: Drift
permalink: /operations/
---

# Drift

## Verifiering

```bash
npm ci
npm run check
```

`npm run check` kör:

1. testsvit
2. TypeScript typecheck
3. `wrangler deploy --dry-run`

Dry-run är inte deployment.

## Bindings och secrets

Wrangler definierar:

- `ASSETS`
- `STATS_DB` — D1 target `skvallerbyttan-stats-eu`
- `OBSERVABILITY` — Analytics Engine dataset `skvallerbyttan_observability`
- `AVKROKEN_PORTAL_DOCS` — Cloudflare Service Binding som deklarerar service target `avkroken`, entrypoint `DocsInvalidationService`
- `AVKROKEN_OPERATIONS` — Cloudflare Service Binding som deklarerar service target `avkroken`, entrypoint `OperationalHeartbeatService`
- exported named entrypoint `PortalObservationsService` — inbound read-only RPC för Portalens sanerade Drift & insyn-, repository-CI- och repository-Activity-snapshots; ingen separat secret eller publik HTTP-route
- cron `0 */6 * * *` för reconciliation
- cron `*/15 * * * *` för operativ heartbeat och global GitHub/Cloudflare capability-reconciliation
- custom domain `skvallerbyttan.denied.se`
- Cloudflare account via versionerad `account_id`

Icke-hemlig versionsstyrd runtime-konfiguration:

- `CLOUDFLARE_ACCOUNT_ID`
- `GITHUB_OAUTH_CLIENT_ID`

`GAMNACKEN_GITHUB_APP_CLIENT_ID` är icke-hemligt och synkas från GitHub Actions-variable till en Worker runtime-binding tillsammans med Gamnackens App-nyckel.

Cloudflare Secrets Store-bindings:

- `CLOUDFLARE_API_TOKEN_R1` — Platform / Resource Read
- `CLOUDFLARE_API_TOKEN_R2` — Analytics / Content / Operations Read
- `CLOUDFLARE_API_TOKEN_R3` — Security / Identity Read
- `GITHUB_OAUTH_CLIENT_SECRET`

Varje bunden Secrets Store-secret ska ha `workers` i sin scope-lista. Bindings hämtar värden asynkront via `get()`; kodvägarna använder inte äldre generiska Cloudflare-token som fallback.

Vanliga Worker runtime-bindings/secrets:

- `GAMNACKEN_GITHUB_APP_CLIENT_ID` — icke-hemlig App-identifierare, synkad från GitHub Actions-variable
- `GAMNACKEN_GITHUB_APP_PRIVATE_KEY` — Gamnackens privata RSA-nyckel
- `SKVALLERBYTTAN_SESSION_SECRET`
- `SKVALLERBYTTAN_WEBHOOK_SECRET` — GitHub provider-webhook
- `CLOUDFLARE_NOTIFICATIONS_WEBHOOK_SECRET`
- `CLOUDFLARE_CASB_WEBHOOK_SECRET`
- `SKVALLERBYTTAN_READ_API_TOKEN` — valfri machine read API

Gamnackens GitHub App-identitet består i runtime av `GAMNACKEN_GITHUB_APP_CLIENT_ID` och `GAMNACKEN_GITHUB_APP_PRIVATE_KEY`. GitHub Actions-workflows refererar till samma bindingnamn. App-JWT signeras med RS256; private key måste höra till Gamnacken. Koden accepterar PKCS#1 `RSA PRIVATE KEY` och PKCS#8 `PRIVATE KEY`; PKCS#1 wrap:as till PKCS#8 i minnet före Web Crypto-import. GitHub App client secret behövs inte för installation-auth-flödet. Repositorykoden använder dessa bindingnamn för GitHub App-auth.

GitHub Actions som muterar Cloudflare använder endast `CLOUDFLARE_API_TOKEN_W1`. Wrangler får värdet via den miljövariabel som verktyget kräver, `CLOUDFLARE_API_TOKEN`, men det finns inget generiskt org-secret med det namnet.

### Runtime credential contract

Repositoryt deklarerar GitHub App-bindings med namnen:

- `GAMNACKEN_GITHUB_APP_CLIENT_ID`
- `GAMNACKEN_GITHUB_APP_PRIVATE_KEY`

Faktisk GitHub App-installation, secret-/variable-provisionering och eventuell äldre App-state är extern GitHub/Cloudflare-state och dokumenteras inte här.

### Runtime secret-sync

`../../../.github/workflows/sync-skvallerbyttan-runtime-secrets.yml` är endast `workflow_dispatch` och delar concurrency-grupp med produktionsdeploy. Före någon Worker-binding skrivs validerar workflowen Skvallerbyttans Client ID och private key mot GitHub som App och mot Avkrokens App-installation. Ett ogiltigt eller mismatchat client-id/private-key-värde stoppar synken före mutation.

Workflowen använder W1 och synkar endast Worker-lokala bindings/secrets som den ensam äger på runtime-sidan:

- `GAMNACKEN_GITHUB_APP_CLIENT_ID` från GitHub Actions-variable
- `GAMNACKEN_GITHUB_APP_PRIVATE_KEY` från GitHub Actions-secret
- valfri `SKVALLERBYTTAN_READ_API_TOKEN`

`SKVALLERBYTTAN_WEBHOOK_SECRET` ingår avsiktligt **inte** i den generella runtime-secret-syncen. GitHub-webhookens secret är ett kopplat provider-/runtimevärde: om endast Worker-sidan skrivs om bryts HMAC-verifieringen för alla GitHub-leveranser. En rotation ska därför göras som en samordnad driftåtgärd där samma värde sätts på GitHub organization webhook och Worker-secretet och därefter verifieras med en signerad leverans som returnerar HTTP 202.

R1/R2/R3 och GitHub OAuth client secret läses direkt från Cloudflare Secrets Store.

Runtimekoden verifierar organization-webhookpayloads med `SKVALLERBYTTAN_WEBHOOK_SECRET`. Gamnacken används av koden för read-auth; faktisk App-/organization-webhookkonfiguration är extern GitHub-state. Runtime identifierar en kvarvarande App-webhook primärt via GitHubs `X-GitHub-Hook-Installation-Target-Type: integration` och använder payloadens `installation` endast som fallback. Sådana leveranser kvitteras tyst med HTTP 202 och får inte skapa Activity, cacheinvalidations, säkerhetsledger eller en extra warning-logg per leverans. Cloudflare Notifications använder `CLOUDFLARE_NOTIFICATIONS_WEBHOOK_SECRET` och CASB använder `CLOUDFLARE_CASB_WEBHOOK_SECRET`.

### Återställning vid GitHub-webhookstorm

Om Workers Logs visar stora mängder `POST /webhooks/github` ska hook-targeten avgöra åtgärden:

- `integration`: runtime behandlar GitHub App-webhookingress som migrations-/legacyinput. Vilka Apps eller webhooks som faktiskt finns i GitHub måste verifieras externt.
- `organization` med `invalid webhook signature`: verifiera att GitHub-webhooken och Worker-runtime använder samma HMAC-secret utan att skriva ut värdet.
- Vid rotation måste provider- och runtime-sidan uppdateras samordnat och därefter verifieras med en signerad leverans.
- Skicka eller dokumentera aldrig själva secretvärdet i repository, PR, logg eller chatt.

GitHub-webhookkoden kan trigga portalens dokumentationsfreshness. På docs-relevanta `push`-events på publik default branch samt `repository`-events anropar Skvallerbyttan `AVKROKEN_PORTAL_DOCS.invalidateDocs(...)`. RPC-anropet kräver ingen ytterligare secret och går inte via publik HTTP. Tre korta retryförsök görs; vid fortsatt fel loggas signalfelet medan GitHub-eventet fortfarande kan lagras och portalens edge-TTL fungerar som fallback.

Webhooken lagrar alla signerade, organisationsmatchande leveranser som reducerad Activity. Händelser som motsvarar canonical dashboard-state invalidaterar dessutom berörda source-cacher. `custom_property` och `custom_property_values` invalidaterar governance/effective-policy så ändrade Custom Properties blir synliga utan att vänta på TTL. Issue-relation events klassificeras under den gemensamma pull-request/issues-capabilityn utan att råpayload sparas.

Deploy av en Worker med Secrets Store-bindings kräver att W1 täcker Secrets Store Write. Varje bunden secret måste dessutom vara scope:ad för `workers`.

### Rotation

Permissionsändring och secretrotation är separata operationer.

För en etablerad klass:

1. rolla endast den aktuella Cloudflare-tokenen,
2. uppdatera motsvarande centrala credentialvärde,
3. synka berörda runtime-bindings/secrets,
4. verifiera provider capabilities,
5. revokera eller ta bort gamla migreringscredentials först när de inte längre används.

## Event-ingress och downstream-signaler

Provider-ingress som runtimekoden stödjer:

- GitHub: `POST /webhooks/github`
- Cloudflare Notifications: `POST /webhooks/cloudflare/notifications`
- Cloudflare CASB: `POST /webhooks/cloudflare/casb`

Provider-webhooks ska inte dupliceras i front-Workern enbart för att driva cacheinvalidation. Skvallerbyttan verifierar providerhändelsen först och skickar därefter en minimal intern signal till berörd konsument.

För Avkroken-portalen används Service Binding-konfigurationen:

```json
{
  "binding": "AVKROKEN_PORTAL_DOCS",
  "service": "avkroken",
  "entrypoint": "DocsInvalidationService"
}
```

service target `avkroken` måste exponera den deklarerade entrypointen innan en Skvallerbyttan-version med bindingen kan fungera. Bindingen är account-intern och använder inte GitHub- eller Cloudflare-webhooksecrets.

### Portal Drift & insyn RPC

Skvallerbyttan exporterar `PortalObservationsService` från huvud-entrypointen. Avkroken-portalen deklarerar en separat Service Binding med target `skvallerbyttan` och denna named entrypoint.

RPC:n:

- använder inte `SKVALLERBYTTAN_READ_API_TOKEN`, OAuth-session eller publik HTTP;
- returnerar public-safe downstreammodeller med separata kontrakt för Drift, repository-CI och repository-Activity;
- den generella Drift-metoden exponerar inte required/accepted provider permissions, HTTP-status/fel, installation-/budgetmetadata, scope coverage/repositoryantal eller Activity/eventvolym;
- gör inga provider-write-operationer;
- lämnar full/detailed Activity och repository-scopead Insyn bakom Skvallerbyttans autentiserade dashboard/API;
- exponerar `getPublicRepositoryCi(repoName)` som en separat summary-only metod som läser `overview` source cache, kräver cachead `visibility = public`/icke-arkiverad repositoryrad och aldrig startar en Actions-providerread;
- exponerar `getPublicActivity(repositoryNames, days)` som en separat repository-allowlistad metod. Den intersectar högst 50 repositorykortnamn med cachead publik/icke-arkiverad `overview`, queryar därefter endast D1 `observation_events` för GitHub och exakt dessa repositories, och publicerar inte resource-ID:n, actors, providerfel, permissions eller rå webhookpayload.

Eftersom Portalens Worker-konfiguration refererar till en named entrypoint måste en produktionsutrullning ske i beroendeordning: deploya först den mergade Skvallerbyttan-versionen som exporterar `PortalObservationsService`, verifiera dess Worker-deploy, och deploya därefter Portal-versionen som binder till entrypointen. Det här repositoryarbetet utför ingen av dessa deployments. Skvallerbyttan-versionen med både `getPublicRepositoryCi` och `getPublicActivity` måste vara deployad innan en Portal-version som anropar dessa metoder.

Cloudflare Audit Logs och den schemalagda reconciliation-körningen fortsätter vara safety net för händelser som inte levereras via Notifications/CASB.

### Portal Activity RPC

`getPublicActivity(repositoryNames, days)` är inte en proxy till `/api/v1/activity`. Den använder D1 direkt genom Skvallerbyttans interna Activity-modell efter en separat publiceringskontroll.

- `repositoryNames` valideras, dedupliceras och begränsas till 50;
- begärda namn måste även finnas i cachead `overview` som `visibility = public` och inte arkiverade;
- saknad overview eller noll godkända repos ger `not_observed` utan bred D1-query;
- Activity-queryn filtrerar `provider = github` och explicit `repository IN (...)`; en explicit tom lista ger `1 = 0`;
- `days` begränsas till 1–30;
- recent-queryn är fortsatt max 100 rader efter repositoryfiltret;
- public-sanitizern tar bort `resourceId`, resource type, actor och alla råa provider-/credentialfält;
- endast capabilities `github.avkroken.repositories`, `github.avkroken.pull_requests` och `github.avkroken.actions` tillåts; security, Custom Properties och effective-ruleset-events filtreras bort;
- Cloudflare account-/org-events ingår inte i Portal-kontraktet;
- coverage och `periodComplete = false` ska visas som observationsmetadata, inte som komplett aktivitet.
## Push-baserad liveness och readiness

Skvallerbyttan använder inte publika `/health`, `/healthz` eller `/ready` som driftmekanism. De publika pull-endpointsen har tagits bort; Bot Fight Mode/WAF ska inte behöva undantag för externa monitorer.

Var 15:e minut gör runtime en intern readiness-probe och levererar resultatet via `AVKROKEN_OPERATIONS.postHeartbeat(...)` till Avkroken-portalen. Readiness är true endast när samtliga kontroller passerar:

- lokal auth-/runtimekonfiguration
- D1 `SELECT 1`
- läsbar Gamnacken/GitHub OAuth/R1/R2/R3 credentialkonfiguration
- GitHub App-probe via den konfigurerade Gamnacken-bindingen
- Cloudflare R1-probe via Zones
- Cloudflare R2-probe via Account
- Cloudflare R3-probe via Tunnels

Heartbeat-leveransen skickas även när readiness är false. GitHub-proben skriver `github.avkroken.repositories` och Cloudflare R1/R2/R3-proberna skriver sina reducerade resultat till `capability_observations`, så provider-health överlever Worker-isolatgränser och kan skilja `available`, `permission_denied`, `error` och verkligt `not_observed`. En capability-specifik 403 från exempelvis organization governance får därmed inte felaktigt klassificera hela GitHub-providern som auth-fel. Mottagarsidan avgör liveness utifrån egen mottagningstid.

Avkroken-portalen lagrar heartbeat i ett separat Durable Object, förväntar leverans var 15:e minut och larmar via Cloudflare Email Service om ingen leverans har mottagits inom 35 minuter. Portalens watchdog kör var 10:e minut. När leveransen återkommer efter stale skickas återställningsnotis. Inga providercredentials eller providerpayloads ingår i heartbeat.

## D1 data locality och replication

`STATS_DB` ska använda en D1-databas skapad med `jurisdiction=eu`. Jurisdiction kan inte läggas till på en befintlig databas; replacement kräver ny EU-databas, verifierad export/import och därefter binding-cutover.

Read replication ska vara avstängd tills Skvallerbyttans read-path använder D1 Sessions API. Utan Sessions API fortsätter queries mot primären även om replicas är aktiverade.

## Migrationer

D1-migrationer:

- `0001_statistics_history.sql`
- `0002_api_cache.sql`
- `0003_security_events.sql`
- `0004_cloudflare_events.sql`
- `0005_observations.sql`
- `0006_capability_scope_observations.sql`

`0004` skapar `cloudflare_events`. `0005` skapar `capability_observations` och `observation_events`. `0006` utökar capability summary med accepterade permissions/scope coverage och skapar `capability_scope_observations` för repository-scopead provider-state.

Produktionsworkflowen använder `wrangler d1 migrations apply STATS_DB --remote` för att applicera **alla väntande versionsstyrda migrationer i ordning** före deploy. De befintliga migrationerna använder `CREATE ... IF NOT EXISTS`, vilket gör bootstrap av Wranglers migrationsregister säker även om en äldre tabell redan skapats manuellt. Repositoryverifiering applicerar inga remote-migrationer.

## Retention

Nuvarande policy i kod/runtime:

| Datatyp | Retention |
| --- | --- |
| webhook delivery dedup | 7 dagar |
| generic `observation_events` | 90 dagar |
| äldre Cloudflare detailed events | 90 dagar |
| Analytics Engine read telemetry | 3 månader, provider-managed |
| source cache | senaste canonical entry per key |
| snapshots | ingen automatisk prune i nuvarande implementation |
| security event ledger | ingen automatisk prune i nuvarande implementation |

Snapshot/security-retention är därför en känd operativ begränsning, inte en dold standard.

## Metricsval

Read telemetry ligger i Workers Analytics Engine i stället för D1. Skälen är att telemetry ligger på en högfrekvent kodväg, Analytics Engine-write är avsedd för detta och D1-write för varje cache-hit skulle ge onödiga row writes.

Publika providergränser som påverkar valet ska verifieras mot aktuell Cloudflare-dokumentation:

- Analytics Engine retention: 3 månader.
- Workers Paid publicerad prismodell: 10 miljoner datapunkter/månad inkluderat, därefter $0.25/miljon; 1 miljon SQL reads/månad inkluderat, därefter $1.00/miljon.
- Cloudflare anger fortfarande att Analytics Engine ännu inte faktureras trots publicerad kommande prismodell.
- D1 Workers Paid inkluderar 25 miljarder rows read/månad och 50 miljoner rows written/månad; write-overage är $1/miljon rows.

Faktisk Skvallerbyttan-volym efter denna ändring är inte verifierad före deployment. En Analytics Engine datapunkt skrivs per instrumenterad read/refresh. Activity-events skrivs endast för observerade provider-events, inte cache-hits.

## Reconciliation

Cron var 15:e minut:

- kör GitHub repository inventory
- läser verkliga öppna pull requests och issues per repository
- läser Actions runs per repository
- läser organization code scanning, Dependabot och secret scanning alerts
- läser och normaliserar repository effective rulesets med bounded concurrency
- uppdaterar repository-scope coverage och capability freshness

Cron var sjätte timme fortsätter som bredare safety net:

- uppdaterar GitHub overview
- uppdaterar GitHub organization governance där read-permission finns
- uppdaterar Cloudflare account/zones/Workers
- uppdaterar D1/KV/R2 inventories
- uppdaterar Access applications och Tunnels
- läser ett begränsat Audit Log-fönster och deduplicerar event
- prunar gamla Activity-events och webhook deliveries

Reconciliation ska inte skapa provider-write-trafik.

### Portal repository-CI cache

`getPublicRepositoryCi` läser endast D1 source cache-keyn `overview`. Den använder inte det privata HTTP-API:t och gör ingen providerrequest.

RPC:n beräknar downstream freshness så här:

- cache saknas: `unknown` + `not_observed`;
- cache högst sex timmar och ej invaliderad: `fresh`;
- cache äldre än sex timmar eller invaliderad: `stale`.

En stale snapshot får returneras för graceful degradation men måste visas som stale i Portalen. Portal-läsning triggar ingen background/providerrefresh; canonical refresh sker genom Skvallerbyttans egna reconciliation/operatorvägar.

## Cache

TTL är capability- och route-specifik. Dashboarden läser endast canonical `/api/v1`-routes. **Uppdatera** är en explicit operator-refresh: i Insyn kör `/api/v1/capabilities?refresh=1` samma globala read-only GitHub/Cloudflare capability-reconciliation som cron använder innan capability-state returneras. Övriga flikar gör provider-refreshen färdig först, renderar den nya aktiva state:n och uppdaterar därefter Overview/tidsstämpeln. På Översikt refreshas både GitHub- och Cloudflare-state före Overview, så en flyttad `Genererad`-tid betyder att operator-refreshen är färdig. Knappen är låst och markerad `aria-busy` under körningen. Machine-read consumers får inte forcera canonical provider-refresh med query-parametern.

Stale data kan returneras med headers:

- `X-Skvallerbyttan-Cache`
- `X-Skvallerbyttan-Cache-Age`
- `X-Skvallerbyttan-Cache-Refreshed-At`
- `X-Skvallerbyttan-Cache-Ttl`

Stale state startar background refresh genom single-flight när möjligt.

## Provider budgets

GitHub använder normala response headers för limit, remaining, used, reset, resource och Retry-After.

Cloudflare sparar Ratelimit/Ratelimit-Policy/Retry-After och throttlingstate från normala API-responser.

Insyn visar denna senaste observerade budgetstate. Avsaknad av tidigare anrop är `not_observed`, inte healthy.


## Explicit produktionsdeploy

`.github/workflows/deploy-production.yml` är den reproducerbara vägen för att föra en redan mergad version till produktion. Workflowen är endast `workflow_dispatch`, vägrar köra från annat ref än `main` och kör i ordning:

1. `npm run check`
2. valfri, default-på `wrangler d1 migrations apply STATS_DB --remote` för alla väntande versionerade D1-migrationer
3. `npm run deploy`
4. `npm run verify:production` som verifierar den versionsstyrda push-monitoring-konfigurationen (heartbeat-cron + intern receiver-binding)

Workflowen använder W1 genom `CLOUDFLARE_API_TOKEN_W1`. Wrangler exponeras värdet som `CLOUDFLARE_API_TOKEN`, vilket är verktygets fasta miljövariabelnamn och inte ett separat generiskt org-secret.

W1 behöver täcka Worker deployment/routes och D1 Write när remote migration körs. Eftersom Worker-konfigurationen innehåller Secrets Store-bindings kräver Cloudflare dessutom Secrets Store Write på deploytokenet. W1 distribueras inte till observationsruntime som providercredential.

Migrationerna `0001`–`0005` använder defensiva `CREATE ... IF NOT EXISTS` där tabeller/index skapas. `0006_capability_scope_observations.sql` är däremot en normal versionsstyrd engångsmigration: den utökar den befintliga `capability_observations`-tabellen med `ALTER TABLE ... ADD COLUMN` och skapar därefter den nya scope-tabellen/indexen. Den ska därför appliceras genom Wranglers migrationsregister, som kör endast väntande migrationsfiler och inte applicerar en redan registrerad migration igen.

Repositoryts livenessmodell bygger på receiver-observerad heartbeat snarare än ett post-deploy GET-anrop.

## Deploymentgräns

`npm run deploy` är en explicit produktionsåtgärd. Kodmerge, D1 migration, secret-provisionering, provider-permissionändringar och Worker deployment är separata steg och ska verifieras var för sig.
