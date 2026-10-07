# AGENTS.md

## Läs först

- [README.md](README.md) — modulens bootstrap-scope och cutover-gräns.
- [docs/project-context.md](docs/project-context.md) — appens canonical repository-state.
- `../../docs/organization/` — delad monorepo-kontext när ändringen faktiskt berör flera appar.
- Avkrokens Library-plan för Observability Architecture när arbetet rör service-map, storage eller cutover.

## Invariants

- Arbeta från aktuell `main` i separat seriell arbetsgren enligt repositoryts root-`AGENTS.md`.
- Events blir canonical event owner först efter explicit shadow/parity/cutover-verifiering; dagens Skvallerbyttan `observation_events` är canonical tills dess.
- Raw providerpayload, secrets, tokens, Authorization/cookies och scanning-hemligheter får aldrig lagras i Events.
- `idempotency_key` är canonical dedup-gräns; duplicate delivery ska vara idempotent success.
- Samma idempotency key med annan semantic payload ska aldrig skrivas över tyst.
- Events får inte läsa State/Skvallerbyttans D1 direkt efter extraction; tvärmodulära reads går genom modulkontrakt/RPC.
- Ingen Cloudflare D1/Queue/DNS/Worker-provisionering eller provider cutover utan uttryckligt scope.
- Försvaga inte CI-, release-, security- eller ruleset-gates för att få implementationen att passera.
