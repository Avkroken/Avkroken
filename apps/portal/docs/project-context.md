# Projektkontext — Avkroken Portal

Senast verifierad mot Portal v2 design-tokenkontrakt, Del 3-hardening, public-safe observerad integration, search/provider-budget och production acceptance: 2026-09-30.

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
- server-side shell fallback för kända Portal-dokumentroutes; fallbacken hämtar asset-roten `/` internt i stället för `/index.html` så Cloudflares HTML-canonicalisering inte kan läcka ut som redirect från en deep link;
- stabila dokumentations-URL:er;
- Portal v2 design tokens för semantic/interactive colors, typography, spacing, form, elevation, focus, motion och responsive reference values samt shell-CSS;
- informationsarkitektur utan GitHub-begrepp som huvudnavigation;
- projektdetalj som återanvänder den normaliserade projektkatalogen och visar canonical länkar utan extra providerfetch per sidvisning;
- Portal-native Wiki-presentation som återanvänder publik project/docs-katalog och länkar tillbaka till original-Wikin;
- server-side global sök som indexerar endast intersektionen av publicerade projekt och publicerade docs-källor;
- Drift & insyn som läser en sanerad read-only observationssnapshot från Skvallerbyttans dedikerade RPC-entrypoint via Cloudflare Service Binding;
- Changelog som läser bounded GitHub Releases endast för live-publicerade repositoryprojekt;
- projektspecifik Releases-vy för repositoryprojekt via samma public-only releaseadapter;
- projektspecifik Issues-vy för repositoryprojekt via public-only Issue-sanitizer med explicit PR-filtrering;
- projektspecifik Builds / CI-vy för repositoryprojekt via Skvallerbyttans cacheade public-safe Actions-summary;
- global och projektspecifik Activity-vy från Skvallerbyttans repositoryfiltrerade observerade eventledger.
- startsidans kontrollpanel som återanvänder endast Portalens public-safe `/api/projects`, `/api/operations` och `/api/activity?days=7`, degraderar källor oberoende och märker aktivitet som observerad/coverage-begränsad;
- Del 3-regressionsskydd för public/protected Auth-gräns, Drift/Changelog/Issues/Releases/Builds/Activity/Search/Home degraded states samt full status-/freshness-vokabulär;
- browserverifiering med axe WCAG 2.2 A/AA och horisontell overflow-kontroll på samtliga top-level-routes i både desktop- och mobilviewport.
- statiska `/access-denied/`, `/access-denied/identity/`, `/access-denied/non-identity/` och `/access-denied/gateway/` med separata Access-/Gateway-semantiker och `noindex,nofollow`;
- gemensam `data-theme`-arkitektur med `legacy`, `forest` och `blackout` ovanpå samma primitive → semantic tokenkedja, där Legacy är fallback och preferensen kan delas som ren presentationsstate;
- public logo-read boundary i `src/logo-assets.mjs`: exakt `/media/logos/<asset-id>`, GET/HEAD, fast `logos/`-keyprefix, MIME-allowlist, `nosniff`, bounded publik cache och ingen listning;
- logo-storage med separerad public/admin-gräns: production binder `PORTAL_LOGOS` till den dedikerade logobucketen, public route är read-only och admin-write kräver Cloudflare Access + origin-JWT; branch-previews saknar medvetet R2/admin-Access-bindings och failar därmed stängt. Den Access-skyddade admin-UI:n har dessutom en explicit `Kör verifiering`-canary som via de ordinarie API-routes skapar en syntetisk SVG, verifierar listning/metadata/public URL, ersätter den med bibehållet asset-id, laddar ned den, raderar den och verifierar 404 efter delete. Vid avbrott försöker klienten radera testasseten i `finally`; ingen service token eller separat verifieringscredential används.


## Startsida / kontrollpanel

`/` är inte längre enbart en statisk navigationsyta. Browserklienten `public/home-dashboard.js` sammanställer ett begränsat nuläge från tre redan existerande Portal-API:er:

- `/api/projects` för antal publicerade projekt;
- `/api/operations` för public-safe provider-/capability-state från Skvallerbyttans read-only modell;
- `/api/activity?days=7` för repositoryfiltrerad observerad aktivitet.

