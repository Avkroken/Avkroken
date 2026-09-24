# Cloudflare credential standard

**Status:** Aktiv migrering  
**Senast verifierad:** 2026-09-19

Det här dokumentet definierar Avkrokens organisationsgemensamma modell för Cloudflare Account API Tokens. Modellen är en styrningsstandard för behörighetsklasser och resource scope. Den innehåller inga tokenvärden, account-ID:n, privata appnamn, exakta GitHub secret-namn eller andra operativa hemligheter.

Aktuell faktisk Cloudflare-konfiguration vinner alltid över detta dokument. Vid tokenutgivning ska Cloudflares live-dashboard och den genererade **Token Summary** verifieras innan tokenet skapas, eftersom Cloudflare kan ändra innehållet i standardtemplates utan att äldre dokumentation uppdateras samtidigt.

## Mål

Standardmodellen ska:

- ersätta appunika Cloudflare API-token där en delad credentialklass är tillräcklig,
- hålla antalet långlivade credentials litet och begripligt,
- återanvända Cloudflares standardtemplates när de träffar Avkrokens behov rimligt väl,
- tillåta medvetet behörighetsöverskott när det ger enklare och stabilare drift,
- skilja normal läsning, känsligare observation, säkerhetsläsning, normal skrivning och administrativ konfiguration,
- separera tokenadministration från all normal applikations- och driftåtkomst,
- stödja central rotation utan att permissionsdesign och credentialrotation blandas ihop.

## Grundmodell

Read-klasserna är både **partitionerade** och **rangordnade**:

```text
R1 < R2 < R3
```

Högre nummer betyder känsligare eller mer privilegierad informationsyta. Det betyder **inte** arv eller superset.

```text
R1 ∩ R2 = ∅
R2 ∩ R3 = ∅
R3 innehåller inte automatiskt R1 eller R2.
```

En konsument som behöver funktioner från flera read-klasser får flera credentials och väljer rätt credential för respektive API-operation.

Write/operations följer motsvarande princip:

```text
W1 < O1
```

W1 är normal Developer Platform-write. O1 är högre klassad infrastruktur-, edge- och säkerhetsadministration. O1 är inte ett superset av W1.

Tokenadministration ligger helt utanför R/W/O-modellen.

## Resource scope

De delade organisationscredentialsen ska normalt använda:

- **Entire Account** för account-scopade permission groups.
- **All Domains / all zones** för zone-scopade permission groups.

Cloudflares granulariteter för **Specified Domains**, **Specified Workers**, specifika R2-buckets och andra individuella resurser används endast när det finns ett uttryckligt behov av en specialcredential. De ska inte vara standard för organisationsgemensamma klasser.

Resource scope och permissionklass är separata axlar. Samma permission group kan förekomma med olika resources, och specifika Workers/R2-buckets kan exponera andra permission groups än account-wide motsvarigheter.

## R1 — Platform / Resource Read

R1 är normal teknisk läsning av Cloudflares Developer Platform och grundläggande resursinventering.

Kanonisk permissionmängd:

### Entire Account

- D1 Read
- Workers KV Storage Read
- Workers R2 Storage Read
- Workers Metadata Read-Only

### Domain scope

- Zone Read

Workers Metadata Read-Only är R1:s avsiktliga Workers-nivå: metadata, settings och observability utan Worker script content. Legacy-permissionen Workers Scripts Read motsvarar i den nya modellen Workers Content Read-Only och hör därför inte till R1.

## R2 — Analytics / Content / Operations Read

R2 är högre klassad än R1 och omfattar analytics, Worker-innehåll och operativ account-insyn. Separata legacy-permissions för Workers Observability används inte i den kanoniska modellen; observability-metadata täcks av Workers Metadata Read-Only och Worker-innehåll av Workers Content Read-Only.

Kanonisk permissionmängd:

### Entire Account

- Account Analytics Read
- Workers Content Read-Only
- Notifications Read
- Account Settings Read

Workers Content Read-Only ersätter legacy Workers Scripts Read när Worker-innehåll behöver läsas.

## R3 — Security / Identity Read

R3 är högst rankad read-klass och omfattar säkerhets-, Access-, Zero Trust- och cloudflared-observation.

Kanonisk permissionmängd:

### Entire Account

- Access: Apps and Policies Read
- Cloudflare One Connector: cloudflared Read
- Zero Trust Read

### Domain scope

- Bot Management Read
- Zone WAF Rules Read

Cloudflare One Connector: cloudflared Read används för moderna `/cfd_tunnel`-anrop. Argo Tunnel (Legacy) används inte.

## W1 — Developer Platform Write

W1 är den normala delade skrivcredentialen för Cloudflares Developer Platform och CI/CD-deploy.

Kanonisk permissionmängd:

### Entire Account

- Workers Editor
- Workers KV Storage Write
- Workers R2 Storage Write
- Pages Write
- CF Agents Write
- Workers Containers Write
- D1 Write
- Queues Write
- Browser Run Write
- Secrets Store Write

### Domain scope

- Workers Routes Write

Secrets Store Write ingår i W1 eftersom samma Wrangler-deploy som publicerar Workern också deklarerar och uppdaterar dess Secrets Store-bindings. Varje Secrets Store-secret som ska bindas till en Worker måste dessutom ha `workers` i secretens scope-lista; detta är en egenskap på secretet och ersätts inte av deploytokenets permission.

Workers Editor täcker uppdatering/deploy av befintliga Workers men inte bootstrap-skapande eller borttagning. Om en ny Worker måste skapas hanteras det som en separat bootstrap-/administrationsåtgärd i stället för att permanent bredda W1.

