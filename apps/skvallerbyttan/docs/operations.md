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
- `STATS_DB`
- `OBSERVABILITY` — Analytics Engine dataset `skvallerbyttan_observability`
- `AVKROKEN_PORTAL_DOCS` — intern Cloudflare Service Binding till live Worker-tjänsten `avkroken`, entrypoint `DocsInvalidationService`
- `AVKROKEN_OPERATIONS` — intern Cloudflare Service Binding till live Worker-tjänsten `avkroken`, entrypoint `OperationalHeartbeatService`
- cron `0 */6 * * *` för reconciliation
- cron `*/15 * * * *` för operativ heartbeat och global GitHub/Cloudflare capability-reconciliation
- custom domain `skvallerbyttan.denied.se`
- Cloudflare account via versionerad `account_id`

Icke-hemlig versionsstyrd runtime-konfiguration:

- `CLOUDFLARE_ACCOUNT_ID`
- `KROSA_MAJA_GITHUB_CLIENT_ID`

`GAMNACKEN_GITHUB_APP_CLIENT_ID` är icke-hemligt och synkas från GitHub Actions-variable till en Worker runtime-binding tillsammans med Gamnackens App-nyckel.

Cloudflare Secrets Store-bindings:

- `CLOUDFLARE_API_TOKEN_R1` — Platform / Resource Read
- `CLOUDFLARE_API_TOKEN_R2` — Analytics / Content / Operations Read
- `CLOUDFLARE_API_TOKEN_R3` — Security / Identity Read
- `KROSA_MAJA_CLIENT_SECRET`

Varje bunden Secrets Store-secret ska ha `workers` i sin scope-lista. Bindings hämtar värden asynkront via `get()`; kodvägarna använder inte äldre generiska Cloudflare-token som fallback.

Vanliga Worker runtime-bindings/secrets:

- `GAMNACKEN_GITHUB_APP_CLIENT_ID` — icke-hemlig App-identifierare, synkad från GitHub Actions-variable
- `GAMNACKEN_GITHUB_APP_PRIVATE_KEY` — Gamnackens privata RSA-nyckel
- `SKVALLERBYTTAN_SESSION_SECRET`
- `SKVALLERBYTTAN_WEBHOOK_SECRET` — GitHub provider-webhook
- `CLOUDFLARE_NOTIFICATIONS_WEBHOOK_SECRET`
- `CLOUDFLARE_CASB_WEBHOOK_SECRET`
- `SKVALLERBYTTAN_READ_API_TOKEN` — valfri machine read API

Gamnackens GitHub App-identitet består i runtime av `GAMNACKEN_GITHUB_APP_CLIENT_ID` och `GAMNACKEN_GITHUB_APP_PRIVATE_KEY`. GitHub Actions-källorna använder samma canonical namn. App-JWT signeras med RS256; private key måste höra till Gamnacken. Koden accepterar PKCS#1 `RSA PRIVATE KEY` och PKCS#8 `PRIVATE KEY`; PKCS#1 wrap:as till PKCS#8 i minnet före Web Crypto-import. GitHub App client secret behövs inte för installation-auth-flödet. Gamnacken är observationsruntimens canonical GitHub App.

GitHub Actions som muterar Cloudflare använder endast `CLOUDFLARE_API_TOKEN_W1`. Wrangler får värdet via den miljövariabel som verktyget kräver, `CLOUDFLARE_API_TOKEN`, men det finns inget generiskt org-secret med det namnet.

### Migrering till Gamnacken

Gamnacken är canonical GitHub App för Skvallerbyttans provider-reads. Credentialnamnen är:

- `GAMNACKEN_GITHUB_APP_CLIENT_ID` — GitHub Actions-variable och Worker runtime-secret
- `GAMNACKEN_GITHUB_APP_PRIVATE_KEY` — GitHub Actions-secret och Worker runtime-secret

Migreringen ska göras utan auth-glapp:

