# Drift — Avkroken Portal

## Lokal verifiering

Kör från `apps/portal`.

```bash
npm install
npm test
npm run test:browser
npx wrangler deploy --dry-run --config wrangler.jsonc
```

`npm test` kör Portalens Node-testsvit, statiska accessibilitykontrakt och syntaxkontroll av klientskripten, inklusive Wiki-, sök-, Drift & insyn-, Changelog-, projektspecifika Releases-, Issues-, Builds/CI- och Activity-klienterna.

`npm run test:browser` kräver Google Chrome och ChromeDriver i PATH. GitHubs `ubuntu-latest` runner image tillhandahåller båda. Testet kör en lokal fixture-server, headless Chrome, WCAG A/AA-regler via `axe-core`, keyboard/fokusflöden och mobil overflow-kontroll. Fixture-servern använder syntetiska publika API-responser och inga secrets/providercredentials.

Dry-run verifierar Worker-bundle och Wrangler-konfiguration utan produktionsdeployment.

## Browser-/accessibility-gate

Portal-jobbet i root-`CI` kör i ordning:

1. `npm install --ignore-scripts --no-audit --no-fund`;
2. `npm test`;
3. versionsutskrift för `google-chrome` och `chromedriver`;
4. `npm run test:browser`;
5. Wrangler dry-run.

Browsergaten stoppar PR på axe-WCAG A/AA-violations, trasig skip-link, felaktig SPA-fokus, felaktig mobilmeny/Escape-retur eller representativ mobil horisontell overflow.

Den här gaten verifierar repositoryimplementationen. Den ersätter inte produktionssmoke-test eller Cloudflare/provider live-verifiering efter en faktisk deployment.

## Deployment

Cloudflare Workers Builds äger Portalens produktionsdeployment. GitHub Actions kör repository-CI men bär ingen Cloudflare deploycredential.

Workers Builds ska använda app-roten `apps/portal` och produktionskommandot:

```bash
npm run deploy:workers-builds
```

Scriptet kräver `WORKERS_CI=1` och `WORKERS_CI_BRANCH=main`, kör Portalens Node-tester och Wrangler dry-run före `npm run deploy`. Feature branches får inte använda produktionsscriptet.

Production 2026-09-30 kör Skvallerbyttan-versionen med `getPublicRepositories`, `getPublicRepositoryCi` och `getPublicActivity`. Service Bindingens target/entrypoint är oförändrad och Portal har ingen egen GitHub-secret för repositoryinventory.

Det här dokumentet beskriver repositorykontraktet. Privat Cloudflare account/DNS/Access live-state ska fortfarande verifieras hos providern före framtida driftändringar.

### Verifierad production-build och runtime 2026-09-30

Efter merge av PR #87 rapporterade Cloudflare Workers Builds lyckad **production** build från samma `main`-commit för:

- `avkroken`;
- `dumpen`;
- `jobb`;
- `skvallerbyttan`.

Skvallerbyttans live-tail observerade därefter `PortalObservationsService.getPublicRepositories - Ok` samtidigt som Portalens första v9-`/api/projects`-build returnerade 200 och åtta förväntade publika projekt. Production acceptance mot custom domain gav 59/59 godkända kontroller.

Verifieringen omfattade routing/deep links, Auth/Jobb-gränsen, denied/noindex, R2 read-boundary, Cloudflare Access-intercept, public-safe API-kontrakt, Changelog/Releases/Issues/Builds/Activity och tio separata sökningar utan tidigare intermittenta GitHub-403/502. Den interaktiva logo-adminmutationen kräver fortsatt en legitim Cloudflare Access-session och verifierades inte genom att skapa en särskild service token.


## Worker-konfiguration

`wrangler.jsonc` definierar bland annat:

- Worker `avkroken`;
- statiska assets via `ASSETS`;
- cachebinding;
- observability med loggar och traces;
- schedulerad watchdog-kontroll;
- Durable Object `OperationalWatchdog`;
- e-postbinding för operativa notifieringar;
- `SKVALLERBYTTAN_OBSERVATIONS` — intern Service Binding till `skvallerbyttan`/`PortalObservationsService`.

