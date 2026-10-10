# Codespaces — lokal utveckling i monorepot

[Devcontainer-konfigurationen](../../.devcontainer/devcontainer.json) ger en
Debian Bookworm-miljö med Node 24, npm, pnpm 10.17.1 och GitHub CLI. Node 24
innehåller även Corepack; Jobbs `packageManager` är fortsatt `pnpm@10.17.1`.
Miljön är tillfällig utvecklingskapacitet. Cloudflare äger applikationernas runtime.

## Start och verktyg

1. Kontrollera kontots aktuella Codespaces-kvot, budget, maskinstorlek och
   retention innan en miljö skapas. Priser och tillgänglighet är GitHub-state.
2. Välj avsedd arbetsgren i **Code → Codespaces → New with options** och öppna
   miljön. Följ rootens [arbetsregler](../../AGENTS.md) för arbetskön och grenar.
   Befintliga miljöer behöver **Rebuild Container** efter konfigurationsändring.
3. Kontrollera verktygen i terminalen:

   ```bash
   node --version       # v24.x
   npm --version
   pnpm --version       # 10.17.1
   corepack --version
   gh --version
   git rev-parse HEAD
   ```

Konfigurationen har inga lifecycle-kommandon: den installerar inte appberoenden,
startar inte Workers och provisionerar, migrerar eller deployar ingen produktion.
Välj själv appens installation nedan. Inga credentials är inbakade eller begärda
av devcontainer-konfigurationen. Codespaces kan tillföra användar-/repo-secrets
via kontoinställningar; granska dessa separat och skriv aldrig ut deras värden.

## Selektiv verifiering

Kör varje block från repositoryroten. Läs först appens `AGENTS.md` och
`docs/project-context.md`. Kommandona följer [appgaterna i CI](../../.github/workflows/ci.yml).
Apparnas egna paketfiler och driftdokumentation är canonical vid förändringar.

### Portal

```bash
(cd apps/portal && npm install --ignore-scripts --no-audit --no-fund && npm test && npx wrangler deploy --dry-run --config wrangler.jsonc)
```

Portalens fulla gate innehåller också `npm run test:browser` i `apps/portal`.
Den kräver Chrome och matchande ChromeDriver i PATH; de ingår inte i denna
minimala container. Kör den i befintlig CI eller installera verktygen separat
innan lokal browserverifiering. Node-tester och dry-run ersätter inte browsergaten.
Se [Portal drift](../../apps/portal/docs/operations.md).

### Skvallerbyttan, Dumpen och Spam filter

Kör blocket för den app som ändras; `check` inkluderar Worker dry-run.

```bash
(cd apps/skvallerbyttan && npm ci --ignore-scripts --no-audit --no-fund && npm run check)
(cd apps/dumpen && npm ci --ignore-scripts --no-audit --no-fund && npm run check)
(cd apps/spam-filter && npm ci --ignore-scripts --no-audit --no-fund && npm run check)
```

Appkontrakt: [Skvallerbyttan](../../apps/skvallerbyttan/docs/operations.md),
[Dumpen](../../apps/dumpen/docs/operations.md),
[Spam filter](../../apps/spam-filter/docs/project-context.md).

### Ingest och Events

Dessa appar är deploy-neutrala och saknar egen Wrangler-konfiguration.
Installera den låsta delade testtoolchainen en gång:

```bash
(cd apps/skvallerbyttan && npm ci --ignore-scripts --no-audit --no-fund)
```

Kör sedan relevant app:

```bash
apps/skvallerbyttan/node_modules/.bin/tsx --test apps/ingest/test/*.test.ts
apps/skvallerbyttan/node_modules/.bin/tsc --noEmit -p apps/ingest/tsconfig.json

apps/skvallerbyttan/node_modules/.bin/tsx --test apps/events/test/*.test.ts
apps/skvallerbyttan/node_modules/.bin/tsc --noEmit -p apps/events/tsconfig.json
```

Ingen Worker dry-run finns för dessa appar. Se [Ingest](../../apps/ingest/README.md)
och [Events](../../apps/events/README.md) för bootstrap- och cutovergränser.

### Jobb

```bash
(cd apps/jobb && pnpm install --frozen-lockfile && pnpm typecheck && pnpm test && pnpm --filter @avkroken/web exec wrangler deploy --dry-run --config ../../wrangler.jsonc)
```

Node-feature installerar den valda pnpm-versionen. Om Corepack används på en
annan utvecklingsvärd motsvarar CI:s setup `corepack enable` följt av
`corepack prepare pnpm@10.17.1 --activate`. Ändra inte Jobbs `packageManager`
eller lockfil som workaround för saknade verktyg.
Se [Jobb drift](../../apps/jobb/docs/operations.md).

## Lokal Worker och portar

Efter appinstallationen kan till exempel Portal köras lokalt:

```bash
(cd apps/portal && npx wrangler dev --local --ip 0.0.0.0 --port 8787)
```

Konfigurationen vidarebefordrar port 8787 och notifierar när den är tillgänglig.
Behåll portens synlighet **Private** i Codespaces **Ports**-flik. Kör en Worker
åt gången eller välj en annan port och vidarebefordra den manuellt som privat.
Portforwarding ger inte automatiskt fungerande produktions-OAuth callbacks.
Stoppa devservern med Ctrl-C när du är klar.

Lokal emulering är inte bevis på fungerande externa service bindings, Browser Run,
Email Routing, AI eller autentisering. Följ appens lokala kontrakt och använd
syntetiska testdata; en lokal process kan fortfarande göra externa HTTP-anrop.
Tillför inte produktionscredentials och aktivera inte remote bindings för att
få ett smoke-test att passera. Kör inte `deploy`, `deploy:workers-builds` eller
remote-migrationer som del av denna utvecklingsstart.

## Kostnad och säker borttagning

Ställ in en kort idle-timeout i Codespaces-inställningarna (exempelvis 30 minuter,
om kontots policy medger det), och stoppa miljön explicit när arbetet är klart.
Att stänga browserfliken är inte samma sak som att stoppa miljön. En stoppad
Codespace kan fortfarande förbruka lagringsutrymme och lagringsbudget.

Före borttagning: kontrollera `git status`, granska diffen, pusha avsedda commits
till arbetsgrenen och spara nödvändiga lokala testartefakter på godkänd plats.
Kontrollera även ignorerade filer och lokal Wrangler-state: de finns inte i en
push och raderas med miljön. Spara inte privata data eller secrets i Git.
Stoppa och radera därefter exakt den avsedda miljön via Codespaces-menyn.
Använd aldrig keep-alive för att göra en Codespace till permanent runtime.

## Acceptans och evidens

Repo-konfiguration, lokal sandboxvalidering och en faktisk Codespace-boot är
separata kontroller. Denna baseline är **inte boot-verifierad i Codespaces**.
Innan den kontrollen accepteras i [programissue #250](https://github.com/Avkroken/Avkroken/issues/250):

- bygg/starta en ny Codespace på PR:ens exakta commit;
- notera commit-SHA, verktygsversioner och bootresultat;
- kör minst en appgate ovan och verifiera privat portforwarding med lokal Worker;
- länka relevant GitHub Actions-run på samma SHA, med apparnas ordinarie checks;
- notera eventuella begränsningar och stoppa/radera testmiljön efteråt.

Ingen Codespace, Project, Cloudflare-resurs eller VM-migrering skapas av dessa
repoändringar. Programissue använder `Refs` i leverans-PR:er och förblir öppet
för den återstående migreringen och driftacceptansen.
