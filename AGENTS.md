# AGENTS.md

- Läs berörd applikations `AGENTS.md` och `docs/project-context.md` före materiella ändringar.
- Organisationsgemensam engineering- och driftskontext ligger i `docs/organization/`.
- Arbeta i separat gren enligt `{agent}/{feature}/{YYYY-MM-DD}/{HH-mm}-{id}`.
- Kör endast den berörda applikationens deploykommandon när deployment uttryckligen ingår i scope.
- Lägg aldrig secrets, tokens, privata nycklar eller credentialvärden i repositoryt.
- Skvallerbyttans providerarkitektur ska fortsatt vara read-only.
- Root-workflows får inte ersätta applikationsspecifik validering med generiska kontroller; de fyra canonical appcheckarna ska köra respektive apps verifierade gate.
- `Avkroken/Avkroken` är privat på GitHub Free och saknar därmed aktiv ruleset-enforcement. Arbeta ändå alltid via PR och merga först när canonical CI är grön.