## O1 — Infrastructure / Security Administration

O1 är den reserverade klassen för infrastruktur-, edge- och säkerhetsadministration som ligger utanför normal Developer Platform-write.

Det finns ingen aktiv kanonisk O1-credential så länge ingen verifierad konsument behöver den. När O1 aktiveras väljs minsta faktiska permissionmängd från Cloudflares live-dashboard och Token Summary för den konkreta DNS-/Bot-/WAF-operationen. Därmed låses inte standarden till äldre `Write`-/`Edit`-etiketter innan ett sådant behov finns.

Secrets Store Write ligger i W1 för Wrangler-deploy av Secrets Store-bundna Workers och ska inte dupliceras i O1. Account API Tokens Write får aldrig läggas i O1.

## Token administration

Tokenadministration är ett separat control plane och får inte delas med applikationsruntime, normal Developer Platform-write eller O1.

Account-owned tokens hanteras under **Manage Account > Account API Tokens**. Den kanoniska API-permissionen för separat tokenadministration är **Account API Tokens Write**; user-scopade token-templates ska inte användas som ersättning för detta account-owned-flöde.

Denna credential:

- ska hållas separat från R1/R2/R3/W1/O1,
- ska inte distribueras till vanliga repositories eller Workers,
- ska inte användas som generell admincredential,
- ska inte skapas alls om token lifecycle kan hanteras tillräckligt via Cloudflare Dashboard.

## Credentialdistribution

GitHub Organization Secrets är den centrala credentialkällan för GitHub-hostade workflows som behöver en viss klass. Repositoryåtkomst till ett org-secret ska begränsas till de repositories som faktiskt behöver klassen.

Cloudflare Secrets Store är den centrala credentialkällan för Worker-runtime när en Worker behöver konsumera en delad credentialklass. Secrets Store-bindings är separata från vanliga Worker **Variables and Secrets** och värdet hämtas asynkront via bindingens `get()`. Varje secret som binds till en Worker ska ha `workers` i sin scope-lista.

Exakta secret-namn, repositorytilldelningar, tokenvärden och operativ migreringsordning dokumenteras inte i detta publika repository.

## Kodkontrakt

Ett enskilt Cloudflare API-anrop använder ett Bearer-token. En applikation som behöver flera credentialklasser får därför flera bindings/env-inputs och väljer rätt credential per API-operation.

Kod ska inte:

- försöka slå ihop tokenvärden,
- anta att R3 innehåller R2/R1,
- anta att O1 innehåller W1,
- använda O1 eller token-admin som fallback när en lägre klass saknar permission,
- hårdkoda credentialvärden.

En 403 från en lägre klass är en signal att permissionmappningen ska utvärderas, inte att koden automatiskt ska falla tillbaka till en bredare credential.

## Templatepolicy

Prioritetsordningen vid ny eller ändrad credentialklass är:

1. verifiera faktisk konsumentfunktion och API-endpoint,
2. kontrollera Cloudflares aktuella live-templatekatalog,
3. använd en standardtemplate som bas när den träffar klassen rimligt väl,
4. acceptera måttligt template-bundet permissionöverskott,
5. lägg till saknade permissions explicit,
6. skapa en ny klass endast när behovet utgör en egen funktionell och högre/lägre rang, inte för en enstaka permission.

Cloudflares live Token Summary är source of truth för templateinnehåll vid skapandet. Äldre dokumentation eller tidigare exporter används som referens men får inte överstyra live-state.

## Migration från äldre appunika tokens

Migration sker utan att ändra befintliga credentials först:

1. skapa de nya Account API Tokens med slutlig klass och slutligt namn,
2. skapa de centrala credentialvärdena i respektive godkänd secret store,
3. ge endast berörda konsumenter tillgång,
4. migrera en konsument i taget,
5. verifiera API-funktion, deployment/runtime och felvägar,
6. observera att den gamla credentialen inte längre används,
7. revokera först därefter den gamla tokenen.

**Roll** används inte som migreringsmekanism. Roll roterar secretvärdet för samma tokenobjekt och används först när en etablerad credential ska roteras utan att ändra dess permissionmodell.

Permissionsändring och credentialrotation ska behandlas som separata operationer.

## Verifiering

Varje klassändring följer tre steg:

### Före

- verifiera Cloudflare live-template och Token Summary,
- verifiera aktuell konsumentkod och endpoint,
- verifiera resource scope,
- verifiera var credentialen distribueras.

### Under

- verifiera den nya credentialen mot avsedd operation innan gammal credential tas bort,
- verifiera att konsumenten inte använder en högre klass som oavsiktlig fallback,
- verifiera att inga tokenvärden loggas eller skrivs till repository.

### Efter

- verifiera lyckade API-anrop/deployments,
- verifiera relevanta provider-health/capability checks,
- verifiera att gammal credential inte längre behövs,
- revokera överflödig credential först efter lyckad konsumentverifiering.

## Källor och current-state

Den här modellen bygger på:

- Cloudflares live Account API Token-dashboard och Token Summary verifierade 2026-09-19,
- aktuell permissionyta för Entire Account, all zones, specific zone, specific Workers och R2 buckets,
- Cloudflares live standardtemplates, inklusive Edit Cloudflare Workers och Edit Zone DNS,
- verifierad användning i Avkrokens aktuella repositorykod.

Cloudflares publika API-token-template-dokumentation är kompletterande källa. Om dokumentationen och live-dashboarden skiljer sig vinner live-dashboarden för faktisk tokenutgivning.
