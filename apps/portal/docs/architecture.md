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
```

Projektmodellen skiljer mellan canonical källdata och härledd presentation:

- `source.provider`, `source.repository` och `source.ref` pekar på källan;
- `documentation`, `issues`, `discussions` och `releases` är navigationslänkar;
- `portalPublished` är en härledd kompatibilitetsflagga för tidigare `/api/sites`;
- `independentProduct` markerar Politiker, Klarspråk och Produkter så Portal-skalet inte används som deras produktidentitet.

Repository utan homepage finns fortfarande i Projekt-katalogen. Endast HTTPS-homepages godtas som publika endpoints.

Monorepo-appar upptäcks inte genom generell scanning i detta lager. Det förhindrar att skyddad appmetadata, särskilt Jobb, exponeras av misstag innan app-discovery har en explicit publik policy.

### Operativ providerstate

```text
GitHub / Cloudflare
       |
       v
Skvallerbyttan
(read-only observation)
       |
       v
normaliserad state
       |
       v
Avkroken Portal
```

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
- `/projekt/:repository` — projektdetaljens stabila namespace.
- `/projekt/:repository/dokumentation[/...]` — repositorydokumentation.
- `/dokumentation[/...]` — samlad dokumentationsyta.
- `/tjanster` — publika tjänster/produkter.
- `/auth` — publik auth-ingång utan skyddad payload.
- `/auth/jobb[/...]` — server-side redirect till Jobbs befintliga skyddade origin före Portal-shell.
- `/drift[/...]` — Drift & insyn.
- `/changelog` — kuraterad release-/produktförändring.
- `/aktivitet` — råare aktivitet.
- `/sok` — reserverad access-aware global sökyta.
- `/om` — produkt- och ägarskapskontext.

Klienten kan fortfarande tolka äldre `#docs/...`-länkar för migration/bakåtkompatibilitet.

## Repository- och dokumentationsadapter

Dokumentationsadaptern:

1. filtrerar till publik, aktiv och icke-retired repository-state;
2. söker README och Markdown under `docs/` till begränsat djup;
3. bygger en katalog;
4. validerar vald repository/path mot katalogen före innehållshämtning;
5. returnerar Markdown och canonical `sourceUrl`;
6. cachear katalog/innehåll med cache tags.

Godtycklig GitHub-path kan därför inte användas direkt mot content-endpointen.

Projektadaptern och dokumentationsadaptern använder samma providerfamilj men olika kontrakt: projektadaptern normaliserar repositorymetadata, medan dokumentationsadaptern läser tillåtna dokument.

## Caching och freshness

### Projekt

`/api/projects` använder Workers Cache API med fem minuters cachetid. Svaret innehåller:

- `source.provider = github`;
- `source.scope = Avkroken`;
- `source.coverage = active_public_repositories`;
- `generatedAt`.

Klientresponsen kräver revalidering. Workers Cache API får en separat response-kopia med `Cache-Control: public, max-age=300`; en cache-hit skrivs tillbaka till klienten med revalideringsheader. `stale-while-revalidate` används inte i Cache API-lagret eftersom Workers Cache API inte stöder direktiven.

`/api/sites` härleds från samma normaliserade projektmodell.

### Dokumentation

Katalog och innehåll har sex timmars CDN-cache och cache tags.

`DocsInvalidationService` tillåter intern, explicit invalidering för berörda repositories.

## Drift & insyn

Portalens Worker har redan intern heartbeat/watchdog-infrastruktur för Skvallerbyttan, men Portalen exponerar inte den som en full Drift & insyn-API.

När driftvyn kopplas in ska den:

- konsumera normaliserad read-only state där Skvallerbyttan redan äger capability;
- skilja observerad aktivitet från komplett aktivitet;
- visa freshness och täckning;
- hantera capability-fel utan att resten av Portalen bryts;
- aldrig kräva provider-write.

## Global sök

Sök är inte implementerad.

Säkerhetskrav för framtida index:

- publicering/indexering ska vara access-aware före data når publikt index;
- Jobb/Auth-payload får inte först indexeras publikt och därefter döljas i UI;
- källdata ska bära canonical URL, repository, ref/path och genererings-/hämtningstid när modellen stöder det.

## Designskikt

Portalens visuella system har två nivåer:

1. **Avkroken Shell** — Portal, dokumentation, project views, Drift & insyn, Auth-ingång, Changelog och Aktivitet.
2. **Independent Products** — Politiker, Klarspråk och Produkter behåller sina egna visuella system.

Figma är referensverktyg. Runtimeimplementationen ligger i Git.
