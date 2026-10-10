# Slack-aviseringar för Avkroken/Avkroken

**Scope:** detta monorepo. [Ursprungligt ärende: #248](https://github.com/Avkroken/Avkroken/issues/248)
samordnar det bredare arbetet; fristående repositories äger sin egen konfiguration.
Det här dokumentet beskriver målpolicy och verifieringsförfarande, inte verifierad
Slack-installation eller aktuella prenumerationer.

## Kanalpolicy

| Kanal | Innehåll |
| --- | --- |
| `#avkroken-chan` | Beslut, status och sammanfattningar. GitHub Issues är primär arbetskö. |
| `#github-alerts` | Handlingsbara CI-fel, blockerade PR/reviews och kritiska säkerhets-/CodeRabbit-fynd, med länk till källan. |

Rutinmässiga commits, generella issue-/PR-händelser och lyckade byggen ska inte
skapa aviseringar i larmkanalen. Separata repo-kanaler införs endast vid behov.
Säkerhetsaviseringar ska inte kopiera känsliga fynd till Slack; länka till den
behörighetsskyddade källan när det behövs.

## Officiella GitHub-appens gränser

Enligt [GitHubs aviseringsdokumentation](https://docs.github.com/en/integrations/how-tos/slack/customize-notifications)
är `issues`, `pulls`, `commits`, `releases` och `deployments` aktiverade som standard
vid en vanlig repositoryprenumeration. `reviews`, `comments` och `workflows` är
separata val.

`workflows` aviserar när en körning startar och uppdaterar dess tråd när den
avslutas. Dokumenterade filter är `name`, `actor`, `branch` och `event` — inget
filter för enbart misslyckat resultat. Utan filter gäller dessutom körningar från
pull requests mot default-grenen; det är inte full CI-täckning.
Använd därför inte en bred `workflows`-prenumeration eller ett påhittat
`status:failure`-filter som lösning på lågbruskravet.

`reviews` betyder review-händelser, inte endast blockerande reviews.
`comments` betyder kommentarer, inte endast kritiska CodeRabbit-fynd.
En labelprenumeration bevisar inte heller att blockerande tillstånd upptäcks.
Den officiella appens dokumenterade prenumerationer räcker alltså inte som bevis
på hela larmkontraktet i #248.

## Kontroll och brusreducering i Slack

En operatör med rätt åtkomst utför följande i den avsedda Slack-kanalen.
Slash-kommandon måste köras som appkommandon; text skickad med `chat.postMessage`
utför dem inte.

1. Kontrollera att den officiella GitHub-appen är installerad, inbjuden till
   kanalen och auktoriserad för just `Avkroken/Avkroken`. Följ
   [GitHubs installationsguide](https://docs.github.com/en/integrations/how-tos/slack/integrate-github-with-slack).
   En synlig bot eller lyckad vanlig Slack-postning bevisar inte repositoryåtkomst.
2. Visa kanalens befintliga prenumerationer och filter:

   ```text
   /github subscribe list features
   ```

3. Spara resultatet som operativ evidens före ändring. Om repositoryt redan är
   prenumererat, stäng av breda händelser som bryter mot kanalpolicyn:

   ```text
   /github unsubscribe Avkroken/Avkroken issues pulls commits releases deployments reviews comments workflows branches discussions
   ```

   Kontrollera appens svar och kör listkommandot igen. Om appen avvisar något val,
   hantera det valet separat och verifiera slutresultatet. Om repositoryt inte
   finns i listan behövs ingen bred standardprenumeration bara för att stänga av
   den igen. Granska även eventuella separata avsändare som kan skapa dubbla larm.
4. Betrakta detta som **brusreducering**, inte som färdig larmleverans. Aktivera
   inte breda ersättningsprenumerationer för att fylla täckningsluckan. Återställ
   vid behov endast de tidigare dokumenterade valen; en generell
   `/github subscribe Avkroken/Avkroken` återaktiverar standardbrus.

## Återstående leveranskontrakt

En lösning för nedanstående behöver separat implementation eller verifierad
integrationskapacitet. Den här guiden skapar inga workflows eller Slack-sändare.
Providerobservationer ska följa monorepots befintliga arkitektur; Slack-arbetet
får inte ge observationsapparna nya write-behörigheter mot GitHub/Cloudflare.

| Signal | Krav före godkänd leverans |
| --- | --- |
| CI-fel | Resultatfiltrering; repository, körningslänk och PR-/commitidentitet; inga start- eller lyckad-körning-aviseringar. |
| Blockerad PR/review | Verifierat blockerande tillstånd med PR-länk; vanliga approvals eller kommentarer ska inte bli larm. |
| Kritiskt säkerhets-/CodeRabbit-fynd | Verifierad allvarlighetsgrad och källänk; generella kommentarer räcker inte. |
| Deduplicering | En logisk avisering per källhändelse och destination vid återleverans; en ny körning eller ett nytt fynd får inte tappas. |

Ny CI-konfiguration ska granskas i en separat PR länkad till #248. Befintliga
checks, obligatorisk review, branch protection och pågående PR-kö ska bevaras.
Slack är en aviseringsyta, inte en ny merge-/deploykontroll.

## Verifiering och evidens

Utför verifieringen efter att en godkänd leveransväg finns. Använd en verklig
GitHub-händelse i överenskommen test-/PR-scope utan att bryta `main`, kringgå
checks eller orsaka ett verkligt säkerhetsproblem för att skapa ett testlarm.

- Verifiera ett CI-fel från källa till `#github-alerts`: repository, körning,
  PR/commit och källänk ska gå att identifiera.
- Kontrollera separat blockerande review och ett representativt kritiskt fynd.
  Ett CI-larm bevisar inte dessa signalvägar.
- Verifiera att återleverans av samma källhändelse inte skapar ett andra larm,
  och att en ny relevant händelse fortfarande levereras.
- Kontrollera att en rutincommit och en lyckad körning inte skapar nya larm.
  Ange observationsperiod; frånvaro av en notis är inte bevis på fungerande
  filtrering om själva integrationen saknar åtkomst.
- Dokumentera källänk/händelse-ID, tidpunkt, förväntat och faktiskt resultat,
  Slack-permalänk för positiva test och eventuellt hinder i arbetsärendet när
  operatören har tillstånd att uppdatera det. Spara inte tokens eller råa privata
  payloads i repositoryt. Live-state ska inte underhållas som fakta här.

Markera inte konfigurationen klar innan både positiv leverans och brus-/dubblett-
kontroller är verifierade. Saknad Slack-åtkomst, appauktorisering eller
resultatfiltrerad leverans ska redovisas som återstående hinder.

## Övriga botar

Inventera appidentitet, kanalåtkomst och syfte i Slack innan en bot ges en roll.
Botnärvaro innebär inte att en integration är konfigurerad. En eventuell
Copilot-utvärdering hålls separat från larmverifieringen: kontrollera först
behörigheter och kvotmodell, och starta inte reviews eller agentuppgifter som
förbrukar kvot som ett passivt anslutningstest. Ge inga obevakade merge- eller
deployrättigheter.