Kontrollpanelen gör inga browseranrop till GitHub, Cloudflare eller Skvallerbyttans externa origin och läser ingen Auth/Jobb-väg. Varje källa degraderar separat. Om observationsunderlag saknas visas det som otillgängligt eller ej observerat; Portalen fyller inte i saknad state med antaganden.

Startsidan läser medvetet inte `/api/changelog` automatiskt. Changelog-adaptern gör bounded GitHub Release-läsningar och ska inte förvandlas till en extra providerread på varje startsidesvisning. Officiell releasehistorik finns fortsatt på den explicita Changelog-ytan.
## Publik projektmodell

### `/api/projects`

Returnerar ett objekt med:

- källmetadata för GitHub/Avkroken;
- `generatedAt`;
- `projects` — normaliserade aktiva publika repositoryprojekt.

Repositoryunderlaget hämtas primärt via `SKVALLERBYTTAN_OBSERVATIONS.getPublicRepositories()`. Den metoden använder Skvallerbyttans befintliga read-only GitHub App för live `/installation/repositories`, sanerar svaret till publik repositorymetadata och lämnar varken installation-/permissionmetadata, budgetstate eller credentials. Portalens credential-fria GitHub REST-listning finns kvar endast som rollout/degraded fallback.

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
- canonical länkar till repository, Wiki där tillgängligt och Discussions;
- intern Issues-, Releases-, Builds / CI- och Activity-navigation för repositoryprojekt.

Repositoryprojekt kan öppna `/projekt/:slug/releases`, som hämtar endast det aktuella projektets publicerade GitHub Releases via Portalens backend. De kan också öppna `/projekt/:slug/issues`, som läser högst 30 senast uppdaterade GitHub Issues efter public project-lookup och filtrerar bort pull requests. Releases/Issues/Changelog återanvänder en separat 60-sekunders publik repositorygate när Portal saknar egen GitHub-credential; inventoryn bakom gaten kommer normalt från Skvallerbyttans autentiserade read-only RPC och Portalens publika REST är fallback. `/projekt/:slug/builds` läser en cachead, sampled Actions-summary genom samma `PortalObservationsService` efter fortsatt live-public repositorygate; Portalen gör ingen separat Actions-providerread. Monorepo-appar får inte ärva source-repositoryts Issues, Releases, CI eller Activity som appdata.

Detaljvyn hämtar fortfarande inte annan rå operativ providerstate. Sådan aggregation ska fortsatt använda rätt adapter/Skvallerbyttan där modellen passar.

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

Changelog byggs från aktuell public project-state, men endast poster med `type = repository`, `source.provider = github`, `source.kind = repository` och ett source-repository som matchar Portalens current owner-kontrakt i `github-scope.mjs` får användas.

För varje valt repository läses högst 10 GitHub Releases. Adapterpolicyn:

- filtrerar alltid bort `draft = true`, även om den använda GitHub-credentialen skulle kunna se drafts;
- kräver en canonical `https://github.com/<current-owner>/<repo>/releases/tag/...`-URL som exakt matchar projektpostens repository;
- kräver `tag_name` och giltig `published_at`;
- publicerar endast project slug/name/Portal-URL, repository, tagg/namn, publiceringstid, release-URL, `prerelease` och en bounded `categories`-lista;
- härleder Changelog-kategorier endast från exakta Markdown-sektionsrubriker i release body: Features, Bug Fixes/Fixes, Security och Documentation/Docs; alla poster får dessutom kategorin Releases;
- kopierar inte body, author, assets eller target commit till den publika modellen;
- låter inte opt-in monorepo-appar ärva source-repositoryts releaser.

Providerbudgeten är max 24 repositoryprojekt, 10 releaser per repository, concurrency 4 och max 40 returnerade releaser. Normal coverage är därför `bounded`, aldrig komplett. Repo-cap eller individuella release-fetchfel ger `partial`.

Eligibility för Changelog, projektspecifika Releases och Issues kommer från en repository-only publiceringsgate. I nuvarande credential-fria Portal-runtime får gaten återanvändas i högst 60 sekunder; normalfallet är live-inventory från Skvallerbyttans read-only GitHub App via Service Binding och Portalens publika GitHub REST används endast som fallback. Om en Portal-credential konfigureras kringgås eligibility-cachen. Själva Changelog-snapshoten och release-/issue-payloads lagras inte persistent i Cache API. Samtidiga Changelog-builds i samma isolate delar endast ett in-flight Promise som rensas efter success/failure.

