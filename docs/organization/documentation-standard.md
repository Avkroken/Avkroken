# Dokumentationsmodell för blixten85/Avkroken

**Scope:** endast detta monorepo.

Fristående Avkroken-repositories äger och definierar sin egen README, `docs/`, Wiki, Issues och Discussions. Den här filen får inte användas som teknisk source of truth för dem.

## Mål

Monorepots dokumentation ska göra det möjligt att:

- hitta rätt app snabbt,
- förstå appens arkitektur och state ownership,
- köra och verifiera appen,
- hitta drift- och säkerhetsgränser,
- skilja app-local information från delad monorepoinformation.

## Dokumentationslager

För en icke-trivial app används normalt:

1. **README** — kort ingång.
2. **`docs/index.md`** — klickbar innehållskarta.
3. **ämnesdokument i `docs/`** — versionsstyrd teknisk dokumentation.
4. **GitHub Wiki** — navigations-/presentationsyta när den ger mervärde.

## Ägarskap

Appens egna tekniska fakta ska ligga nära appen.

`docs/organization/` får endast innehålla sådant som verkligen delas av flera appar i `blixten85/Avkroken` eller gäller rootens repositorystruktur/workflows.

Det får inte innehålla central current-state för fristående repositories.

## project-context

Appens `docs/project-context.md` beskriver app-local current-state som kan verifieras från monorepots kod, config och publika kontrakt.

Extern ruleset-, plan-, token-, webhook- eller provider-live-state ska inte kopieras in som permanent fakta.

## AGENTS.md

`AGENTS.md` ska peka på dokumentation i samma repository, ange obligatorisk verifiering och kritiska lokala invariants. En app ska inte behöva läsa ett annat repository för att förstå sitt tekniska kontrakt.

## Wiki

Wiki är presentation/navigation. Den får inte bli enda platsen för teknisk current-state.

## Samlad organisationsvy

`blixten85/.github` kan automatiskt spegla dokumentation från repositories och deras Wikis. Spegeln ska alltid länka till ursprungskällan och får aldrig bli canonical.

## Säkerhet

Publik dokumentation får inte innehålla credentialvärden, privata nycklar, lösenord, känsliga authorization-listor eller privata runbooks.
