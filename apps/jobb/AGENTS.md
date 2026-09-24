# AGENTS.md

## Läs först

1. [docs/index.md](docs/index.md) — dokumentationskarta.
2. [docs/project-context.md](docs/project-context.md) — repo-specifik teknisk current-state.
3. [docs/architecture.md](docs/architecture.md) — runtime, state och trust boundaries.
4. [docs/operations.md](docs/operations.md) — verifiering, deployment och incidentkontroller.
5. [docs/automation.md](docs/automation.md) och [docs/providers.md](docs/providers.md) — domänspecifika flöden.
6. [docs/authentication.md](docs/authentication.md) — auth- och credentialgränser.

Gemensamma organisationsstandarder finns i `Avkroken/.github`. De ska inte dupliceras som Jobb-current-state.

## Invariants

- Arbeta från aktuell `main` i separat arbetsgren.
- Månadsgränsen är exakt tio verifierade lämpliga ansökningar; osäkra providerresultat ska faila stängt.
- BankID/e-identifikation är user-controlled och får inte automatiseras som signering.
- Krösa-Maja är dashboardens OIDC-provider enligt repositoryts implementation.
- Browser Run är integrationsgräns för browserbaserade providerflöden; sprid inte browserimplementation in i domänlogiken.
- D1 är canonical run/application state; R2 evidence är stöddata.
- Kör minst `pnpm typecheck` och `pnpm test` före merge.
- Ändra inte permissions eller deploymentarkitektur som workaround för failing checks.
- Lägg aldrig secrets, providercredentials, sessionsmaterial eller privat evidence i Git eller publik dokumentation.