Changelog-klienten filtrerar den redan sanerade snapshoten lokalt med `Alla`, `Features`, `Fixes`, `Security`, `Documentation` och `Releases`. Det skapar inga ytterligare providerreads. `Deployments` publiceras inte som filter eftersom releaseadaptern ännu saknar en verifierad canonical deploymentrelation; Portalen fabricerar inte den kopplingen från taggar eller tidsnärhet.

### `/api/releases?project=...`

Den projektspecifika release-endpointen använder samma `eligibleReleaseProjects` och `normalizePublicReleases` som Changelog, men gör lookup på exakt publicerad project-slug och läser endast det repositoryt.

- tom/ogiltig slug: `400 invalid_project`;
- okänt projekt eller monorepo-app: `404 project_releases_not_found`;
- providerfel: `502 project_releases_unavailable`;
- normal respons: `200`, `status = available`, `Cache-Control: no-store`, max 10 releaser.

Responsen innehåller minimal project-identitet, canonical GitHub Releases-länk och samma sanerade releasemodell som Changelog.

## Projektspecifika Issues

### `/api/issues?project=...`

Endpointen använder aktuell public project-state och accepterar endast poster som uppfyller repositorykraven i `eligibleIssueProjects`.

Providerread:

- exakt `owner/repo` från den redan validerade project-posten, där owner måste matcha Portalens current owner-kontrakt;
- `state=all`, sorterad efter senaste uppdatering;
- max 30 providerposter;
- GitHubs PR-poster filtreras genom `pull_request`-fältet.

Den publika modellen innehåller:

- project slug/name/Portal URL;
- repository;
- issue-nummer och titel;
- `open`/`closed`;
- created/updated;
- comment-count;
- högst åtta labelnamn;
- canonical GitHub Issue-URL.

Body, user/author, assignee, milestone, label color/description och andra råfält kopieras inte.

Felmodell:

- tom/ogiltig slug: `400 invalid_project`;
- okänt projekt eller monorepo-app: `404 project_issues_not_found`;
- providerfel: `502 project_issues_unavailable`;
- normal respons: `200`, `status = available`, `Cache-Control: no-store`.

## Projektspecifik Builds / CI

### `/api/builds?project=...`

Endpointen kräver först ett live-publicerat repositoryprojekt från samma sanerade repositoryinventory som projektkatalogen. Inventoryn kommer normalt från `PortalObservationsService.getPublicRepositories()` och faller endast tillbaka till Portalens credential-fria publika GitHub REST vid rollout/degraded state. App-manifest läses inte för denna repository-only gate. Därefter anropas samma interna binding och metoden `getPublicRepositoryCi(repoName)`.

Skvallerbyttans metod gör **ingen ny GitHub-request**. Den läser `overview` ur D1 source cache och kräver att den cacheade repositoryraden själv är publik och inte arkiverad innan någon CI-summary kan lämna observationslagret.

Snapshoten innehåller:

- repository;
- `available` + status;
- `fresh|stale|unknown`;
- source cache `refreshedAt`;
- sample coverage: sampled runs, total reported runs och samplegräns 100;
- completed/success/failed/cancelled/in-progress;
- sampled pass rate;
- failures senaste 24h/7d;
- latest failure timestamp;
- median/p95 duration;
- median MTTR + sample count.

Den innehåller inte actor, providerpermissions, providerfel, event breakdown, head SHA/branch eller råa run-rader.

Felmodell i Portal:

- tom/ogiltig slug: `400 invalid_project`;
- okänt projekt eller monorepo-app: `404 project_builds_not_found`;
- saknad RPC-binding/metod: `503 builds_not_configured`;
- RPC-/projektkatalogfel: `502 project_builds_unavailable`;
- giltigt projekt med ej observerad/unavailable CI: `200 status=available` med `ci.available = false`.

## Observerad Activity

### `/api/activity?days=...&project=...`

Activity använder samma live-public repositorygate som Builds innan någon intern observationsdata läses. Repositoryinventoryn kommer normalt från Skvallerbyttans autentiserade read-only `getPublicRepositories()`-RPC och Portalens publika REST är endast fallback. Om `project` anges måste slugen resolvea till exakt ett repositoryprojekt. Utan `project` väljs högst 50 live-publika repositoryprojekt.

