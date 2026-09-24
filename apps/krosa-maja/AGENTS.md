# AGENTS.md

## Läs först

1. [docs/index.md](docs/index.md)
2. [docs/project-context.md](docs/project-context.md)
3. [docs/architecture.md](docs/architecture.md)
4. [docs/deployment.md](docs/deployment.md)
5. [docs/operations.md](docs/operations.md)

## Invarianter

- Krösa-Maja är en separat OAuth/OIDC authority; konsumtionsappar ska inte duplicera providerrollen.
- GitHub numeric ID används som identitetsnyckel där implementationen kräver det; login/e-post ska inte ersätta den godtyckligt.
- upstream bearer-token ska inte persisteras som lokal permanent credential.
- delegerade provider-token ska lagras enligt repositoryts krypteringsmodell.
- PKCE ska krävas för registrerade interaktiva klienter.
- redirect URIs ska vara explicita; wildcard ska inte införas.
- `workers.dev` och preview URLs ska förbli avstängda för den deploybara produktionkonfigurationen.
- secrets, privata nycklar och känslig authorization-konfiguration får inte läggas i publik dokumentation.

Organisationsgemensam GitHub-governance dokumenteras centralt och ska inte dupliceras som repo-current-state här.