1. konfigurera GitHub Actions-variable/secret med Gamnackens befintliga Client ID och private key,
2. mergea ändringen som byter runtime-kontraktet,
3. kör `Sync Cloudflare runtime secrets` från `main`; workflowen verifierar först App-identiteten mot GitHub och Avkrokens installation och skriver därefter de nya Worker-secretnamnen,
4. kör `Deploy production` från samma `main`,
5. verifiera GitHub provider health och capabilities i Insyn,
6. stäng av Gamnackens App-webhook om den är aktiv; organization-webhooken är canonical event-ingress,
7. avinstallera/radera den separata Skvallerbyttan GitHub Appen först efter lyckad runtimeverifiering,
8. ta därefter bort de gamla oanvända Worker-secreten `SKVALLERBYTTAN_GITHUB_APP_CLIENT_ID` och `SKVALLERBYTTAN_GITHUB_APP_PRIVATE_KEY`.

Själva credentialvärdena får inte skrivas i repository, loggar eller driftanteckningar.

### Runtime secret-sync

`../../../.github/workflows/sync-skvallerbyttan-runtime-secrets.yml` är endast `workflow_dispatch` och delar concurrency-grupp med produktionsdeploy. Före någon Worker-binding skrivs validerar workflowen Skvallerbyttans Client ID och private key mot GitHub som App och mot Avkrokens App-installation. Ett ogiltigt eller mismatchat client-id/private-key-värde stoppar synken före mutation.

Workflowen använder W1 och synkar endast Worker-lokala bindings/secrets som den ensam äger på runtime-sidan:

- `GAMNACKEN_GITHUB_APP_CLIENT_ID` från GitHub Actions-variable
- `GAMNACKEN_GITHUB_APP_PRIVATE_KEY` från GitHub Actions-secret
- valfri `SKVALLERBYTTAN_READ_API_TOKEN`

`SKVALLERBYTTAN_WEBHOOK_SECRET` ingår avsiktligt **inte** i den generella runtime-secret-syncen. GitHub-webhookens secret är ett kopplat provider-/runtimevärde: om endast Worker-sidan skrivs om bryts HMAC-verifieringen för alla GitHub-leveranser. En rotation ska därför göras som en samordnad driftåtgärd där samma värde sätts på GitHub organization webhook och Worker-secretet och därefter verifieras med en signerad leverans som returnerar HTTP 202.

R1/R2/R3 och Krösa-Majas client secret läses direkt från Cloudflare Secrets Store.

GitHub organization webhook använder `SKVALLERBYTTAN_WEBHOOK_SECRET`. Gamnacken är read-auth-app och ska inte ha en aktiv App-webhook mot `/webhooks/github`. Runtime identifierar en kvarvarande App-webhook primärt via GitHubs `X-GitHub-Hook-Installation-Target-Type: integration` och använder payloadens `installation` endast som fallback. Sådana leveranser kvitteras tyst med HTTP 202 och får inte skapa Activity, cacheinvalidations, säkerhetsledger eller en extra warning-logg per leverans. Cloudflare Notifications använder `CLOUDFLARE_NOTIFICATIONS_WEBHOOK_SECRET` och CASB använder `CLOUDFLARE_CASB_WEBHOOK_SECRET`.

### Återställning vid GitHub-webhookstorm

Om Workers Logs visar stora mängder `POST /webhooks/github` ska hook-targeten avgöra åtgärden:

- `integration`: Gamnacken är den enda App som ska användas för read-auth och dess **Webhook** ska vara avstängd. En separat Skvallerbyttan GitHub App är legacy och ska tas bort först efter att Gamnackens runtime-auth har verifierats i produktion.
- `organization` med `invalid webhook signature`: skapa ett nytt slumpmässigt webhook-secret och sätt **samma värde** på Avkrokens organization webhook och Worker-secretet `SKVALLERBYTTAN_WEBHOOK_SECRET`. Secretet är ett operatörsvalt HMAC-secret, inte ett GitHub App-genererat credential.
- För en samordnad rotation: inaktivera organization webhooken tillfälligt, uppdatera secret på GitHub och Worker-sidan, aktivera webhooken igen och verifiera en signerad leverans som returnerar HTTP 202.
- Skicka eller dokumentera aldrig själva secretvärdet i repository, PR, logg eller chatt.

