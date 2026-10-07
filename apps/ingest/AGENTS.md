# AGENTS.md

## Läs först

- [README.md](README.md) — modulens bootstrap-scope och cutover-gräns.
- [docs/project-context.md](docs/project-context.md) — appens canonical repository-state.
- `../../docs/organization/` — delad monorepo-kontext när ändringen faktiskt berör flera appar.
- Avkrokens Library-plan för Observability Architecture när arbetet rör service-map, transport eller provider cutover.

## Invariants

- Arbeta från aktuell `main` i separat seriell arbetsgren enligt repositoryts root-`AGENTS.md`.
- Skvallerbyttan är fortsatt live/canonical webhook-destination tills Ingest/Events cutover uttryckligen verifierats.
- Ingest verifierar, reducerar och lämnar över; den äger inte canonical event storage, provider polling, source-cache eller presentation.
- Raw providerpayload, secrets, tokens, Authorization/cookies och scanning-hemligheter får aldrig lämna Ingest-seamen.
- HTTP 202 får ges först efter lyckad durable handoff när Queue-binding senare provisioneras.
- Canonical dedup ligger i Events; Ingest producerar stabil `idempotencyKey` men får inte vara enda dedupgränsen.
- Ingen Cloudflare Queue/DNS/Worker/secret-provisionering eller provider destination cutover utan uttryckligt scope.
- Försvaga inte CI-, release-, security- eller ruleset-gates för att få implementationen att passera.
