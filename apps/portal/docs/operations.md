# Drift — Avkroken Portal

## Lokal verifiering

Kör från `apps/portal`.

```bash
npm install
npm test
npx wrangler deploy --dry-run --config wrangler.jsonc
```

`npm test` kör Portalens Node-testsvit och syntaxkontroll av klientskripten, inklusive Wiki- och sökklienterna.

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
- e-postbinding för operativa notifieringar.

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
- coverage `bounded` eller `partial`.

### Heartbeat

`OperationalWatchdog` håller state för Skvallerbyttans heartbeat och kan markera stale när förväntad leverans uteblir.

Heartbeat-state ska inte automatiskt tolkas som komplett provider health för GitHub eller Cloudflare.

## Cache

### Projektkatalog

`/api/projects` lagras i Workers Cache API med fem minuters cachetid.

Klientresponsen kräver revalidering. Workers Cache API lagrar en separat response-kopia med `Cache-Control: public, max-age=300`, och cache-hit-responsen normaliseras tillbaka till klientrevalidering. `/api/sites` härleds från samma normaliserade response.

### Sökindex

Sökindexet lagras i Workers Cache API i 3 600 sekunder med tags:

- `docs-catalog`;
- `search-index`.

Query-responsen lagras inte i shared cache (`Cache-Control: no-store`). En docs-invalidering kan därmed även slå ut underliggande sökindex utan att ett separat administrations-API införs.

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
- Skvallerbyttans providerintegration förblir read-only.
- DNS, Cloudflare Access, Worker permissions och credentialscope är arkitekturkrav och ändras inte som sidoeffekt av UI-arbete.

## Efter deployment

En framtida produktiondeployment ska verifieras mot faktisk provider-state:

1. deployworkflow/checks är gröna;
2. Worker-route och custom domain svarar enligt avsett URL-kontrakt;
3. `/api/projects`, `/api/sites`, `/api/docs` och `/api/search?q=arkitektur` fungerar utan att exponera credentials;
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
14. cache-/heartbeat-beteende har inte regresserat.

Kalla inte deployment klar innan den verifieringen är gjord.
