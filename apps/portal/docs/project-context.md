# Projektkontext — Avkroken Portal

Senast verifierad mot Portal v2-foundationens feature branch: 2026-09-25.

Det här dokumentet beskriver källkodens aktuella Portal-arkitektur. Produktionens privata Cloudflare-kontostate är inte derivat av detta dokument och måste verifieras hos providern före driftändringar.

## Roll

Avkroken Portal är den sammanhållna presentationsytan för:

- Avkroken;
- projekt;
- dokumentation;
- publika tjänster;
- Auth-ingångar;
- Drift & insyn;
- Changelog;
- Aktivitet;
- sök;
- övergripande produktkontext.

Den tekniska source of truth ligger fortsatt i respektive repository/app.

## Nuvarande implementation

Portal kör som Cloudflare Worker med statiska assets.

Worker-koden innehåller idag:

- publik site discovery från GitHub;
- publik README/docs-katalog;
- hämtning av tillåtet publikt Markdown;
- cache headers och cache tags för dokumentation;
- intern dokumentationsinvalidering via `DocsInvalidationService`;
- intern operativ heartbeat-mottagning via `OperationalHeartbeatService`;
- `OperationalWatchdog` som Durable Object;
- schedulerad watchdog-kontroll.

Portal v2-foundationen lägger till:

- central route-modul i `src/portal-routes.mjs`;
- path-baserad klientnavigation i `public/shell.js`;
- server-side shell fallback för kända Portal-dokumentroutes;
- stabila dokumentations-URL:er;
- Portal v2 design tokens och shell-CSS;
- ny informationsarkitektur utan GitHub-begrepp som huvudnavigation.

Project/source-adaptern lägger därefter till:

- `/api/projects` som separat normaliserad project catalog;
- dynamisk discovery från samma publika GitHub-repolista som Worker redan använder;
- presentationsklassning med explicit källa: `portal_policy`, `topic` eller `default`;
- separat behandling av de tre självständiga produkterna;
- `/projekt/:repository` som faktisk projektdetaljvy med intern dokumentation och canonical länkar för områden som ännu saknar egen adapter.

## Data som redan finns

### `/api/projects`

Returnerar Portalens normaliserade project catalog från aktiva publika repositories.

Katalogen filtrerar bort:

- `.github` som organisationsinfrastruktur;
- forks;
- arkiverade/icke-publika repositories;
- pensionerade repositories enligt Portalens repository policy.

Politiker, Klarspråk och Produkter markeras som självständiga produkter enligt Portalens uttryckliga presentationspolicy. Repositories utan explicit presentationstopic förblir synliga med `kindSource: "default"` i stället för att klassningen presenteras som providerfakta.

### `/api/sites`

Returnerar publicerade endpoints från publika, aktiva repositories som uppfyller befintlig portal-category/topic-policy och har en publik HTTPS-homepage.

Den endpointen är fortsatt en endpoint-katalog och inte project catalog.

### `/api/docs`

Bygger en katalog från publika, aktiva repositories och tillåtna README-/`docs/`-Markdownfiler.

### `/api/docs/content`

Returnerar den valda tillåtna Markdownfilen samt `sourceUrl` till canonical repositorykälla.

## Cache

Aktuella värden i koden:

- project catalog: 300 sekunder i Workers Cache API;
- site discovery: 300 sekunder i Workers Cache API;
- dokumentationskatalog: 21 600 sekunder via Cloudflare CDN cache;
- dokumentinnehåll: 21 600 sekunder via Cloudflare CDN cache.

Skvallerbyttan kan invalidera dokumentationscache internt med cache tags genom Portalens service binding.

## Operativ integration

Skvallerbyttan är den primära read-only observationskällan där dess modell passar.

Nuvarande direktkoppling mellan apparna används för:

- dokumentationscache-invalidering;
- operativ heartbeat.

Portal v2-foundationen visar ingen fabricerad providerstatus. Den visuella Drift & insyn-ytan väntar på separat dataadapter/integration mot normaliserad state.

## Auth / Jobb

Den publika Portalens Auth-yta innehåller endast en säker ingång och information om accessgränsen. `GET`/`HEAD` mot `/auth/jobb` och underpaths redirectas server-side till `https://jobb.denied.se/` innan Portal-shell renderas.

Skyddad Jobb-data:

- får inte pre-renderas i publik HTML;
- får inte ingå i publikt sökindex;
- får inte läggas i publik cache;
- får inte hämtas före server-side auktorisering.

Jobbs app äger sin egen autentiserings- och BankID-/e-identitetsmodell.

## Kända gap efter foundation

Följande är medvetet inte löst i foundationen:

- Wiki-adapter inne i Portalen;
- egna Portal-adapters för Issues, Discussions, Releases, Builds/CI och projektspecifik aktivitet;
- global access-aware sökindexering;
- Drift & insyn-data från Skvallerbyttans normaliserade API/state;
- changelogaggregation;
- aktivitetsström;
- releaseautomation;
- slutlig end-to-end accessibility-/browserverifiering;
- produktionsdeployment och provider live-verifiering.

Varje nytt arbete ska göras i separat branch/PR enligt repositoryts arbetsregler.