Portal → Skvallerbyttan sker genom `PortalObservationsService.getPublicActivity(repositoryNames, days)`. RPC:n:

- accepterar endast bounded repository-kortnamn;
- gör en andra kontroll mot cachead `overview`: `visibility = public`, inte arkiverad;
- queryar endast D1 `observation_events`, aldrig GitHub/Cloudflare provider;
- filtrerar till `provider = github` och de godkända repositorynamnen;
- fail-closed om en explicit repository-lista blir tom/ogiltig;
- returnerar endast aggregate counts, coverage och de högst 100 senaste ledger-raderna från den redan filtrerade queryn.

Public snapshot och Portalens andra projektion tar bort `resourceId`, actors, providerfel, permissions och andra råfält. Recent events innehåller endast repository/project, capability, source, coverage, event/action och occurred/received timestamps. Public Activity tillåter endast capability-grupperna `github.avkroken.repositories`, `github.avkroken.pull_requests` och `github.avkroken.actions`; security, Custom Properties och effective-ruleset-events stannar i den skyddade observationsytan.

Global Activity visar inte Cloudflare account-/org-events. Sådan aktivitet kan inte publiceras förrän en separat uttrycklig service-/publiceringsmapping finns.

Coverage är observerad coverage, exempelvis `since_first_observation`; `periodComplete` påstås inte vara true.
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
- `document` — allowlistad README/docs-Markdown samt canonical source URL;
- `issues` — projektets publika Issues-yta;
- `issue` — bounded, sanerade Issue-poster med titel, nummer, state och labels men utan body/author/assignee;
- `discussions` — projektets canonical Discussions-yta. Discussion-innehåll läses inte.

Jobb saknar publik app-post och app-docs-källa och kan därför inte nå indexbyggaren. `.github` är inte ett publicerat projekt och filtreras bort även om publika docs skulle finnas i docs-katalogen.

Sökindexeringen återanvänder den cacheade publika projektkatalogen som första säkerhetsgrind och bygger dokumentationskatalogen endast från de redan publicerade projekten. Dokumentupptäckten läser primärt allowlistade Markdown-paths genom `PortalObservationsService.getPublicDocumentationPages()` och Skvallerbyttans autentiserade read-only GitHub App; Portalens credential-fria Git-tree-read är rollout/degraded fallback. Repositoryprojekt och opt-in-appar med samma source-repository dedupliceras och tree-reads begränsas till concurrency 2. Exakt allowlistad Markdown hämtas därefter från GitHubs raw-content-origin; ingen godtycklig provider-path kan konstrueras från klientinput. Indexet använder max 32 Markdown-dokument per build med round-robin mellan publicerade källor, concurrency 4 för själva innehållsläsningen och max 120 000 tecken per dokument. Därutöver indexeras högst åtta repositoryprojekt och högst åtta sanerade Issues per repository med concurrency 2. GitHub Issues-endpointens pull requests filtreras bort före indexering. Discussion-innehåll hämtas inte eftersom ingen ny Discussions-providerpermission införs; endast redan publik canonical Discussion-URL från projektmodellen indexeras. Indexet persistenteras inte i Cache API eftersom avpublicering måste slå igenom utan datacenterlokal stale-cache; samtidiga cachefria builds i samma isolate delar i stället ett in-flight Promise.

Coverage rapporteras som:

- `bounded` — indexet byggdes inom den definierade budgeten utan observerade fetch-/appdiscoveryfel;
- `partial` — hårdgräns, dokumentfel, truncering eller ofullständig appdiscovery reducerade täckningen.

Issues ingår nu bounded i sökindexet och Issues-/Discussions-ytorna är sökbara. Discussion-innehåll indexeras medvetet inte utan ett separat, verifierat providerpermissionsbeslut.

## Cache

Aktuella värden i koden:

- project catalog: 300 sekunder i Workers Cache API;
- `/api/sites`: härledd från samma project catalog;
- dokumentationskatalog: 21 600 sekunder i Workers Cache API med `docs-catalog`-tag samt motsvarande CDN-cachekontrakt;
- dokumentinnehåll: 21 600 sekunder via Cloudflare CDN cache;
- server-side sökindex: ingen persistent Cache API-lagring; samtidiga kalla builds i samma isolate delar ett in-flight Promise;
- Changelog snapshot: ingen persistent Cache API-lagring; samtidiga builds i samma isolate delar ett in-flight Promise. Release→PR/commit härleds endast från canonical release metadata och deploymentrelationer hämtas separat från Skvallerbyttans public-safe RPC med exakt SHA-matchning.

