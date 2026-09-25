# Drift — Avkroken Portal

## Lokal verifiering

Kör från `apps/portal`.

```bash
npm install
npm test
npx wrangler deploy --dry-run --config wrangler.jsonc
```

`npm test` kör Portalens Node-testsvit och syntaxkontroll av klientskripten, inklusive Wiki-, sök-, Drift & insyn-, Changelog- och projektspecifika Releases-klienterna.

Dry-run verifierar Worker-bundle och Wrangler-konfiguration utan produktionsdeployment.

## Deployment

Repositoryts `.github/workflows/deploy-portal.yml` är produktionsflödet för Portal.

Aktuellt versionsstyrt kontrakt:

- workflow startas manuellt;
- deployjobbet använder `apps/portal` som working directory;
- production deployment måste köras från `main`;
- befintlig repository secret mappas till `CLOUDFLARE_API_TOKEN`;
- workflow kör Wrangler dry-run före deployment;
- deployment kör `npm run deploy`.

Feature branches ska inte deploya produktion.

Det här dokumentet beskriver repositorykontraktet. Privat Cloudflare account/DNS/Access live-state måste verifieras hos providern före en driftändring.

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

Credentialvärden dokumenteras inte här.

## Felmodell

### Projektkatalog

`GET /api/projects` läser GitHubs publika repositorylista och normaliserar den.

Om GitHub API inte kan läsas returnerar backend `502 github_unavailable` och UI visar att projekt-/tjänstelistan är otillgänglig.

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

### Publicerade sites

`GET /api/sites` härleds från projektkatalogen och behåller den tidigare endpointpolicyn genom `portalPublished`.

### Wiki-presentation

Wiki-vyn använder endast `/api/projects` och `/api/docs`.

- endast repositoryprojekt med publik Wiki får `wikiPortalUrl`;
- monorepo-appar ärver inte repositoryts Wiki och har `wiki = null` och `wikiPortalUrl = null` om inget separat framtida publiceringskontrakt införs;
- browsern anropar inte GitHub API direkt;
- unavailable project/docs catalog ger explicit degraded state;
- “Visa original-Wiki” pekar på canonical GitHub Wiki.

Projektcache-nyckeln bumpas när Wiki-fälten införs så gammal v4-payload inte återanvänds med det nya klientkontraktet.

### Dokumentationskatalog

Om GitHub-katalogen inte kan läsas returneras `502` med `github_unavailable`. UI visar ett explicit unavailable-state.

Opt-in-appdokument tas endast med när appen först har passerat samma giltiga `portal.public.json`-gräns som projektkatalogen. Appens publika route-path hålls separat från provider-path.

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

- max 32 Markdown-dokument;
- round-robin över docs-källor;
- max 120 000 tecken per dokument;
- concurrency 4;
- coverage `bounded` eller `partial`;
- ingen persistent sökindexcache; samtidiga builds i samma isolate kollapsas.

### Changelog

`GET /api/changelog` bygger en bounded snapshot från live-publicerade repositoryprojekt.

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
- GitHub release-read misslyckas: `502 project_releases_unavailable`;
- inga publicerade releases: `200`, `status = available`, tom `releases`-lista;
- normal respons: `200`, `status = available`, `Cache-Control: no-store`, max 10 releaser.

Endpointen återanvänder Changelogs release-sanitizer och publicerar endast project-identitet, repository, tagg/namn, publiceringstid, canonical release-URL och prerelease-flagga. Draft/body/author/assets/target commit lämnar inte backend.

Monorepo-appar får ingen `releasesPortalUrl` och deras project-model har `releases = null`.

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

Sökindexet lagras inte persistent i Cache API. Det byggs från aktuell publik project/docs-state när en sökning kräver index och query-responsen använder `Cache-Control: no-store`.

Samtidiga indexbyggen i samma Worker-isolate kollapsas till ett gemensamt in-flight Promise och det Promise:t rensas när bygget lyckas eller faller. Det reducerar burst-dubletter utan att skapa en stale publiceringscache.

### Changelog

Changelog lagras inte persistent i Cache API. Eligibility och releases läses från aktuell publik GitHub-state när snapshoten byggs. Samtidiga builds i samma Worker-isolate delar ett in-flight Promise som rensas efter success/failure.

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
- Changelog och projektspecifika Releases får endast läsa releases för live-publicerade repositoryprojekt; filtrera drafts explicit och låt inte monorepo-appar ärva source-repositoryts releases.
- Skvallerbyttans providerintegration förblir read-only.
- Drift & insyn får endast använda den sanerade named RPC-entrypointen; lägg inte `SKVALLERBYTTAN_READ_API_TOKEN`, dashboard-cookie eller rå `/api/v1`-proxy i Portalens publika Worker.
- DNS, Cloudflare Access, Worker permissions och credentialscope är arkitekturkrav och ändras inte som sidoeffekt av UI-arbete.

## Efter deployment

En framtida produktiondeployment ska verifieras mot faktisk provider-state:

1. deployworkflow/checks är gröna;
2. Worker-route och custom domain svarar enligt avsett URL-kontrakt;
3. `/api/projects`, `/api/sites`, `/api/docs`, `/api/search?q=arkitektur`, `/api/operations` och `/api/changelog` fungerar utan att exponera credentials, rå Skvallerbyttan-state eller rå releasepayload;
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
20. cache-/heartbeat-beteende har inte regresserat.

Kalla inte deployment klar innan den verifieringen är gjord.