GitHub-providerwebhooken är också canonical trigger för portalens dokumentationsfreshness. På docs-relevanta `push`-events på publik default branch samt `repository`-events anropar Skvallerbyttan `AVKROKEN_PORTAL_DOCS.invalidateDocs(...)`. RPC-anropet kräver ingen ytterligare secret och går inte via publik HTTP. Tre korta retryförsök görs; vid fortsatt fel loggas signalfelet medan GitHub-eventet fortfarande kan lagras och portalens edge-TTL fungerar som fallback.

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

Canonical provider-ingress:

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

den live Worker-tjänsten `avkroken` måste ha den namngivna entrypointen deployad innan en Skvallerbyttan-version med bindingen deployas. Bindingen är account-intern och använder inte GitHub- eller Cloudflare-webhooksecrets.

Cloudflare Audit Logs och den schemalagda reconciliation-körningen fortsätter vara safety net för händelser som inte levereras via Notifications/CASB.

## Push-baserad liveness och readiness

Skvallerbyttan använder inte publika `/health`, `/healthz` eller `/ready` som driftmekanism. De publika pull-endpointsen har tagits bort; Bot Fight Mode/WAF ska inte behöva undantag för externa monitorer.

Var 15:e minut gör runtime en intern readiness-probe och levererar resultatet via `AVKROKEN_OPERATIONS.postHeartbeat(...)` till Avkroken-portalen. Readiness är true endast när samtliga kontroller passerar:

- lokal auth-/runtimekonfiguration
- D1 `SELECT 1`
- läsbar Gamnacken/Krösa-Maja/R1/R2/R3 credentialkonfiguration
- live GitHub App-anrop via Gamnacken
- Cloudflare R1-probe via Zones
- Cloudflare R2-probe via Account
- Cloudflare R3-probe via Tunnels

Heartbeat-leveransen skickas även när readiness är false. GitHub-proben skriver `github.avkroken.repositories` och Cloudflare R1/R2/R3-proberna skriver sina reducerade resultat till `capability_observations`, så provider-health överlever Worker-isolatgränser och kan skilja `available`, `permission_denied`, `error` och verkligt `not_observed`. En capability-specifik 403 från exempelvis organization governance får därmed inte felaktigt klassificera hela GitHub-providern som auth-fel. Mottagarsidan avgör liveness utifrån egen mottagningstid.

Avkroken-portalen lagrar heartbeat i ett separat Durable Object, förväntar leverans var 15:e minut och larmar via Cloudflare Email Service om ingen leverans har mottagits inom 35 minuter. Portalens watchdog kör var 10:e minut. När leveransen återkommer efter stale skickas återställningsnotis. Inga providercredentials eller providerpayloads ingår i heartbeat.

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

Verifierat 2026-09-19:

- Analytics Engine retention: 3 månader.
- Workers Paid publicerad prismodell: 10 miljoner datapunkter/månad inkluderat, därefter $0.25/miljon; 1 miljon SQL reads/månad inkluderat, därefter $1.00/miljon.
- Cloudflare anger fortfarande att Analytics Engine ännu inte faktureras trots publicerad kommande prismodell.
- D1 Workers Paid inkluderar 25 miljarder rows read/månad och 50 miljoner rows written/månad; write-overage är $1/miljon rows.
- D1 Free enforcement för dagliga limits är aktivt sedan 2026-09-01.

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

Den verkliga runtime-livenessen bevisas därefter av mottagen heartbeat hos den oberoende watchdogen, inte av ett post-deploy GET-anrop mot produktionsdomänen.

## Deploymentgräns

`npm run deploy` är en explicit produktionsåtgärd. Kodmerge, D1 migration, secret-provisionering, provider-permissionändringar och Worker deployment är separata steg och ska verifieras var för sig.