Current checked-in `wrangler.jsonc` binder production-`PORTAL_LOGOS` till `avkroken-portal-logos` och innehåller den icke-hemliga Access team domain + app-AUD som origin-verifieringen kräver. `previews` innehåller varken `r2_buckets` eller adminens Access-`vars`, så branch-previews får ingen production-writeväg och adminytan failar stängt. Den externa bucketens existens/public-access-state och Access-app/policy är privat provider-state och ska verifieras live; konfigurationsfilen ensam räcker inte som driftbevis.

Credentialvärden dokumenteras inte här. Access-AUD är en verifieringsidentifierare och inte en credential.

## Felmodell

### Publika logo-assets

`GET|HEAD /media/logos/<asset-id>` använder följande fail-closed modell:

- ogiltig/listningslik path eller saknat objekt: `404`;
- annan metod: `405` + `Allow: GET, HEAD`;
- saknad `PORTAL_LOGOS`-binding: `503`;
- R2-readfel: `502`;
- objekt med icke-allowlistad Content-Type: `415`;
- giltigt asset: `200` med explicit Content-Type, `nosniff`, ETag där tillgänglig och bounded publik cache; matchande `If-None-Match` ger `304` med samma cache-/ETag-kontrakt.

Asset-ID mappas alltid till `logos/<asset-id>`. Ingen publik listning, direkt bucket-key eller D1-katalog finns i detta steg.

### Skyddad logotypadministration

`/admin/logos[/...]` och `/api/admin/logos[/...]` kräver först Cloudflare Access på providerlagret och därefter giltig `Cf-Access-Jwt-Assertion` i Workern. Origin-verifieringen låser issuer till `ACCESS_TEAM_DOMAIN` och audience till `ACCESS_LOGO_ADMIN_AUD`.

API-kontraktet är fail-closed:

- saknad/ogiltig Access-konfiguration: `503 access_not_configured`;
- saknad Access assertion: `401 access_token_missing`;
- ogiltig/utgången assertion eller fel issuer/AUD: `403 access_token_invalid`;
- saknad production-R2-binding: `503 logo_storage_not_configured`;
- storage/providerfel: `502 logo_storage_unavailable` utan rå providerfeltext;
- unsupported MIME eller filsignatur/content mismatch: `415`;
- tom fil: `400`;
- fil större än 5 MiB: `413`;
- saknad asset: `404`;
- otillåten metod: `405` med explicit `Allow`.

Adminlistning använder endast prefixet `logos/`; upload genererar server-side asset-id, replace behåller asset-id/public URL, och delete/download accepterar endast validerade single-segment-id:n. Alla adminresponser är `no-store`. Admin-HTML har dessutom `noindex,nofollow`, restriktiv CSP, `frame-ancestors 'none'` och `X-Frame-Options: DENY`.

### Projektkatalog

`GET /api/projects` läser primärt en sanerad publik repositoryinventory via `SKVALLERBYTTAN_OBSERVATIONS.getPublicRepositories()` och normaliserar den. Skvallerbyttan gör providerläsningen med den befintliga read-only GitHub App-installationen; Portal får inte installation-/permissionmetadata, budgetstate eller credentials. Portalens credential-fria publika GitHub REST-listning finns kvar som rollout/degraded fallback.

Om varken den interna RPC:n eller fallback-providerläsningen kan ge en giltig repositorylista returnerar backend `502 github_unavailable` och UI visar att projekt-/tjänstelistan är otillgänglig.

Katalogsvaret innehåller `generatedAt` och deklarerad coverage `active_public_repositories_and_opt_in_apps`.

### Appdiscovery

Opt-in-appdiscovery läser endast `portal.public.json` under appkataloger.

- saknat manifest är normalt och publicerar ingenting;
- ogiltigt manifest eller manifest-read-fel markerar `source.appDiscovery = partial`;
- fel vid listning av appkatalogen markerar `source.appDiscovery = unavailable`;
- repositorykatalogen kan fortfarande returneras när appdiscovery är unavailable/partial;
- inga appkatalogers övriga filer eller skyddade payloads läses av discovery-steget.

### Projektdetalj

