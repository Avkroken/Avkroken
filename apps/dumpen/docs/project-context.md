# Projektkontext

**Senast verifierad:** 2026-09-29

## Ansvar

Dumpen är en Cloudflare Worker med R2-lagring och ett explicit access-/routinglager.

- `src/access.js` är extern entrypoint.
- `src/index.js` innehåller applikationslogik.
- R2-bindingen `DUMPEN` är tjänstens persistenta objektlager.
- den publika rooten hålls separat från privilegierad applikationsyta.

## Runtime

`apps/dumpen/wrangler.jsonc` definierar på `Avkroken/Avkroken`-repositoryts `main`:

- Worker: `dumpen`
- entrypoint: `src/access.js`
- custom domain: `dumpen.denied.se`
- `workers_dev=false`
- preview URLs avstängda
- R2-binding: `DUMPEN -> dumpen`
- persistent Cloudflare observability
- query-string-redaction
- log sampling 0.1
- trace sampling 0.01

## Routinggräns

`src/access.js` ansvarar för den externa policygränsen. Den hanterar bland annat:

- separat publik startsida,
- `/robots.txt`,
- avsaknad av publik sitemap,
- canonicalisering av privilegierade API-paths till adminytan,
- intern rewrite till applikationens legacy-route,
- `X-Robots-Tag`/cache-policy där ytor inte ska indexeras eller cacheas publikt.

Detta är server-side guarantees. Frontendkod får inte vara enda platsen som upprätthåller dem.

## Storage

R2-bucketen `dumpen` är durable object storage för applikationen. Dokumentation, debugoutput och loggning får inte dumpa objektinnehåll som en generell felsökningsmekanism.

## Verifieringsmodell

Appens grundkontroll från `apps/dumpen` är:

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run check
```

Root-CI kör samma appgate som checken `Dumpen`. Produktion ägs av Cloudflare Workers Builds med root directory `apps/dumpen` och deploykommandot `npm run deploy:workers-builds`; scriptet accepterar endast `main`, kör `npm run check`, deployar befintlig Worker och avslutar med `npm run verify:production`.

## Dokumentationsgräns

App-specifik runtime och kodnära invariants dokumenteras här. Organisationsgemensam GitHub-governance, rulesets och Custom Properties hör inte hemma i denna fil.

## Uppdateringskontrakt

Uppdatera denna fil när någon av följande ändras:

- Worker entrypoint eller domain,
- R2-binding eller storageansvar,
- routing-/accessgräns,
- observabilitymodell,
- deploy-/verifieringsmodell.
