# Verifiering inför RDC-/VM-avveckling

Detta är en publik checklista och protokollmall för repositoryts
[arbetsissue #254](https://github.com/Avkroken/Avkroken/issues/254), inom
[program #250](https://github.com/Avkroken/Avkroken/issues/250).
Den beskriver vilken evidens som behövs, inte verifierad driftstatus eller ett
godkännande att ändra produktion. En merge av dokumentet uppfyller inte issuets
operativa acceptanskriterier.

Apparnas egna driftkontrakt gäller. Fristående repositories, inklusive Produkter,
äger sin tekniska dokumentation och sina eventuella migrationsändringar. Här
samlas endast kontrollpunkter för avvecklingsbeslutet; kopiera inte deras
current-state till monorepots delade dokumentation.

## Utgångsläge och evidensgräns

Issue #254 rapporterar en begränsad VM-inspektion och en möjlig extern
Docker/Playwright-fetcher för Produkter. Det är underlag att undersöka, inte bevis
på aktuell host, komplett beroendetäckning eller lyckade produktionsjobb.
Avsaknad av TCP-lyssnare utesluter inte utgående jobb, cron eller kökonsumenter.

Alla kontroller nedan börjar som `ej verifierad`. Använd `godkänd`, `underkänd`,
`blockerad` eller `ej tillämplig` först med daterad evidens respektive motivering.
Saknad åtkomst och tomma resultat räknas aldrig som godkända kontroller. Är VM:n
redan stoppad är hostinventeringen blockerad tills auktoriserad återstart finns.

## Evidens utan känsligt innehåll

- Ange UTC-tid, ansvarig operatör, miljö, relevant commit/image-digest, kontroll,
  förväntat resultat, observerat resultat och evidensreferens för varje rad.
- Behåll råa loggar, konfigurationsexporter, backup och hostinventering i godkänd
  skyddad lagring. Publicera endast manuellt granskade, sanerade sammanfattningar.
- Registrera secrets **platser och ägarskap**, aldrig värden. Även host-ID,
  filvägar, webhookadresser och backupreferenser kan behöva ersättas med alias i
  publika protokoll; den skyddade evidensen ska kunna koppla alias till resurs.
- Publicera inte rå `docker inspect`, processargument, miljövariabler, cronrader,
  unit-filer eller journalutdrag: de kan innehålla credentials och privata data.
  En lyckad kontroll ska kunna styrkas utan dessa payloads i Git eller PR.

## 1. Inventera beroenden före någon avstängning

För varje post: dokumentera ägare, källa, schema/tidszon, senaste lyckade körning,
indata/utdata, beroenden, stateplacering och konsekvens av att VM:n försvinner.
Markera varje kategori uttryckligen även när verifierad inventering hittar noll.

| Område | Täckning som måste verifieras |
| --- | --- |
| Schemaläggning | Alla användares crontab, system-cron och periodiska kataloger, anacron, system- och user-timers, inklusive linger/användare utan aktiv session |
| Runtime | System- och user-tjänster, container-runtime, körande och stoppade containrar, restart-policy, manuellt startade processer och RDC-agentens beroenden |
| Data | Mounts, externa filsystem, volymer, lokala databaser, arbetskataloger, beständiga filer, ägare och retention; skilj cache från oersättlig data |
| Åtkomst | Secretlagringens platser, servicekonton, SSH-nycklars användning och återställningsägare; inga credentialvärden |
| Externt | DNS, webhookavsändare/-mottagare, externa schemaläggare, utgående API-anrop, kökonsumenter och eventuella self-hosted Actions-runners |
| Backup | Vad som faktiskt säkerhetskopieras, senaste lyckade backup, lagringsplats utanför VM:n, åtkomst, retention och återläsning |

En lista över aktiva tjänster räcker inte: även sällan körda jobb och stoppade
containrar kan vara nödvändiga. Stäm av inventeringen med ansvariga ägare och
externa scheman; registrera luckor som blockerare.

## 2. Fastställ Produkter-fetcherns host och jobbresultat

Utförs av Produkters driftägare mot dess aktuella repo- och runtimekontrakt.
Anta inte att fetchern kör på RDC-VM:n eller att en frisk Worker bevisar att
renderjobben fungerar.

1. Korrelera produktionsdeploymentens runtime-/hostidentitet med containerstatus,
   image-digest, starttid och restart-/hälsostatus. Dokumentera uttryckligen om
   hosten är samma VM, en annan verifierad host eller fortfarande okänd.
2. Följ ett verkligt, auktoriserat jobb genom lease, fetch/render och accepterat
   resultat. Använd ett sanerat korrelations-ID och UTC-tider för att koppla
   containerns körning till Engine-resultatet; en startad container räcker inte.
3. Kontrollera köålder/backlog, misslyckanden och retries före och efter jobbet.
   Redovisa om jobbet startades manuellt eller av ordinarie schema.
4. Upprepa jobbkontrollen under offline-övningen. Om hosten är VM:n måste en
   nödvändig fetcher först flyttas och verifieras genom separat godkänd ändring.
   Okänd host eller uteblivet resultat blockerar permanent avveckling.

## 3. Besluta om varje återkommande jobb

| Möjlig målmiljö | Villkor att verifiera före separat migrations-PR |
| --- | --- |
| GitHub Actions | Avgränsat jobb; verifierade runner-/OS-behov, schemaläggning, exekveringstid, concurrency, credentials och beständig lagring utanför runnern |
| Cloudflare Cron/Workflows/Queues | Jobbet passar tjänstens aktuella runtime-/resursgränser; verifierade retries, idempotens, bindings och stateägande |
| Särskild container-runtime | Kontinuerlig konsument eller browser-/OS-krav kräver host; verifierad övervakning, restart, patchning, nätverk och backup |
| Avsluta jobbet | Ägaren har styrkt att inga konsumenter eller kvarvarande data kräver jobbet och uttryckligen godkänt avslut |

För varje jobb behövs beslutad destination, ansvarig, migrations-PR, verifierat
testresultat och rollback. Codespaces är inte permanent runtime. Skapa inte en
andra deployväg bredvid befintlig Actions-/Workers Builds-ägare. Undvik dubbla
konsumenter och scheman under flytt; dokumentera lease/idempotens och hur gamla
och nya körningar avgränsas innan en separat godkänd cutover.

## 4. Verifiera backup, restore och återstart

Före offline-övning ska operatören kunna visa:

- En daterad backupmanifest med omfattning, integritetskontroll, retention,
  lagringskostnad, ansvarig och åtkomst som fungerar när VM:n är avstängd.
- Lyckad återläsning i isolerad miljö, med kontrollerat innehåll och uppmätt
  återställningstid; ett lyckat backupjobb eller en snapshot räcker inte.
- GitHub-konfiguration där tillämpligt: workflows/versioner samt extern
  administrativ konfiguration och deploymentkopplingar. En Git-klon bevarar
  inte all provider-state. Secrets återskapas via godkänd säker källa.
- Cloudflare-konfiguration/data där tillämpligt: Worker-versioner, bindings,
  routes, scheman, D1 och övrig beständig lagring. Dokumentera faktisk restore-
  respektive replaystrategi för köjobb, inklusive förlust-/dubblettrisk.
- Godkänd tolerans för dataförlust (RPO) och återställningstid (RTO), en namngiven
  rollbackansvarig och en verifierad start-/konsolväg som inte kräver RDC på VM:n.

En restoreövning får inte skriva över produktion. Kontrollera separat vilka
resurser som behöver export/backup och vilka som kan återskapas från versionerad
konfiguration; markera ej tillämpliga delar med evidens och motivering.

## 5. Kontrollerad offline-övning

Detta dokument och dess PR utför ingen avstängning, deploy eller dataändring.
En behörig operatör behöver ett separat godkänt övningsfönster, testomfång,
återstartsplan och rollbacktrösklar innan någon runtime ändras.

1. Sätt baslinje för varje berörd funktion med VM:n online. Ange förväntat
   resultat, högsta tillåtna fel-/köålder och tidsgräns för återställning.
2. Välj observationstid som täcker inventerade scheman, köfördröjningar och
   retries. Jobb som inte hinns med måste provas kontrollerat eller förbli
   `ej verifierad`; en kort tyst period bevisar inte oberoende.
3. Bekräfta backup-/restorebevis och oberoende konsolåtkomst. Operatören stoppar
   VM:n reversibelt, utan radering av disk, backup eller återstartsmöjlighet.
4. Kör nedanstående matris under stoppet. Använd godkända testdata och appens
   befintliga driftväg; inför inga nya publika health-endpoints eller provider-
   writes i observationsapparna för övningen.
5. Vid misslyckat/saknat resultat eller passerad rollbacktröskel: avbryt,
   återstarta via verifierad väg, kontrollera beroendeordning och reconcila
   pågående leases/köjobb utan dubbelbehandling. Dokumentera avvikelsen.
6. Prova och dokumentera återstart och återhämtning även vid grön offlinefas.
   Jämför samma funktioner mot baslinjen och följ upp eventuellt backlog.

| Funktion | Baslinje, offline och efter återstart ska visa |
| --- | --- |
| Workers | Appspecifik funktion lyckas via befintlig accessväg med förväntat resultat; enbart HTTP-status räcker inte |
| D1 | Förväntad data kan läsas; där funktionen kräver skrivning används separat godkänt, isolerat funktionstest med verifierad persistens och städning |
| Queues | Auktoriserat testmeddelande kan följas till konsument och förväntat utfall; köålder, retries och dead-letter-status observeras |
| Produkter | Verkligt jobb lyckas enligt host-/jobbkedjan ovan, med verifierat Engine-resultat |
| Övriga VM-jobb | Varje inventerat nödvändigt jobb har ett verifierat resultat från beslutad ersättning |

## Protokoll och beslut

Kopiera mallen till godkänd evidensyta. Länka endast en sanerad sammanfattning i
arbetsissuet efter faktisk driftverifiering; lägg inte rå driftdata i repositoryt.

| Kontroll | Status | UTC / ansvarig | Förväntat → observerat | Sanerad evidensreferens / blockerare |
| --- | --- | --- | --- | --- |
| Fullständig beroendeinventering | ej verifierad | — | — | — |
| Fetcher-host och lyckat jobb | ej verifierad | — | — | — |
| Destination och test för alla nödvändiga jobb | ej verifierad | — | — | — |
| Backup och isolerad restore, RPO/RTO | ej verifierad | — | — | — |
| GitHub-/Cloudflare-konfiguration och återställning | ej verifierad | — | — | — |
| Godkänt övningsfönster och rollbacktrösklar | ej verifierad | — | — | — |
| Funktionsmatris: online / offline / återstart | ej verifierad | — | — | — |
| Återstart, återhämtning och backlog | ej verifierad | — | — | — |
| Slutlig granskning och avvecklingsbeslut | ej verifierad | — | — | — |

Permanent avveckling är blockerad tills alla nödvändiga kontroller är godkända,
luckor är hanterade och ansvarig ägare uttryckligen har godkänt beslutet med
daterad evidens och dokumenterad rollback. Dokumentations-PR, grön CI eller
tillfällig offlineframgång är inte i sig det godkännandet. Issues #254 och #250
hålls öppna genom den verkliga driftsverifieringen; använd `Refs` i relaterade PR:er.
