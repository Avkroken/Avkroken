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
- Kör endast den berörda applikationens deploykommandon när deployment uttryckligen ingår i scope.
- Lägg aldrig secrets, tokens, privata nycklar eller credentialvärden i repositoryt.
- Skvallerbyttans providerarkitektur ska fortsatt vara read-only.
- Root-workflows får inte ersätta applikationsspecifik validering med generiska kontroller; Portal, Skvallerbyttan och Jobb ska köra respektive apps verifierade gate. `Krosa-Maja` är tills vidare en ruleset-kompatibel retirement guard.
- `Avkroken/Avkroken` är ett publikt repository. Arbeta via PR och följ de checks och skydd som GitHub faktiskt visar för ändringen; repositoryt dokumenterar inte extern plan-/ruleset-live-state som canonical fakta.

## Agent skills

### Issue tracker

Use this repository's GitHub Issues for issues and specifications. Read `docs/agents/issue-tracker.md` before reading, creating, or publishing tickets.

### Domain docs

This is a multi-context monorepo. Route domain and technical context through the affected application's own `AGENTS.md` and `docs/project-context.md` as described in `docs/agents/domain.md`.

