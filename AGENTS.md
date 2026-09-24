# AGENTS.md

- Arbeta från aktuell `main` i separat branch enligt `{agent}/{feature}/{YYYY-MM-DD}/{HH-mm}-{id}`.
- Läs relevant apps egen `AGENTS.md` och dokumentation före materiella ändringar.
- Root-CI producerar merge gates: `Dependency review`, `Portal`, `Skvallerbyttan`, `Krosa-Maja` och `Jobb`.
- Provider-/produktionsmutationer är separata driftåtgärder; kör inte deploy eller credentialändringar utan uttryckligt scope.
- Lägg aldrig secrets, tokens, privata nycklar eller credentialvärden i repository.
- Skvallerbyttans providerarkitektur för observation är read-only och får inte ges write-permissions.
