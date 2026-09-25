# Projektkontext — Avkroken Portal

Senast verifierad mot projektspecifik Releases-integration: 2026-09-25.

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
- publik repository- och opt-in-app-README/docs-katalog;
- hämtning av exakt allowlistat publikt Markdown via app-/repository-aware docs-source-modell;
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
- informationsarkitektur utan GitHub-begrepp som huvudnavigation;
- projektdetalj som återanvänder den normaliserade projektkatalogen och visar canonical länkar utan extra providerfetch per sidvisning;
- Portal-native Wiki-presentation som återanvänder publik project/docs-katalog och länkar tillbaka till original-Wikin;
- server-side global sök som indexerar endast intersektionen av publicerade projekt och publicerade docs-källor;
- Drift & insyn som läser en sanerad read-only observationssnapshot från Skvallerbyttans dedikerade RPC-entrypoint via Cloudflare Service Binding;
- Changelog som läser bounded GitHub Releases endast för live-publicerade repositoryprojekt;
- projektspecifik Releases-vy för repositoryprojekt via samma public-only releaseadapter.

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
- bär canonical GitHub-repository/ref i `source`;
- bär stabil `portalUrl` för projektdetalj och, för repositories där GitHub exponerar det, canonical Wiki-länk samt intern `wikiPortalUrl`.

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

- Skvallerbyttan: publicerad som projektpost utan publik dashboard-URL och med app-lokal README/docs-rendering i Portal-skalet.
- Portal: inget separat appmanifest; `Avkroken`-repositoryprojektet representerar Portalens repositoryyta.
- Jobb: inget publikt appmanifest; skyddad Jobb-state går fortsatt endast via Auth-gränsen.

`source.appDiscovery` anger om appdiscovery var `available`, `partial`, `unavailable` eller `not_configured`.

## Projektdetalj

`/projekt/:slug` renderas från samma katalogpayload som Projekt- och Tjänster-vyerna redan har hämtat. Klientnavigationen gör därför ingen ny GitHub-request när en projektdetalj öppnas.

Detaljvyn visar:

- projektnamn, kategori och beskrivning;
- källtyp (`repository` eller `monorepo_app`);
- canonical repository, ref och app-source-path när sådan finns;
- dokumentation i Portalen;
- publik tjänste-URL när den finns;
- canonical länkar till repository, Wiki där tillgängligt, Issues och Discussions;
- intern Releases-navigation för repositoryprojekt.

Repositoryprojekt kan öppna `/projekt/:slug/releases`, som hämtar endast det aktuella projektets publicerade GitHub Releases via Portalens backend. Monorepo-appar får ingen Releases-länk och kan inte ärva source-repositoryts releasehistorik.

Detaljvyn hämtar fortfarande inte Issues, workflow runs eller annan operativ providerstate. Sådan aggregation ligger kvar som separat arbete och ska använda rätt adapter/Skvallerbyttan där modellen passar.

## Wiki-presentation

Repository-Wikis synkas redan av repo-lokala Actions från canonical `README.md` och `docs/index.md`. Workflows genererar `Home.md`, `Documentation.md` och `_Sidebar.md` och anger uttryckligen att Wikin är navigation/presentation, inte teknisk source of truth.

Portalen skapar därför inte en separat GitHub-Wiki-providerklient. För repositoryprojekt där GitHub rapporterar `has_wiki = true` exponeras `/projekt/:slug/wiki`.

Wiki-vyn:

- läser endast Portalens publika `/api/projects` och `/api/docs`;
- återger projektets Wiki-navigation och publika README/docs som interna Portal-länkar;
- visar canonical länk till GitHub-Wikin;
- länkar Issues/Discussions/Repository till canonical GitHub-ytor;
- gör inga direkta browseranrop till GitHub API;
- publicerar inte Wiki för monorepo-appar enbart därför att source-repositoryt har Wiki.

Skvallerbyttan är därför fortsatt utan separat app-Wiki-yta. Jobb påverkas inte och saknar fortsatt publik app-post.

## Dokumentationsdata

### `/api/docs`

Bygger en katalog från publika, aktiva repositories samt app-lokal README/`docs/` för appar som redan har ett giltigt publikt manifest.

Repositoryposter använder repositorynamnet som katalognyckel. Appposter använder manifestets stabila slug, exempelvis `skvallerbyttan`.

Appens publika dokumentpath är relativ till app-roten och låser därmed inte Portalens URL till `apps/<name>`-strukturen.

### `/api/docs/content`

Tar katalognyckel + route-path, kräver exakt träff i den publika katalogpostens `pages`, mappar därefter till canonical source repository/ref/path och returnerar Markdown samt `sourceUrl` till originalet. Jobb saknar appmanifest och får därför ingen appdokumentationspost.

## Changelog

### `/api/changelog`

Changelog byggs från aktuell public project-state, men endast poster med `type = repository`, `source.provider = github`, `source.kind = repository` och ett canonical `Avkroken/<repo>`-source-repository får användas.

För varje valt repository läses högst 10 GitHub Releases. Adapterpolicyn:

- filtrerar alltid bort `draft = true`, även om den använda GitHub-credentialen skulle kunna se drafts;
- kräver canonical `https://github.com/Avkroken/<repo>/releases/tag/...`-URL;
- kräver `tag_name` och giltig `published_at`;
- publicerar endast project slug/name/Portal-URL, repository, tagg/namn, publiceringstid, release-URL och `prerelease`;
- kopierar inte body, author, assets eller target commit;
- låter inte opt-in monorepo-appar ärva source-repositoryts releaser.

