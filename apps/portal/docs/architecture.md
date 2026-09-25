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
   +--> Auth/Jobb-ingång
              |
              v
      Jobbs autentiserade backend
              |
              v
       skyddad payload
```

Skyddad payload går aldrig genom Portalens publika dataväg.

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

Worker hämtar publika repositories från GitHub API.

### Project adapter

`src/project-adapter.mjs` normaliserar repositorymetadata till Portalens presentationsmodell.

Katalogen:

1. använder samma publika org-repolista som Worker redan hämtar;
2. filtrerar bort `.github`, forks, arkiverade/icke-publika och pensionerade repositories;
3. markerar Politiker, Klarspråk och Produkter som uttryckligt självständiga produkter;
4. använder repository topic för klassning när en sådan finns;
5. använder `project` som transparent fallback när explicit presentationstopic saknas;
6. genererar canonical länkar till repository, Issues, Discussions, Releases, Actions, commits och Wiki;
7. genererar intern Portal-länk till projektdetalj och dokumentation.

Klassningens ursprung följer med som `kindSource`; den ska inte beskrivas som providerfakta när värdet kommer från Portalens policy eller fallback.

`/api/projects` och `/api/sites` är separata kontrakt. Project catalog beskriver user-facing projekt/tjänster medan sites beskriver publicerade endpoints.

### Dokumentationsadapter

Dokumentationsadapter:

1. filtrerar till publik, aktiv och icke-retired repository-state;
2. söker README och Markdown under `docs/` till begränsat djup;
3. bygger en katalog;
4. validerar vald repository/path mot katalogen före innehållshämtning;
5. returnerar Markdown och canonical `sourceUrl`;
6. cachear katalog/innehåll med cache tags.

Godtycklig GitHub-path kan därför inte användas direkt mot content-endpointen.

## Caching och freshness

### Projects och sites

`/api/projects` och `/api/sites` använder varsin Workers Cache API-nyckel med fem minuters cachetid. De hålls separata eftersom kontrakten har olika semantik.

### Dokumentation

Katalog och innehåll har sex timmars CDN-cache och cache tags.

`DocsInvalidationService` tillåter intern, explicit invalidering för berörda repositories.

Freshness-metadata ska utökas i senare adapterarbete; foundationen fabricerar inte freshness som inte finns i kontraktet.

## Drift & insyn

Portalens Worker har redan intern heartbeat/watchdog-infrastruktur för Skvallerbyttan, men foundationen exponerar inte den som en full Drift & insyn-API.

När driftvyn kopplas in ska den:

- konsumera normaliserad read-only state där Skvallerbyttan redan äger capability;
- skilja observerad aktivitet från komplett aktivitet;
- visa freshness och täckning;
- hantera capability-fel utan att resten av Portalen bryts;
- aldrig kräva provider-write.

## Global sök

Sök är inte implementerad i foundationen.

Säkerhetskrav för framtida index:

- publicering/indexering ska vara access-aware före data når publikt index;
- Jobb/Auth-payload får inte först indexeras publikt och därefter döljas i UI;
- källdata ska bära canonical URL, repository, ref/path och genererings-/hämtningstid när modellen stöder det.

## Designskikt

Portalens visuella system har två nivåer:

1. **Avkroken Shell** — Portal, dokumentation, project views, Drift & insyn, Auth-ingång, Changelog och Aktivitet.
2. **Independent Products** — Politiker, Klarspråk och Produkter behåller sina egna visuella system.

Figma är referensverktyg. Runtimeimplementationen ligger i Git.
