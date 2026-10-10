# Lokal utveckling med Codespaces

Denna baseline gäller endast `Avkroken/Avkroken`. Codespaces är en tillfällig
utvecklingsmiljö; Cloudflare äger apparnas runtime. Migreringsprogrammet följs i
[issue #250](https://github.com/Avkroken/Avkroken/issues/250).

## Start och verktyg

Läs rootens `AGENTS.md` och den berörda appens `AGENTS.md` och
`docs/project-context.md` först. Välj arbetsgrenen i GitHub och öppna **Code →
Codespaces → New with options**. Kontrollera betalande konto, tillgänglig kvot,
maskinstorlek och budget före skapandet. Välj repositoryts devcontainer.

`.devcontainer/devcontainer.json` använder Node 24 med npm och Corepack samt
GitHub CLI. `postCreateCommand` aktiverar enbart Corepack och hämtar pnpm 10.17.1,
samma version som Jobbs `packageManager` och CI. Den installerar inga
appberoenden, startar inga appar och utför ingen provisionering, migration
eller deployment. Corepacks automatiska skapande av `packageManager`-fält är
avstängt så att npm-apparna behåller sina egna paketkontrakt.

Kontrollera terminalen efter att skapandet slutförts:

```bash
node --version       # v24.x
npm --version
corepack --version
pnpm --version       # 10.17.1
gh --version
git status --short
```

Samma konfiguration kan öppnas lokalt med VS Codes **Dev Containers: Reopen in
Container** och en fungerande Docker-installation. Image-/feature-taggar följer
uppdateringar inom sina angivna versioner; anteckna därför även de faktiska
verktygsversionerna vid boot-verifiering.

## Selektiv installation och verifiering

Kör endast den app som ändras. Kommandona nedan utgår från repositoryroten och
använder subshell så att nästa block också kan köras därifrån. Apparnas egna
scripts och `.github/workflows/ci.yml` är canonical för den fullständiga gaten.

Portal:

```bash
(
  cd apps/portal
  npm ci --ignore-scripts --no-audit --no-fund
  npm test
  npx --no-install wrangler deploy --dry-run --config wrangler.jsonc
)
```

Portalens fullständiga CI kör även `npm run test:browser` med Google Chrome och
ChromeDriver. Dessa ingår inte i den minimala containern; browsergaten måste
fortfarande passera i ordinarie CI.

Skvallerbyttan, Spam filter och Dumpen: välj en app i taget och kör dess `check`,
som inkluderar appens tester och Worker dry-run (samt typecheck där tillämpligt).

```bash
(
  cd apps/skvallerbyttan # alternativ: apps/spam-filter eller apps/dumpen
  npm ci --ignore-scripts --no-audit --no-fund
  npm run check
)
```

Ingest och Events delar Skvallerbyttans låsta TypeScript-toolchain och har ännu
ingen deploybar Wrangler-konfiguration. Kör tester/typecheck, ingen deploy:

```bash
(cd apps/skvallerbyttan && npm ci --ignore-scripts --no-audit --no-fund)
apps/skvallerbyttan/node_modules/.bin/tsx --test apps/ingest/test/*.test.ts
apps/skvallerbyttan/node_modules/.bin/tsc --noEmit -p apps/ingest/tsconfig.json
apps/skvallerbyttan/node_modules/.bin/tsx --test apps/events/test/*.test.ts
apps/skvallerbyttan/node_modules/.bin/tsc --noEmit -p apps/events/tsconfig.json
```

Jobb har en separat pnpm-workspace:

```bash
(
  cd apps/jobb
  pnpm install --frozen-lockfile
  pnpm typecheck
  pnpm test
  pnpm --filter @avkroken/web exec wrangler deploy --dry-run --config ../../wrangler.jsonc
)
```

Dry-run bygger och validerar konfigurationen utan Worker-deployment. Kör inte
`deploy`, `deploy:workers-builds`, remote migrationer eller asset-sync som lokal
verifiering. CI, reviewer-gates och apparnas befintliga Workers Builds-flöden
behålls; en godkänd lokal körning ersätter inte dem.

## Lokal server och portar

Efter installation kan exempelvis Portal startas med lokal Wrangler-runtime:

```bash
(cd apps/portal && npx --no-install wrangler dev --local --ip 0.0.0.0 --port 8787)
```

För Skvallerbyttan, Spam filter och Dumpen kan samma Wrangler-kommando köras i
respektive appkatalog. Jobbs konfiguration ligger två nivåer ovanför webpaketet:

```bash
(cd apps/jobb && pnpm --filter @avkroken/web exec wrangler dev --local --config ../../wrangler.jsonc --ip 0.0.0.0 --port 8787)
```

Kör en Worker åt gången på 8787 eller välj en annan port manuellt. Öppna den via
**Ports** och behåll synligheten **Private**. 8787 är enda deklarerade forward;
automatisk upptäckt av andra portar är avstängd. Konfigurationen publicerar inte
någon port och ändrar inte GitHubs portpolicy.

Lokal emulering ger inte automatiskt OAuth, Service Bindings, Browser Run,
Email Routing, Workers AI eller en komplett providersession. Vissa bindingar
kräver separat lokal konfiguration och autentiserade vyer kan därför saknas.
Följ appens drift-/säkerhetsdokumentation; använd tests/mockar när integrationen
inte finns lokalt. Koppla inte utvecklingsmiljön till production för att få en
lokal smoke-test att fungera. Använd inga production-secrets för denna baseline,
och kontrollera `git check-ignore` innan lokala credentialfiler skapas.

## Kostnad, stopp och säker radering

- Kontrollera aktuell förbrukning och budget i det betalande kontots GitHub
  billing-vy. Kvot och pris beror på konto och maskin; dokumentet antar ingen
  kostnadsfri kapacitet.
- Sätt en kort idle-timeout, exempelvis 30 minuter, i personliga
  **Settings → Codespaces**, inom kontots tillåtna policy. Kontrollera även
  retention. Detta är kontoinställningar, inte värden som devcontainern ändrar.
- Stoppa miljön via **Codespaces: Stop Current Codespace** eller Codespaces-listan
  när arbetet är klart. Att stänga en webbläsarflik är inte en säker stoppsignal.
  Stoppade miljöer kan fortfarande medföra lagringskostnad.
- Före **Delete**: granska `git status --short`, committa och pusha avsedd kod till
  arbetsgrenen, och kontrollera att commiten finns på GitHub. Ta separat hand om
  nödvändiga, icke-versionshanterade filer utan att publicera secrets. Radering
  förlorar lokala filer, installerade beroenden och emulerad state.
- Radera därefter den avsedda miljön i Codespaces-listan och verifiera att den är
  borta. En Codespace ska aldrig vara scheduler eller permanent 24/7-runtime.

## Boot-evidens före acceptans

En lokal testkörning eller JSON-validering bevisar inte ett faktiskt Codespace-boot.
Verifiera en ny Codespace på PR:ens exakta commit när konto/budget/åtkomst är
bekräftade. Anteckna i PR:en:

1. commit-SHA (`git rev-parse HEAD`), datum och genomförd container-/post-create-start;
2. faktiska versioner från startkontrollen ovan;
3. selektiv app-test och dry-run med exitstatus, samt att port 8787 är Private;
4. länk till GitHub Actions-körningen på samma SHA och kvarvarande begränsningar;
5. att testmiljön stoppats/raderats efter att avsett arbete säkrats.

Markera boot-verifiering som återstående tills detta är genomfört. Baseline-PR:en
stänger inte migreringsprogrammet eller verifierar VM-avveckling, Projects eller
Cloudflare-cutover.