Providerbudgeten är max 24 repositoryprojekt, 10 releaser per repository, concurrency 4 och max 40 returnerade releaser. Normal coverage är därför `bounded`, aldrig komplett. Repo-cap eller individuella release-fetchfel ger `partial`.

Eligibility byggs live från GitHubs publika organisationslista vid varje Changelog-build och snapshoten lagras inte persistent i Cache API. Samtidiga builds i samma isolate delar endast ett in-flight Promise som rensas efter success/failure.

### `/api/releases?project=...`

Den projektspecifika release-endpointen använder samma `eligibleReleaseProjects` och `normalizePublicReleases` som Changelog, men gör lookup på exakt publicerad project-slug och läser endast det repositoryt.

- tom/ogiltig slug: `400 invalid_project`;
- okänt projekt eller monorepo-app: `404 project_releases_not_found`;
- providerfel: `502 project_releases_unavailable`;
- normal respons: `200`, `status = available`, `Cache-Control: no-store`, max 10 releaser.

Responsen innehåller minimal project-identitet, canonical GitHub Releases-länk och samma sanerade releasemodell som Changelog.

## Global sök

### `/api/search?q=...`

Sökindexet skapas i Worker-lagret och exponeras inte som rå klientpayload.

Publiceringsgränsen är:

```text
/api/projects
      ∩
/api/docs
      |
      v
public search index
      |
      v
GET /api/search?q=...
```

Det innebär att en dokumentationspost måste tillhöra ett projekt som redan finns i den publika projektkatalogen. Det är ett extra filter ovanpå docs-adapterns egen allowlist.

Nuvarande indexkategorier:

- `project` — projektnamn, beskrivning och publik source-metadata;
- `wiki` — repository-Wiki som presentationspost när projektet har `wikiPortalUrl`;
- `document` — allowlistad README/docs-Markdown samt canonical source URL.

Jobb saknar publik app-post och app-docs-källa och kan därför inte nå indexbyggaren. `.github` är inte ett publicerat projekt och filtreras bort även om publika docs skulle finnas i docs-katalogen.

Sökindexeringen använder max 32 Markdown-dokument per build med round-robin mellan publicerade källor och max 120 000 tecken per dokument. Det ger rättvisare providerbudget mellan projekten och undviker att ett stort repo tar hela indexbudgeten. Indexet persistenteras inte i Cache API eftersom avpublicering måste slå igenom utan datacenterlokal stale-cache; samtidiga cachefria builds i samma isolate delar i stället ett in-flight Promise.

Coverage rapporteras som:

- `bounded` — indexet byggdes inom den definierade budgeten utan observerade fetch-/appdiscoveryfel;
- `partial` — hårdgräns, dokumentfel, truncering eller ofullständig appdiscovery reducerade täckningen.

Issues och Discussions ingår ännu inte i sökindexet.

## Cache

Aktuella värden i koden:

- project catalog: 300 sekunder i Workers Cache API;
- `/api/sites`: härledd från samma project catalog;
- dokumentationskatalog: 21 600 sekunder via Cloudflare CDN cache;
- dokumentinnehåll: 21 600 sekunder via Cloudflare CDN cache;
- server-side sökindex: ingen persistent Cache API-lagring; samtidiga kalla builds i samma isolate delar ett in-flight Promise;
- Changelog snapshot: ingen persistent Cache API-lagring; samtidiga builds i samma isolate delar ett in-flight Promise.

Skvallerbyttan kan invalidera dokumentationscache internt med cache tags genom Portalens service binding.

## Operativ integration

Skvallerbyttan är den primära read-only observationskällan där dess modell passar.

Direktkopplingen mellan apparna består nu av tre separata least-privilege RPC-kontrakt:

- Skvallerbyttan → Portal: dokumentationscache-invalidering via `DocsInvalidationService`;
- Skvallerbyttan → Portal: operativ heartbeat via `OperationalHeartbeatService`;
- Portal → Skvallerbyttan: sanerad observationssnapshot via `PortalObservationsService`.

Portalens binding `SKVALLERBYTTAN_OBSERVATIONS` pekar endast på den named entrypointen. Driftvyn använder inte Skvallerbyttans skyddade HTTP-`/api/v1`, dashboard-cookie eller `SKVALLERBYTTAN_READ_API_TOKEN`.

Den publika `GET /api/operations` returnerar endast:

- providerstatus och senaste observationstid;
- capability key/name/provider/status/dataState/freshness/lastSuccessAt.

Snapshoten utesluter provider-endpoints och required permissions, accepterade permissions, HTTP-statusar/felsträngar, installation-/budgetmetadata, scope coverage/repositoryantal samt Activity/eventvolym och recent events. De sistnämnda modellerna är organisationsomfattande i Skvallerbyttan och kan därför inte bevisas vara public-only.

Om binding eller RPC är unavailable visar Portalen ett explicit degraded state och fabricerar inte providerstatus.

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

- provider-backed projektdetaljdata för Issues/CI/aktivitet inne i Portalen;
- direkt rendering av eventuellt manuellt Wiki-innehåll utanför den repo-lokalt genererade Wiki-modellen;
- Issues/Discussions i global sök;
- aktivitetsström;
- releaseautomation;
- slutlig end-to-end accessibility-/browserverifiering;
- produktionsdeployment och provider live-verifiering.

Varje nytt arbete ska göras i separat branch/PR enligt repositoryts arbetsregler.