`/projekt/:slug` använder den redan laddade `/api/projects`-katalogen i browsern. Ingen separat providerrequest görs när detaljvyn öppnas.

Okänd slug visar ett explicit not-found-state i Portal-skalet. Om projektkatalogen är unavailable visas samma degraded state i detaljvyn.

Detaljvyn får endast exponera fält som redan finns i den publika normaliserade projektmodellen och canonical länkar som härleds där. Den ska inte börja läsa skyddad appstate eller operativ providerstate direkt.

`GET /api/distribution?project=<slug>` är det avgränsade undantaget för independent products och läser endast publika distributionsassets från projektets redan normaliserade HTTPS-origin. Endpointen accepterar ingen caller-supplied URL. Manifest-read är begränsad till 32 KiB och service-worker-read till 64 KiB, redirects följs inte, manifest kräver manifest/JSON-MIME, service worker kräver JavaScript-MIME och CDN-cache är högst 60 sekunder.

Statusmodellen är:

- `available` — manifest + service worker verifierade och manifestet uppfyller PWA-kontraktet;
- `not_configured` — manifest eller service worker saknas på origin;
- `unavailable` — origin/read/parse/validation kunde inte verifieras just nu.

Store listings publiceras endast från manifestets `related_applications` och endast för HTTPS-hostarna `apps.apple.com`, `play.google.com` och `apps.microsoft.com`. Tom lista betyder att ingen verifierad listing är publicerad; Portalen får inte gissa en butikslänk.

### Publicerade sites

`GET /api/sites` härleds från projektkatalogen och behåller den tidigare endpointpolicyn genom `portalPublished`.

### Wiki-presentation

Wiki-vyn använder endast `/api/projects` och `/api/docs`.

- endast repositoryprojekt med publik Wiki får `wikiPortalUrl`;
- monorepo-appar ärver inte repositoryts Wiki och har `wiki = null` och `wikiPortalUrl = null` om inget separat framtida publiceringskontrakt införs;
- browsern anropar inte GitHub API direkt;
- unavailable project/docs catalog ger explicit degraded state;
- “Visa original-Wiki” pekar på canonical GitHub Wiki.

Projektcache-nyckeln bumpas när Wiki-fälten införs så gammal v4-payload inte återanvänds med det nya klientkontraktet. Projektmodellens Builds-fält bump:ar därefter cache-nyckeln till `github-projects-v6`, så en pre-Builds v5-payload inte återanvänds efter deployment. Activity-fältet `activityPortalUrl` bump:ar därefter nyckeln till `github-projects-v7`, så en pre-Activity v6-payload inte kan återanvändas.

### Dokumentationskatalog

Dokumentationskatalogen byggs från Portalens redan public-safe projektkatalog och lagras i Workers Cache API i 21 600 sekunder med `docs-catalog`-tag. Repositoryns README/`docs/`-inventory hämtas primärt genom `SKVALLERBYTTAN_OBSERVATIONS.getPublicDocumentationIndex()`, som använder den befintliga read-only GitHub App-installationen efter samma live-public repositorygrind som projektkatalogen. Portalens credential-fria Git-tree-läsning finns kvar endast som rollout/degraded fallback. En publicerad monorepo-app vars RPC-tree saknar både appens README och appens `docs/` triggar samma snäva fallback för source-repositoryt; detta täcker avsiktligt sanerade RPC-index som inte exponerar den app-prefixen utan att bredda Skvallerbyttans allowlist. Om varken intern RPC eller fallback kan ge katalogunderlag visas explicit degraded/unavailable state.

Skvallerbyttans docs-RPC returnerar endast sanerade Markdown-paths för root `README.md` och `docs/**/*.md|markdown`; den returnerar inte GitHub permissions, installationmetadata, providerbudget eller credentials. Portalens adapter mappar därefter root README till `Översikt`, `docs/index.md` till `Dokumentation` och övriga filer till stabila sidetiketter. Det förhindrar den tidigare dubbletten där både README och `docs/index.md` visades som `Översikt`. Opt-in-appdokument tas endast med när appen först har passerat samma giltiga `portal.public.json`-gräns som projektkatalogen.

### Dokumentinnehåll

