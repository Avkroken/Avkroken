# Dokumentationsintegration i Avkroken/Avkroken

Detta dokument beskriver **endast monorepot `Avkroken/Avkroken`**.

## Ansvar

### Root

Root äger:

- repositoryövergripande workflows och konfiguration,
- delad dokumentation som faktiskt gäller flera `apps/*`,
- navigation till monorepots appar.

### App

Varje app under `apps/*` äger:

- README,
- `docs/index.md`,
- project-context,
- architecture,
- operations,
- API/auth/data/integrationsdokumentation efter behov,
- app-specifika agentinstruktioner.

### Fristående Avkroken-repository

Äger helt själv sin:

- README och `docs/`,
- Wiki,
- Issues,
- Discussions,
- repo-specifika workflows/instruktioner.

Det finns ingen central engineeringkälla som fristående repositories måste läsa.

### Avkroken/.github

Får bära organisationsprofil, community health och en **genererad lässpegel** av dokumentation. Spegeln är navigation, inte source of truth.

## Navigationsflöde

```text
samlad genererad portal
        |
        v
canonical repository
        |
        +--> README
        +--> docs/index.md
        +--> Wiki
        +--> Issues
        +--> Discussions
```

## Undvik duplication

Teknisk information ändras i det repository som äger den. Aggregatet ska genereras från källan och inte handredigeras som en andra dokumentationsgren.

## Wiki

Wiki är ett separat Git-repository (`<repo>.wiki.git`). Om synkautomation införs ska den utgå från betrodd default-branch-state, använda minsta nödvändiga write-behörighet och aldrig låta opålitlig PR-kod få godtycklig Wiki-write.

## Underhåll

Vid dokumentationsändring:

1. uppdatera källan i ägande repository;
2. håll dess README/docs/Wiki-navigation korrekt;
3. låt aggregatet spegla ändringen automatiskt.
