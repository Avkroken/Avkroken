# Projektkontext — Avkroken Portal

Senast verifierad mot project/source-adapterarbetet: 2026-09-25.

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

- normaliserad publik project/source-adapter för aktiva publika repositories;
- bakåtkompatibel publicerad site discovery;
- publik README/docs-katalog;
- hämtning av tillåtet publikt Markdown;
- cache headers och cache tags för dokumentation;
- intern dokumentationsinvalidering via `DocsInvalidationService`;
- intern operativ heartbeat-mottagning via `OperationalHeartbeatService`;
- `OperationalWatchdog` som Durable Object;
- schedulerad watchdog-kontroll;
- central route-modul i `src/portal-routes.mjs`;
- path-baserad klientnavigation i `public/shell.js`;
- server-side shell fallback för kända Portal-dokumentroutes;
- stabila dokumentations-URL:er;
- Portal v2 design tokens och shell-CSS;
- informationsarkitektur utan GitHub-begrepp som huvudnavigation.

## Publik projektmodell

### `/api/projects`

Returnerar ett objekt med:

- källmetadata för GitHub/Avkroken;
- `generatedAt`;
- `projects` — normaliserade aktiva publika repositoryprojekt.

Adapterpolicyn:

- kräver `visibility = public`;
- exkluderar arkiverade repositories;
- exkluderar `.github`;
- exkluderar pensionerade source repositories enligt `repository-policy.mjs`;
- behåller projekt även när publik homepage saknas;
- accepterar bara HTTPS-homepage som publik endpoint;
- markerar Politiker, Klarspråk och Produkter som `independentProduct`;
- bär canonical GitHub-repository/ref i `source`.

### `/api/sites`

Finns kvar för kompatibilitet och härleds från samma projektmodell.

Den returnerar endast projekt där `portalPublished = true`, vilket kräver:

- portal-category-topic;
- publik HTTPS-homepage.

### Monorepo-appar

Monorepo-appar publiceras genom explicit, appägt `portal.public.json`.

Discovery läser endast:

- den redan publika monorepo-listningen under `apps/`;
- exakt manifestfilen i varje appkatalog.

Saknat manifest publicerar ingenting. Manifestdata valideras strikt och får inte styra canonical repository/ref/source-path. Okända fält kopieras inte till API-modellen.

Nuvarande opt-in:

- Skvallerbyttan: publicerad som projektpost utan publik dashboard-URL.
- Portal: inget separat appmanifest; `Avkroken`-repositoryprojektet representerar Portalens repositoryyta.
- Jobb: inget publikt appmanifest; skyddad Jobb-state går fortsatt endast via Auth-gränsen.

`source.appDiscovery` anger om appdiscovery var `available`, `partial`, `unavailable` eller `not_configured`.

## Dokumentationsdata

### `/api/docs`

Bygger en katalog från publika, aktiva repositories och tillåtna README-/`docs/`-Markdownfiler.

### `/api/docs/content`

Returnerar den valda tillåtna Markdownfilen samt `sourceUrl` till canonical repositorykälla.

## Cache

Aktuella värden i koden:

- project catalog: 300 sekunder i Workers Cache API;
- `/api/sites`: härledd från samma project catalog;
- dokumentationskatalog: 21 600 sekunder via Cloudflare CDN cache;
- dokumentinnehåll: 21 600 sekunder via Cloudflare CDN cache.

Skvallerbyttan kan invalidera dokumentationscache internt med cache tags genom Portalens service binding.

## Operativ integration

Skvallerbyttan är den primära read-only observationskällan där dess modell passar.

Nuvarande direktkoppling mellan apparna används för:

- dokumentationscache-invalidering;
- operativ heartbeat.

Portalen visar ingen fabricerad providerstatus. Den visuella Drift & insyn-ytan väntar på separat dataadapter/integration mot normaliserad state.

## Auth / Jobb

Den publika Portalens Auth-yta innehåller endast en säker ingång och information om accessgränsen. `GET`/`HEAD` mot `/auth/jobb` och underpaths redirectas server-side till `https://jobb.denied.se/` innan Portal-shell renderas.

Skyddad Jobb-data:

- får inte pre-renderas i publik HTML;
- får inte ingå i publikt sökindex;
- får inte läggas i publik cache;
- får inte hämtas före server-side auktorisering.

Jobbs app äger sin egen autentiserings- och BankID-/e-identitetsmodell.

## Kända gap

Följande är medvetet inte löst ännu:

- Portal-rendering av app-lokal README/docs för opt-in-appar;
- full projektdetaljdata;
- Wiki-adapter inne i Portalen;
- global access-aware sökindexering;
- Drift & insyn-data från Skvallerbyttans normaliserade API/state;
- changelogaggregation;
- aktivitetsström;
- releaseautomation;
- slutlig end-to-end accessibility-/browserverifiering;
- produktionsdeployment och provider live-verifiering.

Varje nytt arbete ska göras i separat branch/PR enligt repositoryts arbetsregler.