- okänd katalognyckel/route-path eller path som inte finns i katalogpostens allowlist: `404 document_not_found`;
- providerfel: `404` eller `502 document_unavailable`;
- dokument över tillåten storlek: `413 document_too_large`.

### Global sök

`GET /api/search?q=...` kräver minst två tecken och max 120 tecken.

- tom/kort fråga: `200` med `status = query_required` och tom resultatlista utan indexbuild;
- för lång fråga: `400 query_too_long`;
- index-/providerfel: `502 search_unavailable`;
- normal sökning: `200`, `status = available`, `generatedAt`, source coverage och rankade resultat.

Sökindexet byggs endast från intersektionen av publicerade projekt och publicerade docs-källor. Klienten får inte rå `searchText`.

Kall indexbuild är budgeterad:

- public project catalog återanvänds som första säkerhetsgrind;
- docs-katalogen återanvänds från dess tag-invaliderbara 21 600-sekunders cache;
- GitHub Git-tree-läsningar har concurrency 2 och dedupliceras per repository/ref;
- max 32 Markdown-dokument;
- round-robin över docs-källor;
- exakt allowlistad Markdown läses från GitHubs raw-content-origin först efter publiceringsgrinden;
- max 120 000 tecken per dokument;
- innehållsläsning concurrency 4;
- coverage `bounded` eller `partial`;
- ingen persistent sökindexcache; samtidiga builds i samma isolate kollapsas.

### Changelog

`GET /api/changelog` bygger en bounded snapshot från publika repositoryprojekt. Eligibility kommer från samma live-public repositorygate som projektkatalogen. Själva releasekandidaterna hämtas primärt genom `SKVALLERBYTTAN_OBSERVATIONS.getPublicRepositoryReleases()`, som använder den befintliga read-only GitHub App-installationen och sanerar bort drafts/icke-canonical URLs och onödiga providerfält innan svaret lämnar observationslagret. Portalens credential-fria GitHub Releases-read är endast rollout/degraded fallback. Deployment-korrelationen sker separat genom `getPublicReleaseDeployments()` och får därför degradera oberoende av att releasen i sig visas.

- projektkatalogfel: `502 changelog_unavailable`;
- individuellt repo-releasefel: resten av snapshoten returneras med `source.coverage = partial`;
- inga releases: `200`, `status = available`, tom `releases`-lista;
- normal snapshot: `200`, `status = available`, `Cache-Control: no-store`.

Budget:

- max 24 repositoryprojekt;
- max 10 GitHub Releases per repository;
- concurrency 4;
- max 40 returnerade releaser.

Draft releases filtreras alltid bort. Changelog publicerar inte release body, author, assets eller target commit, och monorepo-appar ärver inte source-repositoryts releases.

### Projektspecifika Releases

`GET /api/releases?project=<slug>` läser endast ett projekt som först har passerat den publika projektkatalogens repository-policy.

- saknad/tom eller för lång project slug: `400 invalid_project`;
- okänd slug eller monorepo-app: `404 project_releases_not_found`;
- både den autentiserade release-RPC:n och credential-fria fallbacken misslyckas: `502 project_releases_unavailable`;
- inga publicerade releases: `200`, `status = available`, tom `releases`-lista;
- normal respons: `200`, `status = available`, `Cache-Control: no-store`, max 10 releaser.

Endpointen återanvänder Changelogs release-sanitizer och publicerar endast project-identitet, repository, tagg/namn, publiceringstid, canonical release-URL och prerelease-flagga. Draft/body/author/assets/target commit lämnar inte backend.

Monorepo-appar får ingen `releasesPortalUrl` och deras project-model har `releases = null`.

### Projektspecifika Issues

`GET /api/issues?project=<slug>` läser endast ett projekt som först har passerat den publika projektkatalogens repository-policy.

- saknad/tom eller för lång project slug: `400 invalid_project`;
- okänd slug eller monorepo-app: `404 project_issues_not_found`;
- GitHub Issue-read misslyckas: `502 project_issues_unavailable`;
- inga Issues efter PR-filtrering: `200`, `status = available`, tom `issues`-lista;
- normal respons: `200`, `status = available`, `Cache-Control: no-store`, max 30 Issues.

