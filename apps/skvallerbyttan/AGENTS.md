# AGENTS.md

## Läs först

- `../../docs/organization/engineering-context.md` — central engineering-, CI- och governance-kontext.
- `../../docs/organization/documentation-standard.md` — organisationsgemensam dokumentationsmodell.
- [docs/project-context.md](docs/project-context.md) — appens canonical current-state.
- [docs/architecture.md](docs/architecture.md), [docs/security.md](docs/security.md) och [docs/operations.md](docs/operations.md) — arkitektur, säkerhetsgränser och drift.

## Invariants

- Utgå från monorepots aktuella default branch och arbeta i separat gren enligt `{agent}/{feature}/{YYYY-MM-DD}/{HH-mm}-{id}`.
- Kör `npm run check` före merge.
- Deploya inte och ändra inte Cloudflare-resurser utan uttryckligt scope.
- Skvallerbyttans providerarkitektur är read-only. Begär, konfigurera eller använd inte provider-write-permissions för observationsfunktioner.
- Providerrawdata ska minimeras före exponering. Returnera inte secret/token-värden, råa scanning-hemligheter, Worker secret bindings, KV values eller R2 object contents.
- Capability keys, statusmodell, provenance och `/api/v1` är maskinkonsumerade kontrakt; breaking changes ska vara explicita och testskyddade.
- Försvaga inte CI-, säkerhets- eller ruleset-krav för att få en ändring att passera.
- Lägg aldrig secrets, tokens, privata nycklar eller andra credentials i repository eller publik dokumentation.
