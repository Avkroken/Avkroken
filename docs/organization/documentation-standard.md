# Avkrokens dokumentationsstandard

**Senast verifierad:** 2026-09-24

Det här dokumentet definierar den organisationsgemensamma modellen för publik projektdokumentation.

## Mål

Dokumentationen ska göra det möjligt att snabbt:

- förstå vad ett repository ansvarar för,
- hitta rätt sektion utan lång README-scroll,
- förstå arkitektur och state ownership,
- köra och verifiera projektet,
- hitta drift- och säkerhetsgränser,
- skilja repo-specifik information från organisationsgemensam information.

## Dokumentationslager

Avkroken använder fyra kompletterande ytor:

1. **README** — kort ingång.
2. **`docs/index.md`** — klickbar innehållskarta.
3. **`docs/*.md`** — versionsstyrd teknisk dokumentation.
4. **GitHub Wiki** — navigations-/presentationsyta där dokumentationsmängden motiverar den.

Ingen av dessa ska behöva bli en jättelik sammanhängande sida.

## README

README ska normalt innehålla:

- en kort beskrivning av projektet,
- snabbaste verifierings-/startvägen,
- tydlig länk till `docs/index.md`,
- några få viktiga invariants när de behövs för att undvika farliga missförstånd,
- länk till säkerhetsrapportering när relevant.

Detaljerad arkitektur, API-referens, migrationer och felsökning ska normalt ligga i `docs/` eller motsvarande ämnessidor.

## docs/index.md

Icke-triviala repositories ska ha `docs/index.md` som dokumentationskarta.

Sidan ska:

- länka till ämnesspecifika dokument,
- erbjuda läsvägar efter uppgift,
- beskriva var olika typer av information hör hemma,
- göra det möjligt att nå viktig dokumentation med ett eller två klick från README.

## Ämnesspecifika docs

Komplexa repositories ska normalt dokumentera det som faktiskt behövs, exempelvis:

- project context/current-state,
- architecture,
- operations,
- API,
- auth,
- data/schema,
- providers/integrationer,
- deployment,
- security.

Filer skapas efter systemets verkliga behov; alla repositories behöver inte exakt samma uppsättning.

## project-context

`docs/project-context.md` ska innehålla repo-specifik teknisk current-state som kan verifieras från repositoryts kod, config och publika kontrakt.

Den ska **inte** bli en kopia av organisationsgemensam ruleset-/Custom Property-/policy-state. Sådan organisationsstate hör hemma centralt eller i provider-state.

Uppdatera project-context när exempelvis runtimearkitektur, integrationsgränser, deploymentmodell, lagring, dataflöde eller kritisk bygginvariant ändras.

## AGENTS.md

`AGENTS.md` är en kort agent-facing karta.

Den ska:

- peka på repoets dokumentationsindex och viktigaste tekniska docs,
- ange obligatorisk verifiering,
- ange kritiska repo-specifika invariants,
- undvika att duplicera långa manualer eller organisationsgemensam current-state.

## GitHub Wiki

Wiki ska användas där dokumentationsmängden eller antalet ämnen gör en klickbar sidstruktur bättre än en enda README.

För icke-triviala repositories är Wiki rekommenderad presentationsyta när den kan hållas i synk utan att skapa en separat konkurrerande sanning.

### Wiki ska

- ha en tydlig Home-sida,
- ha sidebar/navigation när flera sidor finns,
- dela upp dokumentation efter ämne,
- länka tillbaka till repository och versionsstyrda källor när relevant.

### Wiki ska inte

- vara enda platsen för teknisk current-state,
- innehålla secrets eller privat driftinformation,
- användas för att kringgå repositoryts review- eller versionsstyrningsmodell.

GitHub lagrar Wiki i ett separat Git-repository. Därför ska den behandlas som presentationslager ovanpå versionsstyrd projektdokumentation, inte som enda tekniska källa.

## Central nod: Avkroken/.github

`Avkroken/.github` äger:

- gemensamma dokumentationsstandarder,
- central engineering-kontext,
- gemensamma community health-filer,
- återanvändbara workflows,
- organisationens dokumentationsnav.

Den ska länka till projektrepositories men inte duplicera deras tekniska innehåll.

## Säkerhet

Publik dokumentation får inte innehålla:

- tokens eller secrets,
- privata nycklar,
- lösenord,
- känsliga authorization-listor,
- privata runbooks,
- annan information som kräver konfidentialitet.

Icke-hemliga resursnamn, bindings och arkitektur får dokumenteras när det behövs för att förstå den publika koden.

## Uppdateringskontrakt

När implementation, arkitektur eller drift ändras ska relevant versionsstyrd dokumentation uppdateras i samma PR eller direkt efterföljande PR.

README ska förbli en ingång. Om den börjar växa till en manual ska innehållet brytas ut till ämnesspecifika docs och göras nåbart från `docs/index.md` och Wiki.
