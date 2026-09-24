# Skvallerbyttan

Skvallerbyttan är ett strikt read-only observationslager och dashboard för GitHub- och Cloudflare-data. Provider-events och API-läsningar normaliseras till gemensam state för dashboard och auktoriserade maskinklienter.

## Snabb verifiering

```bash
npm ci
npm run check
```

`npm run check` kör tester, TypeScript typecheck och Worker dry-run.

## Dokumentation

Börja i **[dokumentationsöversikten](docs/index.md)** eller den publika dokumentationssajten.

- [Arkitektur](docs/architecture.md)
- [API](docs/api.md)
- [Permissions](docs/permissions.md)
- [Säkerhet](docs/security.md)
- [Drift](docs/operations.md)
- [Projektkontext](docs/project-context.md)
- [SECURITY.md](SECURITY.md)

README hålls medvetet kort; detaljer, kontrakt och driftinformation ligger under `docs/`.

## Grundprincip

Skvallerbyttan observerar provider-state men administrerar den inte. Observationsfunktioner ska inte kräva provider-write-permissions, och känsliga credentialvärden eller rådata ska inte exponeras genom dashboard eller API.