Providerrequesten använder `state=all&sort=updated&direction=desc`. GitHubs Issues-API kan inkludera pull requests; `issue-source.mjs` filtrerar därför poster med `pull_request`.

Endpointen publicerar inte body, author/user, assignee, milestone eller label color/description. Browsern anropar endast Portalens `/api/issues`.

Monorepo-appar får ingen `issuesPortalUrl` och deras project-model har `issues = null`.

### Projektspecifik Builds / CI

`GET /api/builds?project=<slug>` gör först en live public-repositorykontroll från samma sanerade inventory som projektkatalogen och normaliserar den med Portalens repositorypolicy. Normalfallet är `SKVALLERBYTTAN_OBSERVATIONS.getPublicRepositories()`; Portalens credential-fria publika REST är fallback. App-manifestdiscovery används inte i Builds-gaten. Endpointen gör därefter endast ett internt RPC-anrop till `getPublicRepositoryCi(repoName)`.

- saknad/tom eller för lång project slug: `400 invalid_project`;
- okänd slug eller monorepo-app: `404 project_builds_not_found`;
- saknad binding eller RPC-metod: `503 builds_not_configured`;
- projektkatalog-/RPC-fel: `502 project_builds_unavailable`;
- giltig RPC-snapshot: `200`, `status = available`, `Cache-Control: no-store`.

`ci.available = false` är inte ett transportfel. UI:t visar i stället `not_observed` eller `unavailable` utan att fabricera CI-health.

Skvallerbyttans CI-RPC läser endast D1 source cache-keyn `overview`. Den gör ingen GitHub-request på Portalens sidvisning. Snapshoten bär `sourceRefreshedAt` och freshness:

- `fresh` — cachead observation är högst sex timmar gammal och inte invaliderad;
- `stale` — cacheposten är äldre än sex timmar eller invaliderad;
- `unknown` — ingen canonical overview-cache finns.

Publikt CI-underlag begränsas till samplebaserad summary. Actor, permissionmetadata, providerfel, event breakdown och råa run-rader lämnar inte Skvallerbyttan.

Monorepo-appar har ingen `buildsPortalUrl` och `builds = null`.

### Observerad Activity

`GET /api/activity?days=<1..30>&project=<slug>` gör först en live public-repositorykontroll från samma sanerade inventory och använder Portalens repositorypolicy. Normalfallet är Skvallerbyttans autentiserade read-only `getPublicRepositories()`-RPC; Portalens publika REST är fallback. `project` är valfri:

- utan `project` väljs högst 50 live-publika repositoryprojekt;
- med `project` krävs exakt match mot ett repositoryprojekt; monorepo-appar är inte giltiga Activity-källor;
- saknad/tom/för lång explicit project slug: `400 invalid_project`;
- okänd slug eller monorepo-app: `404 project_activity_not_found`;
- saknad binding eller RPC-metod: `503 activity_not_configured`;
- project-list/RPC-fel: `502 activity_unavailable`;
- normal respons: `200`, `status = available`, `Cache-Control: no-store`.

Portal anropar endast `SKVALLERBYTTAN_OBSERVATIONS.getPublicActivity(repositoryNames, days)`. Skvallerbyttan gör ingen providerrequest för denna metod. RPC:n kontrollerar de begärda repositories mot cachead `overview` och kräver `visibility = public` samt `archived != true` innan D1-ledgern `observation_events` queryas.

En explicit repository-lista som efter validering blir tom ger ett fail-closed SQL-filter (`1 = 0`), inte en bred query. D1-resultatet filtreras till GitHub och exakt godkända repositorykortnamn.

Den publika modellen innehåller aggregate counts/coverage samt recent event-rader med repository/project, capability, source, coverage, event/action och occurred/received timestamps. `resourceId`, actor, providerfel, permissionmetadata och rå webhookpayload publiceras inte. Public capability-scope är endast `github.avkroken.repositories`, `github.avkroken.pull_requests` och `github.avkroken.actions`; security/governance-capabilities filtreras bort. Portal gör dessutom en andra whitelistprojektion mot de repositories som passerade den live publika gaten.

