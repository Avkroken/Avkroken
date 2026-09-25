# Avkroken Portal

Avkroken Portal är presentations-, navigations- och aggregationslagret på `avkroken.denied.se`.

Portalen ska göra Avkrokens publika projekt, dokumentation, tjänster och observerade drift lättare att konsumera utan att flytta tekniskt ägarskap från respektive repository eller app.

## Ägarskapsprincip

Portalen är **inte** canonical teknisk source of truth.

Respektive repository eller app äger fortsatt sin:

- README,
- `docs/`,
- Wiki,
- Issues,
- Discussions,
- releases,
- repo-/app-specifika instruktioner,
- tekniska current-state.

Portalen får läsa, cachea, rendera och länka innehållet. Speglat innehåll ska behålla en länk till originalkällan.

## Portal v2

Portal v2 etablerar:

- stabil path-baserad navigation;
- ett gemensamt Avkroken-shell;
- design tokens i kod;
- responsiv och keyboard-navigerbar huvudnavigation;
- normaliserad publik repository-project-katalog;
- projekt- och tjänsteytor ovanpå samma projektmodell;
- projektdetalj på `/projekt/:slug` som återanvänder den redan hämtade katalogen och visar canonical navigation utan nya provideranrop;
- stabila dokumentations-URL:er;
- rendering av publik repository-README/docs och opt-in-app-README/docs i portalen;
- publika ytor för Drift & insyn, Changelog, Aktivitet, Auth och Sök utan fabricerad data;
- strukturell separation mellan publik Auth-ingång och skyddad Jobb-origin.

Vyer med ännu ej inkopplad datakälla visar uttryckligen att integrationen ligger i ett senare arbete.

## URL-kontrakt

Portalen känner bland annat igen:

- `/`
- `/projekt`
- `/projekt/:slug` — projektdetalj från den normaliserade publika projektkatalogen.
- `/projekt/:repository/dokumentation[/...]`
- `/dokumentation[/...]`
- `/tjanster`
- `/auth` — publik Auth-ingång.
- `/auth/jobb[/...]` — server-side `302` till befintliga skyddade `https://jobb.denied.se/` före Portal-shell.
- `/drift[/...]`
- `/changelog`
- `/aktivitet`
- `/om`
- `/sok`

Worker-lagret returnerar portalens HTML-shell för kända dokumentroutes. API- och asset-paths skrivs inte om till shellen.

Äldre `#docs/...`-länkar kan fortfarande läsas av klienten för bakåtkompatibilitet.

## Publika API:er

Nuvarande Worker exponerar:

- `GET /api/projects` — normaliserad katalog över aktiva publika repositories som får visas som projekt. Svaret innehåller källmetadata, genereringstid och projektposter.
- `GET /api/sites` — bakåtkompatibel vy över de projekt som har både portal-category-topic och publik HTTPS-homepage.
- `GET /api/docs` — katalog över tillåtna publika repository- och opt-in-appdokument.
- `GET /api/docs/content?repo=...&path=...` — tillåtet publikt Markdown-innehåll och canonical source URL; content-path måste redan finnas i den publika katalogposten.

`.github`, arkiverade/icke-publika repositories och pensionerade source repositories ingår inte i `/api/projects`.

Monorepo-appar publiceras endast genom explicit opt-in. Portalen listar `apps/` internt och försöker läsa exakt `portal.public.json` i respektive appkatalog; saknat manifest är normalt och appen läggs inte till i den publika modellen.

`apps/skvallerbyttan/portal.public.json` är den första appägda publiceringsmanifesten. Den innehåller endast portalpresentation och gör inte Skvallerbyttans privata dashboard publik. Portal och Jobb har inget publikt appmanifest.

Manifestet får inte styra source-path, repository eller ref; de värdena kommer från discovery-konteksten. Okända manifestfält kopieras inte till den publika projektmodellen.

För en opt-in-app använder samma manifestgräns även dokumentationsadaptern. Appens publika URL är source-path-oberoende, exempelvis `/projekt/skvallerbyttan/dokumentation/docs/architecture.md`, medan provideradaptern internt mappar den till `apps/skvallerbyttan/docs/architecture.md`. `Visa original` pekar på canonical GitHub-path.

## Källdata och ansvar

### Repository-/projektdata

```text
GitHub public repositories
  -> project-source adapter
  -> normaliserad katalog
  -> Workers cache
  -> Avkroken Projekt/Tjänster/Projektdetalj
```

### Dokumentationskällor

```text
GitHub repository / explicit opt-in app
  -> Portal docs-source policy
  -> docs adapter
  -> cache
  -> Avkroken-rendering
  -> "Visa original"
```

Godtyckliga provider-paths accepteras inte av content-endpointen; vald route-path måste finnas i den redan byggda publika katalogposten.

### Operativ state

```text
GitHub / Cloudflare
  -> Skvallerbyttan
  -> normaliserad read-only observation
  -> Portal
```

Portalen ska inte skapa en andra bred providerklient för driftdata när Skvallerbyttans modell täcker behovet.

### Skyddad Jobb-data

Skyddad Jobb-data får inte gå genom den publika Portal-datavägen. Den publika Auth-ytan kan länka till Jobb men innehåller ingen skyddad payload. Direkta Portal-paths under `/auth/jobb` redirectas till Jobbs befintliga skyddade origin innan Portal-shell eller datafetch.

## Lokal utveckling

Från `apps/portal`:

```bash
npm install
npm test
npm run dev
```

Deployment sker via repositoryts verifierade produktionsworkflow och ska inte köras från en feature branch.

## Dokumentation

- [Projektkontext](docs/project-context.md)
- [Arkitektur](docs/architecture.md)
- [Drift](docs/operations.md)
- [Designsystem](docs/design-system.md)

Se också [AGENTS.md](AGENTS.md) för app-lokala arbetsregler.
