# AGENTS.md

- Läs berörd applikations `AGENTS.md` och `docs/project-context.md` före materiella ändringar.
- `docs/organization/` innehåller endast delad engineering-/driftskontext för **Avkroken/Avkroken-monorepot**.
- PR-titlar/squash commits ska följa [release- och versionsstandarden](docs/organization/release-standard.md); fristående repos äger sina egna motsvarande releasekontrakt.
- Fristående Avkroken-repositories äger sin egen tekniska dokumentation och ska inte behandla detta repository som central engineeringkälla.
- Extern GitHub-governance är provider-state. Anta inte organization-scope, organization secrets eller andra org-funktioner utan live-verifiering.
- Arbeta i separat gren enligt `{agent}/{feature}/{YYYY-MM-DD}`.
- Commits ska använda Conventional Commits eller motsvarande tydlig typ, exempelvis `feat:`, `fix:`, `docs:`, `chore:`, `ci:` eller `test:`.
- Läs hela PR-review-state före merge, inklusive kommentarer och trådar som GitHub markerar som `outdated`; verifiera att grundproblemet faktiskt är löst.
- Kör endast den berörda applikationens deploykommandon när deployment uttryckligen ingår i scope.
- Lägg aldrig secrets, tokens, privata nycklar eller credentialvärden i repositoryt.
- Skvallerbyttans providerarkitektur ska fortsatt vara read-only.
- Root-workflows får inte ersätta applikationsspecifik validering med generiska kontroller; Portal, Skvallerbyttan och Jobb ska köra respektive apps verifierade gate. `Krosa-Maja` är tills vidare en ruleset-kompatibel retirement guard.
- `Avkroken/Avkroken` är ett publikt repository. Arbeta via PR och följ de checks och skydd som GitHub faktiskt visar för ändringen; repositoryt dokumenterar inte extern plan-/ruleset-live-state som canonical fakta.