Global `/aktivitet` publicerar inte Cloudflare account-/org-aktivitet. UI:t använder genomgående **observerad aktivitet**, visar coverage och påstår inte att perioden är komplett.
### Drift & insyn

`GET /api/operations` läser endast `SKVALLERBYTTAN_OBSERVATIONS.getPublicOperationsSummary()`.

- saknad binding/entrypoint: `503 operations_not_configured`;
- RPC-fel: `502 operations_unavailable`;
- normal snapshot: `200`, `available = true`, `Cache-Control: no-store`.

Endpointen returnerar inte Skvallerbyttans råa `/api/v1`-payload. Provider-permissions, installationmetadata, HTTP-status/felsträngar, scope coverage/repositoryantal och Activity/eventvolym ingår inte i snapshoten.

Klienten anropar endast Portalens `/api/operations` och känner inte till Skvallerbyttans origin, dashboard-session eller machine bearer-token.

### Heartbeat

`OperationalWatchdog` håller state för Skvallerbyttans heartbeat och kan markera stale när förväntad leverans uteblir.

Heartbeat-state ska inte automatiskt tolkas som komplett provider health för GitHub eller Cloudflare.

## Cache

### Projektkatalog

`/api/projects` lagras i Workers Cache API med fem minuters cachetid.

Klientresponsen kräver revalidering. Workers Cache API lagrar en separat response-kopia med `Cache-Control: public, max-age=300`, och cache-hit-responsen normaliseras tillbaka till klientrevalidering. `/api/sites` härleds från samma normaliserade response.

### Sökindex

Sökindexet lagras inte persistent i Cache API. Det byggs från aktuell publik project/docs-state när en sökning kräver index och query-responsen använder `Cache-Control: no-store`. Projektkatalogen och den tag-invaliderbara dokumentationskatalogen får däremot återanvändas som redan public-safe metadata; search bygger inte en parallell full repositoryinventering.

Samtidiga indexbyggen i samma Worker-isolate kollapsas till ett gemensamt in-flight Promise och det Promise:t rensas när bygget lyckas eller faller. Dokumentupptäckten använder ett deduplicerat rekursivt Git-tree-read per repository/ref med högst två samtidiga reads; responses som inte ska konsumeras cancelas explicit. Det reducerar både API-fanout och risken för stalled HTTP-responses utan att skapa en stale sökindexcache.

### Changelog

Changelog lagras inte persistent i Cache API. När Portal saknar egen GitHub-credential får repository-eligibility återanvändas i högst 60 sekunder; inventoryn kommer normalt från Skvallerbyttans autentiserade read-only RPC och credential-fri GitHub REST är fallback. Med Portal-credential kringgås eligibility-cachen. Releasepayloaden läses alltid från GitHub när snapshoten byggs. Samtidiga builds i samma Worker-isolate delar ett in-flight Promise som rensas efter success/failure.

### Dokumentation

Dokumentationscache kan invalideras internt via `DocsInvalidationService`.

Invalidering använder:

- global tag `docs-catalog`;
- repositoryspecifik `docs-repo-...`-tag.

Service binding används i stället för att exponera en publik administrationsendpoint.

## Säkerhetsgränser

