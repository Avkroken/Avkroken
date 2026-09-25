# Arkitektur — Avkroken Portal

## Ansvarsmodell

Portalens ansvar är presentation, navigation, sök och aggregation.

Portalens ansvar är **inte** att ersätta repositoryägarskap eller att bli system of record för GitHub-/Cloudflare-state.

### Repositoryägd information

```text
Repository
  ├─ README
  ├─ docs/
  ├─ Wiki
  ├─ Issues
  ├─ Discussions
  └─ Releases
       |
       v
Portal adapter/cache
       |
       v
Avkroken-rendering
       |
       +--> Visa original
```

### Publik projektkatalog

`src/project-source.mjs` normaliserar GitHubs publika repositoryobjekt till Portalens projektmodell.

```text
GitHub org repositories
       |
       v
project-source adapter
       |
       +--> filtrera public + active
       +--> exkludera .github + retired sources
       +--> normalisera source/canonical länkar
       +--> härled presentation metadata
       |
       v
GET /api/projects
       |
       +--> Projekt
       +--> Tjänster
       +--> Projektdetalj
```

Projektmodellen skiljer mellan canonical källdata och härledd presentation:

- `source.provider`, `source.repository` och `source.ref` pekar på källan;
- `portalUrl`, `documentation`, `issues`, `discussions`, `releases`, canonical repository-Wiki och intern `wikiPortalUrl` där tillgängligt är navigationslänkar;
- `portalPublished` är en härledd kompatibilitetsflagga för tidigare `/api/sites`;
- `independentProduct` markerar Politiker, Klarspråk och Produkter så Portal-skalet inte används som deras produktidentitet.

Repository utan homepage finns fortfarande i Projekt-katalogen. Endast HTTPS-homepages godtas som publika endpoints.

Monorepo-appar publiceras med explicit opt-in via en appägd `portal.public.json`.

Discovery-flödet:

1. Portalen hittar det publika `Avkroken/Avkroken`-repositoryt i den redan hämtade organisationslistan.
2. Portalen listar endast toppnivån `apps/` internt.
3. För varje appkatalog försöker den läsa exakt `portal.public.json`.
4. `404` betyder “inte publicerad” och genererar ingen publik projektpost.
5. Ett manifest valideras strikt innan en projektpost skapas.
6. Source-path, repository och ref tas från discovery-konteksten och kan inte skrivas över av manifestet.
7. Okända manifestfält kopieras inte till den publika modellen.

Manifestet är presentation/publiceringskonfiguration, inte teknisk source of truth. Appens README/docs äger fortsatt teknisk current-state.

Skvallerbyttan är första opt-in-appen. Manifestet innehåller ingen publik dashboard-URL, så projektposten gör inte den privata dashboarden publik. Jobb och Portal saknar publika appmanifests.

### Projektdetalj

`/projekt/:slug` är ett presentationsskikt ovanpå `/api/projects`, inte en separat provideradapter.

Klientflödet är:

```text
GET /api/projects
       |
       v
client project catalog
       |
       +--> /projekt
       +--> /tjanster
       +--> /projekt/:slug
```

När användaren navigerar till en projektdetalj återanvänds den redan laddade katalogen. Vyn visar canonical source/ref/path och länkar vidare till dokumentation, repository, Wiki där repositorymetadata stödjer det, Issues, Discussions och Releases. Den hämtar inte issue-, release- eller CI-data från GitHub på detaljsidans sidvisning.


### Changelog / Releases

Changelog är en separat publik GitHub-adapter ovanpå samma projektpubliceringspolicy som Projekt-vyn.

```text
GitHub public org repositories
       |
       v
loadPublicProjects()
       |
       +--> repository projects only
       |
       v
GitHub Releases (max 10/repo)
       |
       v
release-source.mjs
       +--> reject drafts
       +--> canonical release URL only
       +--> minimal public model
       |
       v
GET /api/changelog
       |
       v
/changelog
```

Eligibility läses live och går inte via den femminuters `/api/projects`-cachen. Det minskar risken att en nyligen avpublicerad repositoryidentitet används för en releasefetch med en credential som fortfarande har access.

`release-source.mjs` accepterar endast repositoryprojekt under `Avkroken/*`. Monorepo-appar är egna Portal-projekt och får inte ärva source-repositoryts releaser. Draft releases avvisas explicit. Publik modell innehåller inte release body, author, assets eller target SHA.

Providerarbetet är bounded: högst 24 repos, 10 releaser/repo, concurrency 4 och 40 returnerade poster. `bounded` betyder den definierade budgeten; `partial` används vid repo-cap eller release-fetchfel. Ingen persistent Changelog-cache används.

### Wiki-presentation

Repository-Wiki är redan en deterministisk presentationsyta som byggs från repositoryts canonical README/docs genom `.github/workflows/wiki-sync.yml`.

Portalens Wiki-flöde är därför:

