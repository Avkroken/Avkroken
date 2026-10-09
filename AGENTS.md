# AGENTS.md

- Läs berörd applikations `AGENTS.md` och `docs/project-context.md` före materiella ändringar.
- `docs/organization/` innehåller endast delad engineering-/driftskontext för **Avkroken/Avkroken-monorepot**.
- PR-titlar/squash commits ska följa [release- och versionsstandarden](docs/organization/release-standard.md); fristående repos äger sina egna motsvarande releasekontrakt.
- Fristående Avkroken-repositories äger sin egen tekniska dokumentation och ska inte behandla detta repository som central engineeringkälla.
- Extern GitHub-governance är provider-state. Anta inte organization-scope, organization secrets eller andra org-funktioner utan live-verifiering.
- Arbeta i separat gren enligt `{agent}/{feature}/{date}`, där `date` skrivs som `YYYY-MM-DD`.
- Arbetet ska vara seriellt och semantiskt per repository: en arbetsgren/PR motsvarar en sammanhängande feature eller uppgift, och `feature`-delen ska beskriva arbetet semantiskt.
- Innan agenten påbörjar nästa uppgift i samma repository ska befintlig öppen arbetsgren, draft eller PR färdigställas genom relevanta checks, reviews och merge, eller uttryckligen avslutas/blockeras. Skapa inte tids-/ID-suffix eller parallella branchvarianter för att kringgå ett upptaget namn.
- Om `{agent}/{feature}/{date}` redan finns för uppgiften ska agenten fortsätta den befintliga arbetslinjen i stället för att skapa en ny.
- Commits ska använda Conventional Commits eller motsvarande tydlig typ, exempelvis `feat:`, `fix:`, `docs:`, `chore:`, `ci:` eller `test:`.
- Läs hela PR-review-state före merge, inklusive kommentarer och trådar som GitHub markerar som `outdated`; verifiera att grundproblemet faktiskt är löst.
- GitHub Issues är agentens spårbara arbetsplats: länka specifikation, genomförande, testresultat, changelog/release och PR. Använd `Fixes #N` endast när hela issueacceptansen faktiskt är uppfylld.
- Agentinitierade GitHub-skrivoperationer via användarens OAuth-anslutning måste redovisas som agentoperationer i relevant issue/PR med vilken agent, ändring och commit/PR som berörs. Visa separat att GitHubs registrerade aktör är `Avkroken` och **inte bevisar** vilken person eller session som utförde åtgärden.
- Stäng inte en PR utan merge på eget initiativ. Om den inte ska fortsätta: dokumentera orsak och uttryckligt beslut i PR innan stängning. Den repo-lokala closure-auditen registrerar provideraktören även när GitHubs aktörsnamn inte kan skilja agent från kontoägare.
- Behandla aldrig grennamn (`codex/*`, `chatgpt/*`) eller commit-metadata som autentiserad agentidentitet. Automatiskt privilegierade flöden kräver antingen en av GitHub verifierad botidentitet eller en `User` med aktuell, GitHub-verifierad `write`-, `maintain`- eller `admin`-behörighet. En OAuth-login bevisar inte en separat agentidentitet. Behörighet är inte i sig samtycke till auto-merge: PR:n måste uttryckligen ha köats för native auto-merge, och samtliga review-/CI-grindar och repositoryskydd gäller fortsatt.
- Kör endast den berörda applikationens deploykommandon när deployment uttryckligen ingår i scope.
- Lägg aldrig secrets, tokens, privata nycklar eller credentialvärden i repositoryt.
- Observationsarkitekturen — inklusive Skvallerbyttan, Ingest och Events — ska fortsatt vara read-only mot externa providers.
- Root-workflows får inte ersätta applikationsspecifik validering med generiska kontroller; Portal, Skvallerbyttan, Ingest, Events, Spam filter, Jobb och Dumpen ska köra respektive apps verifierade gate. `Krosa-Maja` är tills vidare en ruleset-kompatibel retirement guard.
- `Avkroken/Avkroken` är ett publikt repository. Arbeta via PR och följ de checks och skydd som GitHub faktiskt visar för ändringen; repositoryt dokumenterar inte extern plan-/ruleset-live-state som canonical fakta.

## Agent skills


### Matt Skills Curated

Use Matt Skills Curated as the preferred runtime engineering workflow catalog. Read `docs/agents/matt-skills.md` before routing non-trivial engineering work. If the user explicitly invokes `@Matt Skills Curated` or a packaged skill, honor that route unless a harder repository or safety constraint conflicts. Select the narrowest effective skill, keep one primary skill per lifecycle phase, and never vendor or invent missing skill bodies.

### Issue tracker

Use this repository's GitHub Issues for issues and specifications. Read `docs/agents/issue-tracker.md` before reading, creating, or publishing tickets.

### Triage roles

When issue classification or external-request triage is in scope, use the five canonical roles in `docs/agents/triage-labels.md`. Reuse equivalent existing repository labels; do not mutate provider labels merely to normalize names. A missing GitHub label does not erase the logical triage state.

### Domain docs

This is a multi-context monorepo. Route domain and technical context through the affected application's own `AGENTS.md` and `docs/project-context.md` as described in `docs/agents/domain.md`.