- Lägg inte providercredentials i browser assets.
- Skapa inte ny credential för Portal v2 om befintligt verifierat flöde räcker.
- `.github`, retired sources, arkiverade och icke-publika repositories ska inte hamna i den publika projektkatalogen.
- Monorepo-appar får endast publiceras genom det appägda, strikt validerade `portal.public.json`-kontraktet; saknat manifest får inte ge en publik post eller app-docs-källa.
- Appdokument får endast hämtas efter exakt katalogmatchning; manifestpayload får inte styra source-repository/ref/path.
- Jobb/Auth-data får inte passera publik Portal-cache, publik docs-katalog eller publik sök; sökindexet byggs efter publiceringsfiltrering, inte före.
- Changelog och projektspecifika Releases får endast läsa releases för repositoryprojekt som passerat den publika repositorygaten; utan providercredential får gaten vara högst 60 sekunder gammal, medan konfigurerad credential alltid kräver live eligibility. Drafts filtreras explicit och monorepo-appar får inte ärva source-repositoryts releases.
- Projektspecifika Issues använder samma credential-aware publika repositorygate; GitHub PR-poster filtreras explicit och monorepo-appar får inte ärva source-repositoryts Issues.
- Projektspecifik Builds/CI får endast läsa Skvallerbyttans public-safe cache-RPC efter live public-project-lookup; Portalen får inte göra en egen GitHub Actions-read och monorepo-appar får inte ärva source-repositoryts CI.
- Activity får endast läsa Skvallerbyttans separata repository-allowlistade Activity-RPC efter live public-project-lookup; explicit tom repositoryscope ska fail-closed och monorepo-appar får inte ärva source-repositoryts eventström.
- Skvallerbyttans providerintegration förblir read-only.
- Portalens interna GitHub repositoryinventory, Drift & insyn, repository-CI och Activity får endast använda de sanerade metoderna på named `PortalObservationsService`; lägg inte `SKVALLERBYTTAN_READ_API_TOKEN`, dashboard-cookie eller rå `/api/v1`-proxy i Portalens publika Worker.
- Publik logo-serving får endast läsa exakt `logos/<asset-id>`; ingen bucket-listning eller godtycklig key får exponeras.
- Logotypadmin får endast nå R2 efter både provider-side Access och origin-JWT-verifiering; writes ska stanna inom `logos/`, och Preview får inte bindas till production-bucketen.
- DNS, Cloudflare Access, R2-bucket/public-access, Worker permissions och credentialscope är provider-state och ska live-verifieras; de får inte antas från repositorydokumentation.

## Efter deployment

Efter en produktiondeployment ska faktisk provider-/runtime-state verifieras:

