# VM/RDC: verifiering före avveckling

Detta är monorepots verifieringsprocedur för [ursprungsärende #254](https://github.com/Avkroken/Avkroken/issues/254), inom [program #250](https://github.com/Avkroken/Avkroken/issues/250). Dokumentet är en procedur och protokollmall, **inte bevis på genomförd inventering, migration eller godkänd avveckling**.

Monorepots appar äger sina tekniska driftkontrakt i respektive `apps/*/docs/`. Fristående repositories äger sina egna driftinstruktioner. Produkter är en extern beroendekontroll i ärendet; dess fetcher-konfiguration och eventuell flytt ska dokumenteras i det ägande repositoryt, inte här.

## Gräns och evidens

- Repositoryarbete ger inget tillstånd att stoppa en host, ändra DNS, flytta produktionsjobb, rotera credentials eller radera data. Sådana åtgärder kräver separat driftbeslut för en namngiven miljö och ett tidsfönster.
- Ingen automatisk shutdown, deployment eller migration ingår i denna procedurs repositoryändring. Behåll befintliga app-checks och canonical deployvägar.
- Begränsad inspektion utan egna TCP-lyssnare utesluter inte utgående jobb, cron, timers, containers eller databeroenden.
- Använd `pending`, `blocked`, `pass`, `fail` eller `not_applicable` per kontroll. `pass` kräver tidsstämplad evidens; `not_applicable` kräver motivering och ansvarig. Saknad åtkomst, tomma loggar eller saknad trafik är aldrig `pass`.
- För varje observation: ange UTC-tid, operatör, miljö, kontrollerad resurs, metod, täckning och evidensreferens. Färska observationer krävs efter ändrad host, image, konfiguration eller deployment.
- Lägg endast en sanerad sammanfattning i det publika ärendet. Privata host-ID:n, sökvägar, backupadresser och råloggar stannar i godkänd skyddad lagring; använd opaka referenser i det publika protokollet.
- Dokumentera secrets **platser och ansvar**, aldrig värden. Publicera inte kompletta miljöer, `docker inspect`, Compose-rendering, processargument, crontabs eller servicefiler: de kan innehålla credentials. Granska lokalt och sammanfatta endast nödvändig metadata. Ingen rå insamling som Actions-artifact.

## 1. Identifiera fetcher och fullständig VM-täckning

Ärendets uppgift om en Linux/Docker/Playwright-fetcher är en undersökningspunkt, inte verifierad runtime-state. Hämta aktuellt kontrakt och verifiering från Produkters ansvariga via separat auktoriserad åtkomst. Saknas den åtkomsten är beroendekontrollen `blocked`.

1. Knyt den aktiva `produkter-fetcher`-instansen till en stabil provider-/hostidentitet, med observationstid. Jämför den med VM:n som föreslås avvecklas; ett containernamn eller image-repository räcker inte som hostbevis. Redovisa samtliga aktiva instanser om flera finns.
2. Verifiera containerstatus, image-digest, starttid, restart count/policy, scheduler/supervisor och beständiga volymer. En running-container bevisar inte att jobb lyckas.
3. Korrelera ett verkligt lyckat jobb mellan fetcherns lease, render/resultat och Engine-systemets accepterade slutstatus enligt Produkters eget kontrakt. Ange sanerad korrelationsreferens, start/sluttid och resultat; en tom kö eller lyckad HTTP-hälsokontroll räcker inte.
4. Bekräfta om samma host levererar andra jobb eller data. Om hostrelationen inte kan avgöras ska den förbli `blocked` inför permanent avveckling.

Inventeringen ska täcka alla VM-konton, även servicekonton och användare utan aktiv inloggning. Registrera vilka konton och scopes som faktiskt kontrollerats; otillgängliga user-managers eller behörighetsfel är luckor, inte negativa fynd.

| Yta | Minsta kontroll och evidens |
| --- | --- |
| Schemaläggning | Varje användares crontab; system-crontab, cron-kataloger och anacron; system- och user-timers inklusive inaktiva/enabled timers, linger och nästa/senaste körning; engångsjobb där tillämpligt |
| Tjänster och containers | System-/user-services, enabled/inaktiva units, socket/path activation, RDC-agent, Docker/Compose och andra supervisors; ägare, restartbeteende och utgående beroenden |
| Filsystem och data | Mounts/fstab, nätverksdiskar, containervolym/bind mount, lokala databaser, köer, spool, arbetskataloger och ej versionsstyrd konfiguration; datans ägare och återställningsbehov |
| Åtkomst | Secrets- och SSH-nycklars platser, ägare, rättigheter och återprovisioneringsmetod; inga värden eller nyckelmaterial |
| Externa beroenden | DNS, webhookleveranser, externa schemaläggare, self-hosted runners, utgående API-anrop och allowlists; vem anropar VM:n och vad VM:n anropar |
| Backup | Omfattning, senaste lyckade körning, extern destination, kryptering, retention, kostnad, åtkomst utan VM:n och senaste verifierade restore |

Skapa en rad per jobb, tjänst och dataresurs i det skyddade protokollet:

| Resursreferens | Ägare | Källa/trigger/intervall | Runtime och beroenden | Data/secrets-platser | Behövs efter RDC? | Ersättning/åtgärd | Verifieringsreferens/status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Fylls vid inventering | Ej tilldelad | Ej verifierat | Ej verifierat | Endast skyddad referens | Ej avgjort | Ej beslutad | pending |

## 2. Besluta ersättning per nödvändigt jobb

Varje nödvändig rad ska få en namngiven ägare, destination, schema, runtimekrav, secrets-provisionering, dataflytt, verifiering och rollback. Jobb som inte längre behövs kräver ett uttryckligt beslut med motivering; frånvaro i en första inspektion räcker inte.

| Kandidat | Villkor att verifiera före val |
| --- | --- |
| GitHub Actions | Avgränsat jobb vars körtid, schemaläggning, nätverk, kostnad och behörigheter ryms i gällande kontrakt; ingen förväntan på permanent process eller exakt cron-tid |
| Cloudflare Cron/Workflows/Queues | Appens befintliga runtime-/limit-kontrakt stöder jobbet, dess state och felhantering; dokumentera retries, idempotens och observability |
| Separat container-runtime | Browser-/OS-krav eller långlivad lease-konsumtion kräver detta; verifiera image, resurser, volymer, nätverk, restart och driftägare |

Codespaces är inte en permanent jobbhost. Flytta inte browserjobb till Workers enbart på grund av plattformsnamnet. Bevara en canonical deployväg per app; skapa inte parallell Actions-/Workers Builds-deploy. Ändra inte monorepots read-only observationsintegrationer till provider-write.

Planera cutover så att gammal och ny scheduler inte orsakar dubbla side effects. Hantera pågående leases, köer och osäkra resultat enligt respektive apps kontrakt. Kör och verifiera ersättningen innan den gamla instansen tas bort. En repository-PR är inte bevis på lyckad cutover.

## 3. Bevisa backup, restore och rollback

Före offline-övningen ska ansvarig kunna återställa utan åtkomst till den VM som stoppas. En snapshot på samma borttagbara disk eller en checksumma utan restore-test räcker inte.

| Omfattning | Krav på verifiering |
| --- | --- |
| VM och lokal data | Konsekvent backup av nödvändiga volymer, data och konfiguration; extern krypterad kopia; backup-ID/tid, integritetskontroll, retention och ägare |
| GitHub | Versionerade refs/workflows samt separat inventering av relevant live-konfiguration: environments, variables, secret-namn, rulesets, Apps, webhooks och deploykopplingar. Git-klonen ensam är inte administrativ backup |
| Cloudflare | Relevanta Worker-versioner, bindings, triggers/routes, D1-schema/data, R2-data och Queue-konfiguration. Dokumentera faktisk backup/export/retention och hur kömeddelanden hanteras; anta inte att in-flight-meddelanden kan exporteras eller spelas om säkert |
| Secrets | Återprovisioneringskälla och åtkomst verifierad separat. GitHub-/Cloudflare-secretvärden kan inte antas vara exporterbara. Spara inga hemligheter i publikt protokoll |
| Restore-test | Återställ representativ data och nödvändig konfiguration i isolerad miljö utan produktionsrutter, consumers eller scheman. Kontrollera integritet och appfunktion; anteckna observerad återställningstid och möjlig dataförlust mot beslutade RTO/RPO |
| Rollback | Verifierad konsol-/startåtkomst oberoende av RDC och VM:n, rätt ansvarig, bevarade diskar och tidigare version/config; dokumentera hur dubbla schedulers undviks och osäkra jobb hanteras vid återstart |

Publicera bara sanerade restore-resultat och referenser. Backupfiler, credentials och privata driftinstruktioner hör inte hemma i repositoryt. Misslyckad eller oprövad restore blockerar godkännande.

## 4. Kontrollerad offline-övning

Detta steg utförs först inom ett separat godkänt driftfönster av ansvarig operatör. Även en tillfällig övning kräver fungerande återstart; permanent radering ingår aldrig i övningen.

1. Dokumentera omfattning, start/slut, ansvarig, återstartsväg, incidentkontakt, RTO/RPO och avbrottströsklar. Bekräfta backup/restore och besluta hur varje identifierat beroende ska observeras. Okända beroenden gör övningen explorativ; den kan inte ensam ge grönt avvecklingsbeslut.
2. Samla en färsk baseline medan VM:n är online. Ange vilka appar, resurser, jobb och scheman som ingår och vilka som saknar täckning. Välj befintliga appägda funktionstest och säkra testdata; skrivande tester kräver eget godkännande.
3. Operatören stoppar VM:n reversibelt enligt godkänt driftförfarande. Behåll disk, snapshot och oberoende startåtkomst. Logga stopptid och bekräfta offline-state via providern.
4. Kör motsvarande funktionstest under offline-perioden och jämför med baseline. Observationstiden måste omfatta relevanta schemaintervall, maximal jobbtid och retry/lease-fönster. Sällsynta jobb kräver säker separat verifiering eller fortsatt `pending`.
5. Avbryt vid misslyckat funktionstest, uteblivet förväntat jobb, växande kö/retries, dataintegritetsfel eller förlorad återstartsförmåga. Återstarta enligt rollbackplan; hantera nya schedulers och leases före återupptagna jobb så att side effects inte dubbleras.
6. Protokollför återstart och återhämtningskontroller efter övningen, även om offline-testen gick bra. Bekräfta att backlog hanterats och att jobb inte tappats eller duplicerats. Behåll varje misslyckande som evidens och gör om berörd kontroll efter korrigering.

| Funktion | Bevis under baseline, offline och efter återstart |
| --- | --- |
| Workers | Faktiskt appflöde med förväntat resultat och deployment/version; en grön startsida bevisar inte hela beroendekedjan |
| D1 | Appens relevanta läsning och, där separat godkänt, kontrollerat skriv/läs-test; rätt databas/binding och integritet. Read-only test ger inte write-täckning |
| Queues | Korrelerat meddelande från producent till consumer och avslutat appresultat; backlog, retries och dead-letter-status, inte enbart HTTP-acceptans |
| Produkter | Nytt verkligt lease/render/resultat-jobb från verifierad fetcher-host under VM-offline, med accepterad slutstatus och sanerad evidens från ansvarigt repository |
| Återkommande jobb | Förväntad körning/resultat för varje nödvändig inventerad rad; även externa schemaläggare och backupjobb |

Inventera faktisk providerstate före testvalet. Om en yta saknas används `not_applicable` med verifierad motivering; proceduren får inte provisionera en ny runtime bara för att fylla en tabell.

## 5. Protokoll och beslut

Kopiera mallen till godkänd evidensyta vid faktisk körning. Publika ärenden får endast sanerad sammanfattning. Alla rader börjar som ej verifierade; dokumentets existens eller en mergad PR ändrar inte status.

| Kontroll | Status | UTC/ansvarig | Sanerad evidensreferens och täckning | Lucka/nästa åtgärd |
| --- | --- | --- | --- | --- |
| Fetcher-host, container och lyckat jobb | pending | Ej utfört | Saknas | Verifiera via ansvarig |
| Full VM-inventering inklusive alla konton | pending | Ej utfört | Saknas | Inventera |
| Ersättning för varje nödvändigt jobb | pending | Ej utfört | Saknas | Besluta och verifiera |
| Backup, isolerad restore och rollback | pending | Ej utfört | Saknas | Återställningstest |
| Baseline och offline-funktionstest | pending | Ej utfört | Saknas | Godkänt driftfönster |
| Återstart och återhämtning | pending | Ej utfört | Saknas | Verifiera rollback |
| Separat beslut om permanent avveckling | pending | Ej beslutat | Saknas | Ansvarigs godkännande |

Permanent avveckling är blockerad så länge någon nödvändig kontroll är `pending`, `blocked` eller `fail`, eller evidensen saknar täckning. Godkännande kräver grön verifiering, dokumenterad rollback, fastställd backupretention och ett separat tidsstämplat beslut från ansvarig. Länka konkreta drift-/kod-PR:er med `Refs #250` och `Refs #254`; använd inte automatisk issue-stängning. Ärendena förblir öppna tills verklig driftsverifiering är genomförd.
