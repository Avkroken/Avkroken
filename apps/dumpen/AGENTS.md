# AGENTS.md

- Läs [docs/project-context.md](docs/project-context.md), [docs/architecture.md](docs/architecture.md) och [docs/operations.md](docs/operations.md) före materiella ändringar.
- Dumpen ägs av `Avkroken/Avkroken` under `apps/dumpen`; rootens `AGENTS.md`, `.github/workflows/ci.yml` och monorepostandarder gäller tillsammans med denna appkontext.
- Arbeta i separat gren enligt rootkontraktet `{agent}/{feature}/{YYYY-MM-DD}` och fortsätt befintlig arbetslinje i stället för att skapa suffixvarianter.
- Bevara access-lagrets adminrouting, noindex- och cache-policy.
- Kör `npm run check` före merge; produktion deployas inte som bieffekt av vanlig verifiering.
- `wrangler.jsonc` beskriver repositoryts deklarerade target; verifiera alltid Cloudflare live-state separat. Live-verifiering 2026-09-29 fann ingen aktiv `dumpen` Worker, så providerprovisionering/cutover ingår inte implicit i repoarbete.
- När runtime väl är explicit provisionerad ägs produktionsdeployment av Cloudflare Workers Builds och får endast gå via `npm run deploy:workers-builds` på `main`.
- Mutera inte R2 som bieffekt av vanlig verifiering.
- Lägg aldrig secrets eller privat objektinnehåll i repository, logs eller dokumentation.