1. deployworkflow/checks är gröna;
2. Worker-route och custom domain svarar enligt avsett URL-kontrakt;
2a. denied-routes kan direktnavigeras separat för general/identity/non-identity/gateway och är `noindex,nofollow`;
2b. production-`PORTAL_LOGOS`: en saknad, men syntaktiskt giltig `/media/logos/<asset-id>` ger `404` (inte binding-`503`), vilket verifierar att Worker kan nå den bundna bucketen utan att skapa testdata; katalog-/traversalförsök ska fortsatt misslyckas;
2c. `/admin/logos`, `/admin/logos/`, `/api/admin/logos` och en item-underpath fångas av den path-specifika Access-appen före origin; redirect/login-metadata ska bära det konfigurerade app-AUD:t och den publika startsidan ska fortsatt vara oskyddad;
2d. med en legitim interaktiv Access-session: öppna logo-admin och kör `Kör verifiering`. Canaryn ska skapa en syntetisk SVG via ordinarie upload-route, hitta den i listningen, läsa metadata och publik URL, ersätta innehållet med bibehållet asset-id, verifiera admin-download, radera objektet och få `404` vid efterkontroll. Vid avbrott ska klienten försöka radera testasseten i `finally`. Adminresponses ska förbli `no-store`. Skapa inte service token enbart för denna verifiering;
3. `/api/projects`, `/api/sites`, `/api/docs`, `/api/search?q=arkitektur`, `/api/operations`, `/api/changelog`, `/api/releases?project=Bastion`, `/api/issues?project=Bastion`, `/api/builds?project=Bastion` och `/api/activity?project=Bastion&days=7` fungerar utan att exponera credentials, rå Skvallerbyttan-state eller rå providerpayload;
4. `/api/projects` inkluderar aktiva publika repositories utan krav på homepage men exkluderar `.github` och retired sources;
5. Skvallerbyttans opt-in-manifest ger en app-post utan att skapa en publik dashboard-länk, medan Jobb saknar app-post;
6. deep links returnerar Portal-shell;
7. `/projekt/Bastion` och `/projekt/skvallerbyttan` renderar projektdetalj från den publika katalogen utan extra providerfetch; Skvallerbyttans detalj visar appens canonical source-path men ingen privat dashboard-payload;
8. `/projekt/Bastion/wiki` renderar Wiki-presentation från publika Portal-kataloger och länkar till original-Wikin; `/projekt/skvallerbyttan/wiki` publiceras inte eftersom appen inte har eget Wiki-kontrakt;
9. `/projekt/skvallerbyttan/dokumentation` renderar app-lokal README/docs med source-path-oberoende URL och “Visa original” till `Avkroken/Avkroken`;
10. en godtycklig Jobb-path mot `/api/docs/content` ger inte en publik dokumentträff;
11. `/auth/jobb[/...]` redirectar till Jobbs skyddade origin och Jobb-data går inte att hämta genom publika Portal-routes;
12. sök på ett publikt dokument ger Portal-resultat + canonical original, medan `jobb` inte kan ge skyddad Jobb-dokumentation genom indexet;
13. sökresultat visar `bounded`/`partial` coverage och index-freshness;
14. `/drift` visar endast public-safe providerstatus och capability status/freshness/last-success; scope counts och Activity/eventvolym exponeras inte;
15. om observationsbindingen saknas/faller visar `/drift` degraded state och fabricerar ingen providerstatus;
16. `/changelog` visar publicerade releases från publika repositoryprojekt med canonical original-länkar; drafts och Skvallerbyttan-appens source-repositoryreleases publiceras inte som appreleases;
17. Changelog visar `bounded`/`partial` coverage och använder ingen persistent snapshotcache;
18. `/projekt/Bastion/releases` visar endast Bastions publicerade releases och canonical GitHub-länk; `/projekt/skvallerbyttan/releases` saknar app-releasekälla och appens projektdetalj visar ingen Releases-knapp;
19. `/api/releases?project=Bastion` är `no-store` och innehåller ingen raw body/author/assets/target commit;
20. `/projekt/Bastion/issues` visar endast Bastions sanerade Issues och canonical GitHub-länk; PR-poster filtreras bort och `/projekt/skvallerbyttan/issues` saknar app-Issuekälla;
21. `/api/issues?project=Bastion` är `no-store` och innehåller ingen body/user/assignee/milestone eller labelmetadata utöver namn;
22. `/projekt/Bastion/builds` visar sampled CI-summary med freshness och canonical Actions-länk utan direkt GitHub Actions-request; `/projekt/skvallerbyttan/builds` saknar app-CI-källa;
23. stale/missing Skvallerbyttan overview-cache visas som stale/not-observed och utlöser ingen Portal-driven providerrefresh;
24. `/aktivitet` visar endast observerade GitHub-events för live-publika repositoryprojekt med explicit coverage; inga Cloudflare account-/org-events, resource-ID:n eller actors publiceras;
25. `/projekt/Bastion/aktivitet` är scope:ad till Bastion medan `/projekt/skvallerbyttan/aktivitet` saknar app-Activitykälla;
26. `/api/activity` är `no-store`, bounded till 50 repositories/30 dagar och en tom/ogiltig intern repositorylista kan inte falla tillbaka till organisationsomfattande Activity;
27. cache-/heartbeat-beteende har inte regresserat.

Status 2026-09-30: punkt 1–27 är verifierade genom kombinationen av grön PR #87-CI/CodeQL/Workers Builds och 59/59 livekontroller mot production, med det uttryckliga undantaget punkt 2d som kräver en legitim interaktiv Access-session. Repositoryinventoryns nya interna väg är dessutom verifierad genom samtidig Skvallerbyttan-tail av `PortalObservationsService.getPublicRepositories - Ok` och lyckad v9-`/api/projects`-build. Fem `arkitektur`- och fem `jobb`-sökningar returnerade 200 utan GitHub-403/502 och utan skyddad `apps/jobb/**`-source.

Punkt 2d är den enda separat noterade operativa begränsningen: terminalmiljön kan inte impersonera en legitim interaktiv Cloudflare Access-session. Admin-UI:n har därför ett självrensande `Kör verifiering`-canaryflöde som använder exakt samma upload/list/metadata/public-read/replace/download/delete-routes som normal administration och gör den återstående liveverifieringen till ett enda autentiserat användarsteg. Ingen service token skapades enbart för acceptance. Punkt 2c, origin-authkontraktet, R2-bindingen och fail-closed public/admin paths är verifierade.
