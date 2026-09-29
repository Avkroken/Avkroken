# Dumpen

Dumpen är en Cloudflare Worker för `dumpen.denied.se`. Tjänsten kombinerar ett explicit access-/routinglager med R2-baserad objektlagring och håller den publika ytan avsiktligt liten.

## Snabbstart

```bash
npm install
npm test
npx wrangler deploy --dry-run
```

För lokal utveckling:

```bash
npm run dev
```

## Dokumentation

Börja i **[dokumentationsöversikten](docs/index.md)**. Därifrån går det att klicka vidare till:

- [projektkontext](docs/project-context.md) — aktuell repo-specifik runtime och ansvar
- [arkitektur](docs/architecture.md) — requestflöde, routinggräns och lagring
- [drift](docs/operations.md) — lokal verifiering, monorepo-CI, Workers Builds, deployment och felsökning
- [SECURITY.md](SECURITY.md) — säkerhetsrapportering

README är medvetet kort. Den tekniska detaljnivån ligger under `docs/`. Appen ägs av `Avkroken/Avkroken` under `apps/dumpen`.

## Viktig invariant

`src/access.js` är en säkerhets- och publiceringsgräns. Ändringar får inte göra admin/API-ytor indexerbara, flytta accesspolicy enbart till frontend eller kringgå Worker-lagret genom asset-serving.