```text
repository README/docs
       |
       +--> repo-local Wiki sync --> GitHub Wiki (original presentation)
       |
       +--> Portal docs catalog
                 |
                 +--> /projekt/:slug/wiki
                 +--> /projekt/:slug/dokumentation/...
```

`/projekt/:slug/wiki` läser Portalens befintliga publika projekt- och dokumentationskataloger. Browsern gör inga direkta GitHub API-anrop från Wiki-vyn. Original-Wikin finns alltid som canonical presentationslänk.

Wiki-publicering är repository-specifik: endast projekt med `has_wiki = true` får `wikiPortalUrl`. Monorepo-appar är separata projektidentiteter och får inte ärva source-repositoryts Wiki automatiskt.

### Operativ providerstate

```text
GitHub / Cloudflare
       |
       v
Skvallerbyttan
(read-only observation)
       |
       v
canonical capability / provider health / Activity
       |
       v
PortalObservationsService
(sanitization boundary)
       |
       v
Cloudflare Service Binding
       |
       v
GET /api/operations
       |
       v
Drift & insyn
```

Portalen har ingen parallell GitHub-/Cloudflare-providerklient för Drift & insyn. `SKVALLERBYTTAN_OBSERVATIONS` binder Portal endast till Skvallerbyttans named `PortalObservationsService` och kräver ingen ny bearer-secret.

RPC-entrypointen är en publiceringsgräns, inte ett proxy-API. Den sanerar bort:

- provider endpoint/required permission och accepterade permissions;
- HTTP-statusar, providerfel och rå budgetstate;
- GitHub App installation-/permissionmetadata;
- Activity `recent` med actor/resource/repository/action-detaljer.

Utåt återstår endast providerstatus samt capability status/dataState/freshness/last-success. Scope coverage/repositoryantal och Activity/eventvolym stannar i Skvallerbyttans skyddade dashboard/API eftersom de är organisationsomfattande och inte kan bevisas public-only.

Den här gränsen undviker dubbel providerlogik och bevarar Skvallerbyttans read-only säkerhetsmodell.

### Skyddad Jobb-state

```text
Publik Portal
   |
   +--> Auth-ingång
              |
              v
      jobb.denied.se
      autentiserad backend
              |
              v
       skyddad payload
```

Skyddad payload går aldrig genom Portalens publika dataväg. `/auth/jobb[/...]` redirectas server-side till Jobbs skyddade origin innan Portal-shell renderas.

## Routing

`src/portal-routes.mjs` är Worker-sidans route contract.

`public/shell.js` är klientens path-router.

Kända dokumentroutes returnerar `index.html` från ASSETS så att deep links fungerar utan hash-routing.

API- och asset-paths är inte del av SPA-fallbacken.

### Primära områden

- `/` — Avkroken.
- `/projekt` — projektöversikt.
- `/projekt/:slug` — projektdetalj från den normaliserade publika projektkatalogen.
- `/projekt/:source/dokumentation[/...]` — dokumentation för repository eller explicit opt-in-app; app-URL:er är oberoende av monorepots provider-path.
- `/projekt/:slug/wiki` — Wiki-presentation för repositoryprojekt med publik GitHub Wiki.
- `/dokumentation[/...]` — samlad dokumentationsyta.
- `/tjanster` — publika tjänster/produkter.
- `/auth` — publik auth-ingång utan skyddad payload.
- `/auth/jobb[/...]` — server-side redirect till Jobbs befintliga skyddade origin före Portal-shell.
- `/drift[/...]` — Drift & insyn från den sanerade Skvallerbyttan-snapshoten.
- `/changelog` — officiella publicerade GitHub Releases för Portalens publika repositoryprojekt.
- `/aktivitet` — råare aktivitet.
- `/sok` — reserverad access-aware global sökyta.
- `/om` — produkt- och ägarskapskontext.

Klienten kan fortfarande tolka äldre `#docs/...`-länkar för migration/bakåtkompatibilitet.

## Repository-, app- och dokumentationsadapter

`src/docs-source.mjs` separerar Portalens route-identitet från providerkoordinaterna.

Dokumentationsadaptern:

1. filtrerar till publik, aktiv och icke-retired repository-state;
2. lägger till endast monorepo-appar som redan har ett giltigt `portal.public.json`;
3. söker repositoryts README/`docs/` eller appens app-lokala README/`docs/` till begränsat djup;
4. bygger katalogposter med stabil `key`, canonical source repository/ref och tillåtna route-paths;
5. validerar att vald route-path exakt finns i katalogpostens `pages` före providerfetch;
6. mappar appens route-path, exempelvis `docs/architecture.md`, till provider-path `apps/skvallerbyttan/docs/architecture.md` först efter allowlistkontrollen;
7. returnerar Markdown och canonical `sourceUrl`;
8. taggar appinnehåll med det faktiska source-repositoryt för cacheinvalidering.

