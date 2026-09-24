# jobb

Jobb är en Cloudflare-baserad applikation för jobbsökning och ansökningsautomation med D1, R2, Browser Run och Cloudflare Workflows. Systemet håller auditerbar state för körningar, ansökningar, fel och evidence.

## Snabb verifiering

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
```

## Dokumentation

Börja i **[dokumentationsöversikten](docs/index.md)**.

- [Automation](docs/automation.md) — scheduling, quota, dashboard och rapporteringsflöden
- [Providers](docs/providers.md) — providerbeteende och integrationsgränser
- [Projektkontext](docs/project-context.md) — aktuell teknisk state
- [Arkitektur](docs/architecture.md) — runtime, state och trust boundaries
- [Authentication](docs/authentication.md) — dashboardauth/GitHub OAuth
- [Discovery](docs/discovery.md) — sök-/discoveryflöde
- [Drift](docs/operations.md) — verifiering, deployment och incidentkontroller

README är en ingång, inte en driftmanual.

## Grundinvarianter

- D1 är canonical run/application state; R2 innehåller stödjande evidence.
- osäkra eller tvetydiga providerutfall ska inte behandlas som verifierad framgång.
- användarstyrd e-legitimation/signering ska inte automatiseras.
- auth- och providercredentials får inte hamna i repository, logs eller publik dokumentation.
