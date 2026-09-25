# Skvallerbyttan

Skvallerbyttan är ett strikt read-only observationslager och dashboard för GitHub- och Cloudflare-data. Provider-events och API-läsningar normaliseras till gemensam state för dashboard och auktoriserade maskinklienter. Avkroken-portalen kan dessutom läsa separata sanerade snapshots genom den interna named RPC-entrypointen `PortalObservationsService` utan att få access till det skyddade HTTP-API:t. Repository-CI för Portalen projiceras från Skvallerbyttans canonical `overview` source cache och startar ingen ny GitHub Actions-read vid Portal-sidvisning. Publik Portal-Activity använder en separat repository-allowlistad RPC-projektion över den reducerade D1-eventledgers `observation_events`; den gör ingen ny providerread och publicerar inte resource-ID:n, actors eller rå webhookpayload. Endast `github.avkroken.repositories`, `github.avkroken.pull_requests` och `github.avkroken.actions` får lämna denna publika Activity-projektion; security/governance-capabilities stannar i den skyddade observationsytan.

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

Skvallerbyttan observerar provider-state men administrerar den inte. Observationsfunktioner ska inte kräva provider-write-permissions, och känsliga credentialvärden eller rådata ska inte exponeras genom dashboard, API eller downstream-RPC.