Godtycklig GitHub-path kan därför inte användas direkt mot content-endpointen. Jobb saknar publiceringsmanifest och får ingen app-docs-entry.

Relativa Markdown-länkar som pekar på en annan sida i samma publika katalog hålls inne i Portal-skalet. En olöst relativ Markdown-länk till annan canonical monorepo-dokumentation faller tillbaka till motsvarande GitHub-original i stället för en felaktig Portal-path.

Projektadaptern och dokumentationsadaptern använder samma providerfamilj men olika kontrakt: projektadaptern normaliserar projektmetadata, medan dokumentationsadaptern läser uttryckligen tillåtna dokument.

## Caching och freshness

### Projekt

`/api/projects` använder Workers Cache API med fem minuters cachetid. Svaret innehåller:

- `source.provider = github`;
- `source.scope = Avkroken`;
- `source.coverage = active_public_repositories_and_opt_in_apps`;
- `source.appDiscovery` med `available`, `partial`, `unavailable` eller `not_configured`;
- `generatedAt`.

Klientresponsen kräver revalidering. Workers Cache API får en separat response-kopia med `Cache-Control: public, max-age=300`; en cache-hit skrivs tillbaka till klienten med revalideringsheader. `stale-while-revalidate` används inte i Cache API-lagret eftersom Workers Cache API inte stöder direktiven.

`/api/sites` härleds från samma normaliserade projektmodell.

### Dokumentation

Katalog och innehåll har sex timmars CDN-cache och cache tags.

Appdokument använder source-repositoryts tagg. Skvallerbyttans appdokument i `Avkroken/Avkroken` taggas därför som `docs-repo-avkroken`, så befintlig push-signal från monorepot invalidaterar rätt katalog/innehåll.

`DocsInvalidationService` tillåter intern, explicit invalidering för berörda repositories.

## Drift & insyn

Driftvyn konsumerar `GET /api/operations`, som i sin tur anropar `PortalObservationsService.getPublicOperationsSummary()` över intern Service Binding.

Vyn:

- visar GitHub/Cloudflare providerstatus utan auth-/permissiondetaljer;
- visar capability status, data state, freshness och last success;
- visar inte repository-scope counts eller Activity/eventvolym i den publika ytan;
- returnerar/visar degraded state om RPC saknas eller faller;
- kräver ingen provider-write och ingen ny credential.

Detailed Activity, scope coverage och repositoryspecifik Insyn finns fortsatt endast bakom Skvallerbyttans autentiserade dashboard/API-gräns.

Heartbeat/watchdog är fortsatt ett separat livenesskontrakt. Heartbeat får inte tolkas som ersättning för capability/provider health.

## Global sök

Global sök är implementerad som ett server-side index i Worker-lagret.

### Accessgräns

Indexbyggaren tar inte en bred GitHub-sökning som sedan filtreras i browsern. I stället krävs att källan redan har passerat båda publika katalogerna:

```text
public project catalog
          ∩
public docs catalog
          |
          v
search-index.mjs
          |
          v
bounded request-time index
          |
          v
GET /api/search?q=...
          |
          v
ranked results only
```

Detta ger defense in depth:

- `.github` kan finnas i publik docs-discovery men saknar projektpost och indexeras därför inte;
- en monorepo-app måste först ha giltigt `portal.public.json`;
- appdokument måste dessutom finnas i appens publika docs-katalog;
- Jobb saknar båda publiceringsvägarna;
- browsern får aldrig hela indexet och gör inga GitHub API-anrop för sök.

### Indexposter

`src/search-index.mjs` normaliserar tre resultattyper:

- `project`;
- `wiki`;
- `document`.

Varje resultat bär Portal-URL samt canonical original-URL där sådan finns. Dokumentresultat bär source repository/ref/path men inte rå `searchText`.

### Providerbudget och täckning

Kall indexbuild:

- hämtar public project/docs state;
- väljer högst 32 dokument round-robin mellan publicerade docs-källor;
- hämtar max 120 000 tecken per valt dokument;
- använder concurrency 4;
- lagrar inte indexet i Cache API; samtidiga builds i samma isolate delar ett in-flight Promise.

Indexet påstår inte fullständig täckning. `bounded` betyder att definierad budget användes utan observerad reducering; `partial` betyder att dokumentgräns, fetchfel, truncering eller appdiscovery minskade täckningen.

Sökindexet är medvetet utan persistent Cache API-lagring. Det undviker att avpublicerade projektnamn, snippets eller canonical länkar kan ligga kvar i en datacenterlokal cache efter publiceringsändring.

Issues och Discussions är inte indexerade ännu.

## Designskikt

Portalens visuella system har två nivåer:

1. **Avkroken Shell** — Portal, dokumentation, project views, Drift & insyn, Auth-ingång, Changelog och Aktivitet.
2. **Independent Products** — Politiker, Klarspråk och Produkter behåller sina egna visuella system.

Figma är referensverktyg. Runtimeimplementationen ligger i Git.
