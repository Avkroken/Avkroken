# Projektkontext

**Senast verifierad:** 2026-09-29

## Ansvar

Dumpen är en Cloudflare Worker med R2-lagring och ett explicit access-/routinglager.

- `src/access.js` är extern entrypoint.
- `src/index.js` innehåller applikationslogik.
- R2-bindingen `DUMPEN` är tjänstens persistenta objektlager.
- den publika rooten hålls separat från privilegierad applikationsyta.

## Repository-deklarerad runtime target

`apps/dumpen/wrangler.jsonc` är importerad från den sista fullständiga pre-retirement-snapshoten och definierar på `Avkroken/Avkroken`-repositoryts `main`:

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

## Live provider-state

Verifierat 2026-09-29 med den autentiserade Wrangler-profilens läsbara konton samt DNS-resolution:

- Worker `dumpen`: **not_configured** — Cloudflare API returnerar uttryckligen att Workern inte finns i båda tillgängliga kontona;
- runtime-secrets: **not_observed** — det finns ingen Worker att läsa secretnamn från;
- R2 i kontot som `wrangler.jsonc` pekar på: **permission_denied / unknown** — bucket-listning returnerar Cloudflare authentication error, så bucketens existens får inte antas åt något håll;
- R2 i det andra tillgängliga kontot: **not_configured** — Cloudflare anger att R2 inte är aktiverat;
- `dumpen.denied.se`: **unavailable / not_configured observed** — varken systemresolvern eller 1.1.1.1 returnerade A/AAAA-post vid verifieringen.

Detta innebär att repositoryts deklarerade Worker/domain/binding är **target-state**, inte aktuell provider-state. Repo-migreringen får inte skapa Worker, R2, DNS eller runtime-secrets som bieffekt. Runtimeaktivering/provisionering kräver ett separat explicit beslut och live-verifiering av målaccount och permissions.

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

Root-CI kör samma appgate som checken `Dumpen`. `npm run deploy:workers-builds` är repositoryts avsedda produktionsentrypoint **när** en Dumpen-runtime uttryckligen har provisionerats och Workers Builds kopplats till `Avkroken/Avkroken` med root directory `apps/dumpen`. Scriptet accepterar endast `main`, kör `npm run check`, deployar och avslutar med `npm run verify:production`. I nuvarande live-state ska den provider-side cutovern inte utföras eftersom Workern inte finns.

## Dokumentationsgräns

App-specifik runtime och kodnära invariants dokumenteras här. Organisationsgemensam GitHub-governance, rulesets och Custom Properties hör inte hemma i denna fil.

## Uppdateringskontrakt

Uppdatera denna fil när någon av följande ändras:

- Worker entrypoint eller domain,
- R2-binding eller storageansvar,
- routing-/accessgräns,
- observabilitymodell,
- deploy-/verifieringsmodell.