Skvallerbyttan kan invalidera dokumentationscache internt med cache tags genom Portalens service binding.

## Operativ integration

Skvallerbyttan är den primära read-only observationskällan där dess modell passar.

Direktkopplingen mellan apparna består nu av tre separata least-privilege RPC-kontrakt:

- Skvallerbyttan → Portal: dokumentationscache-invalidering via `DocsInvalidationService`;
- Skvallerbyttan → Portal: operativ heartbeat via `OperationalHeartbeatService`;
- Portal → Skvallerbyttan: sanerade read-only snapshots via `PortalObservationsService`, inklusive public repository inventory, dokumentationspaths, publicerade releases, Drift, repository-CI, repository-Activity och bounded release→deployment-korrelation på exakt commit-SHA.

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

## Portal-admin, logo-assets och R2

Logotypadministrationen är en separat skyddad kontrollplansyta och återanvänder inte Jobbs authcookie eller någon client-only session. `/admin/logos[/...]` och `/api/admin/logos[/...]` ligger bakom en path-specifik Cloudflare Access-applikation. Workern gör dessutom egen origin-verifiering av `Cf-Access-Jwt-Assertion` mot teamdomänens JWKS, issuer och exakt `ACCESS_LOGO_ADMIN_AUD`. Saknad authkonfiguration failar med `503`, saknad assertion med `401` och ogiltig assertion med `403`.

Den skyddade API-ytan kan lista, ladda upp, läsa metadata, ersätta, ladda ned och radera logo-assets. Alla storageoperationer är låsta till `logos/`, uppladdningar är max 5 MiB och måste passa både allowlistad MIME och filsignatur/validering. Providerfel saneras till bounded felkontrakt och adminrespons lagras inte i cache. Admin-HTML är `noindex,nofollow`, `no-store` och levereras med restriktiv CSP, `frame-ancestors 'none'` och `X-Frame-Options: DENY`.

Den publika delen är fortsatt strikt read-only:

```text
GET|HEAD /media/logos/<asset-id>
          |
          +--> strikt asset-id-validering
          |
          +--> key = logos/<asset-id>
          |
          +--> PORTAL_LOGOS.get(key)
          |
          +--> MIME allowlist + public cache + nosniff
```

Ingen route accepterar bucket-key från klienten och ingen `list()` används. Saknad `PORTAL_LOGOS` ger `503`, storagefel `502`, saknat/ogiltigt asset `404` och otillåten MIME `415`.

Current `apps/portal/wrangler.jsonc` definierar production-bindingen `PORTAL_LOGOS -> avkroken-portal-logos` samt Access team domain och app-AUD. `previews` definierar varken `r2_buckets` eller adminens Access-`vars`, så branch-previews kan inte skriva till production-bucketen och adminytan failar stängt där. Bucketens public-access-state, Access-appens policy och övrig privat Cloudflare-state är fortfarande provider-state och ska live-verifieras; repositorykonfigurationen är inte bevis för att de externa objekten existerar.

## Accessibility och browserverifiering

Portalens statiska och klientdrivna shell verifieras i två lager:

- `npm test` låser HTML-/shellkontrakt för skip-link, SPA-fokus och mobilmenyn;
- `npm run test:browser` startar en lokal fixture-server, kör Portalens faktiska HTML/CSS/JS i headless Google Chrome via ChromeDriver och injicerar `axe-core`.

Browsergaten kör WCAG 2.2 A/AA-regler från axe på samtliga top-level-routes i både desktop- och mobilläge. Den verifierar dessutom:

- skip-link är första tabb-stopp och flyttar fokus till `#portal-content`;
- SPA-navigation flyttar fokus till den nya aktiva sidans `h1`;
- `aria-current="page"` följer aktiv route;
- exakt en route-panel är synlig efter navigation;
- Escape stänger öppen mobilnavigation och återför fokus till menyknappen;
- samtliga top-level-routes saknar horisontell dokumentoverflow i mobilviewport.

`#portal-content` är `tabindex="-1"` för deterministisk skip-link-fokus. Route-`h1` får temporärt `tabindex="-1"` när shellen flyttar fokus och återställs vid blur.

