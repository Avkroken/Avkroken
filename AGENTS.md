# AGENTS.md

- Läs berörd applikations `AGENTS.md` och `docs/project-context.md` före materiella ändringar.
- Organisationsgemensam engineering- och driftskontext ligger i `docs/organization/`.
- Arbeta i separat gren enligt `{agent}/{feature}/{YYYY-MM-DD}/{HH-mm}-{id}`.
- Kör endast den berörda applikationens deploykommandon när deployment uttryckligen ingår i scope.
- Lägg aldrig secrets, tokens, privata nycklar eller credentialvärden i repositoryt.
- Skvallerbyttans providerarkitektur ska fortsatt vara read-only.
- Root-workflows får inte ersätta applikationsspecifik validering med generiska kontroller; varje required check ska köra respektive apps verifierade gate.
