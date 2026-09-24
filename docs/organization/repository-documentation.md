# Repository-integration för dokumentation

Det här dokumentet beskriver hur `Avkroken/Avkroken`, den publika `.github`-ytan och fristående projektrepositories ska fungera tillsammans.

## Ansvarsfördelning

### Avkroken/Avkroken

Äger den tekniska gemensamma modellen:

- dokumentationsstandard,
- central navigation,
- engineering-kontext,
- monorepots repository-lokala workflows.

### Avkroken/.github

Äger endast GitHubs publika organisationsprofil och community health-filer som ska ärvas av publika repositories.

### Projektrepository

Äger sin egen teknik:

- README,
- `docs/index.md`,
- arkitektur,
- operations,
- API/auth/data/integrationsdokumentation efter behov,
- repo-specifika agentinstruktioner.

### Wiki

Ger en läsarvänlig, klickbar presentation för repos där dokumentationsmängden motiverar flera sidor.

## Rekommenderad struktur

```text
README.md
AGENTS.md
docs/
  index.md
  project-context.md
  architecture.md
  operations.md
  ... ämnesspecifika sidor
```

Små repos kan ha färre filer, men navigation och verifieringsväg ska fortfarande vara tydliga.

## Navigationsflöde

En läsare ska kunna gå:

```text
Avkrokens portal eller dokumentationsnav
        |
        v
repository README
        |
        v
docs/index.md / Wiki
        |
        +--> architecture
        +--> operations
        +--> API/auth/data/etc.
```

## Undvik duplication

Samma detalj ska inte kopieras mellan central docs, README, project-context och Wiki utan anledning.

Använd:

- `docs/organization/` för organisationsgemensamma regler,
- project docs för implementation,
- README för orientering,
- Wiki för navigation/presentation.

## Länkar

Repo-lokala Markdownfiler ska använda relativa länkar när målet ligger i samma repository.

Central navigation använder normala GitHub-länkar till andra repositories.

## Wiki-publicering

Wiki är ett separat Git-repository (`<repo>.wiki.git`). När en automatiserad synk används ska den:

1. utgå från versionsstyrt innehåll i huvudrepositoryt,
2. använda minsta nödvändiga write-permission,
3. endast köras från betrodd default-branch-state,
4. inte låta PR-kontrollerad kod få godtycklig write-access,
5. misslyckas tydligt om Wiki ännu inte är initialiserad.

Innan en sådan synk införs ska Wiki-repot kunna verifieras som initialiserat. En sync-workflow ska inte läggas till som ett blint experiment.

## Underhåll

Vid dokumentationsändring:

- uppdatera källan i projektrepositoryt,
- håll README/index-navigation korrekt,
- uppdatera Wiki-presentationen när publiceringsvägen är tillgänglig,
- uppdatera centrala länkar endast när repo/struktur ändras.
