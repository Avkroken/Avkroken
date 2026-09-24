# Krösa-Maja

Krösa-Maja är en Cloudflare Worker som fungerar som OAuth 2.1/OpenID Connect-provider för registrerade klienter. Den använder GitHub som upstream-identitet och kan länka Cloudflare som separat delegerad provider.

## Snabb verifiering

```bash
npm install
npm run check
```

`check` kör tester, TypeScript typecheck och Worker-validering.

## Dokumentation

Börja i **[dokumentationsöversikten](docs/index.md)**.

- [Projektkontext](docs/project-context.md) — runtime, protokoll och state ownership
- [Arkitektur](docs/architecture.md) — trust boundaries och authflöden
- [Deployment](docs/deployment.md) — D1, migrationer och Worker-deploy
- [Drift](docs/operations.md) — verifiering och incidentmodell

README är avsiktligt kort; protokoll- och driftinformation ligger under `docs/`.

## Säkerhetsinvarianter

- Authorization Code + PKCE är huvudflödet för interaktiva klienter.
- upstream bearer-tokens ska inte bli permanent lokal identitetsstate.
- länkade providers får inte skapa alternativa kontovägar om implementationen inte uttryckligen tillåter det.
- secrets och authorization-data ska hållas utanför source och publik dokumentation.