CI använder Chrome/ChromeDriver som redan finns i GitHubs `ubuntu-latest` runner image. Inga browsercredentials eller provideranrop används; API-responser i browsertestet är syntetiska publika tom-fixtures.

Detta verifierar repositoryimplementationen i browser. Produktionens faktiska Cloudflare-deployment, provider live-state och externa nätverksvägar ligger fortsatt utanför denna gate.

## Del 3 — verifierad slutstate 2026-09-30

Repositoryhardening och productionfixar som är mergade på `main`:

- PR #55–#60 låser Auth/Jobb-gränsen, degraded states, browser/a11y-gaten och Driftens fulla status-/freshness-vokabulär;
- PR #82 fixar server-side shell fallback så Portalens deep links inte canonicaliseras till `/`;
- PR #86 reducerar publika GitHub-providerbursts genom bounded katalog-/tree-läsningar och återanvändning av public-safe cachegates;
- PR #87 flyttar public repository inventory till `PortalObservationsService.getPublicRepositories()`, som använder Skvallerbyttans befintliga read-only GitHub App och sanerar payloaden före Service Binding-svaret. Portalens credential-fria GitHub REST finns endast som rollout/degraded fallback.

Efter merge av PR #87 rapporterade Cloudflare Workers Builds lyckad **production** build från samma `main`-commit för `avkroken`, `dumpen`, `jobb` och `skvallerbyttan`. En live-tail på Skvallerbyttan observerade därefter `PortalObservationsService.getPublicRepositories - Ok` samtidigt som Portalens första v9-katalogbuild returnerade åtta förväntade publika projekt. Det verifierar den account-interna repositoryvägen end-to-end utan ny Portal-credential.

Production acceptance kördes mot `https://avkroken.denied.se` efter deployment och gav 59/59 godkända kontroller. Verifieringen omfattade huvudroutes/deep links, Auth/Jobb-redirect, denied-routes/noindex, R2 read-boundary, Cloudflare Access-intercept för logo-admin, projekt/docs, Drift, Changelog, Releases, Issues, Builds/CI och Activity samt monorepo-appens fail-closed arv. Tio separata sökningar — fem för `arkitektur` och fem för `jobb` — returnerade 200 utan tidigare intermittenta GitHub-403/502; inga sökresultat hade skyddad `apps/jobb/**` som source.

PR #87:s Portal-CI var grön. Portal-jobbet kör `npm test`, Chrome/ChromeDriver-baserad `npm run test:browser` med axe WCAG 2.2 A/AA samt Wrangler dry-run, så browser-/responsive-kontraktet verifierades i CI även om MP100 saknar lokal ChromeDriver.

Releaseautomation verifierades live repo-för-repo 2026-09-30. `Avkroken`, `Bastion`, `Docker-idempotent-update`, `Klarsprak`, `Pastebinit`, `Politiker` och `Produkter` har alla repoägd `.github/workflows/release.yml` på `main`, och respektive senaste release-workflow var `success`. Äldre dokumentation om blockerade Produkter-/Klarspråk-release-PR:er är därmed supersederad.

## Kända gap

Följande ligger utanför den nu verifierade Portal v2-kärnan eller saknar nödvändig interaktiv åtkomst för separat acceptance:

- direkt rendering av eventuellt manuellt Wiki-innehåll utanför den repo-lokalt genererade Wiki-modellen;
- Discussion-innehåll i global sök är inte aktiverat eftersom det skulle kräva en separat providerpermission/GraphQL-väg; canonical Discussions-ytor är däremot sökbara;
- Changelog-korrelationen är implementerad för relationer som kan bevisas från canonical release metadata och exakt GitHub deployment-SHA. GitHub-miljöer som inte skapar Deployment-objekt visas som `not_observed`, inte som antaget deployade;
- logo-admins production-CRUD kräver fortsatt en legitim interaktiv Cloudflare Access-session och kan därför inte impersoneras från den nuvarande terminalmiljön. Admin-UI:n innehåller nu ett självrensande canaryflöde som gör hela punkt 2d till ett enda autentiserat klick; edge-intercept, origin-gräns, R2 read-binding och fail-closed paths är redan verifierade och ingen service token skapas för testet.

Varje nytt arbete ska göras i separat branch/PR enligt repositoryts arbetsregler.
