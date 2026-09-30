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
- log sampling 0.1 (10 %)
- trace sampling 0.01 (1 %)
- GitHub OAuth client ID via Krösa-Maja
- GitHub OAuth client secret via Cloudflare Secrets Store
- numerisk GitHub-ID-allowlist för adminåtkomst

## Live provider-state

Verifierat 2026-09-30 med den autentiserade Wrangler-profilen och faktisk runtime:

- Worker `dumpen`: **available** — `wrangler deployments list` och `wrangler versions list` visar aktiva versioner/deployments i det deklarerade kontot;
- senaste observerade deployment: **2026-09-30T02:42:42Z**;
- `https://dumpen.denied.se/`: **available** — HTTP 200;
- `https://dumpen.denied.se/robots.txt`: **available** — HTTP 200;
- Workers Builds logg-API: **permission_denied** för den lokala Wrangler-identiteten (`403`), så enskilda provider-buildloggar får inte beskrivas som lästa när de endast syns som GitHub-checkstatus;
- R2-bucketens separata inventory-state är fortsatt **permission_denied / unknown** från den lokala identiteten; runtime/deploymentens funktion bevisar inte separat bucket-listbehörighet.

Dumpen är alltså nu provisionerad och körs som GitHub-kopplad Cloudflare Worker. Produktionsdeployment ägs fortsatt av Cloudflare Workers Builds från `Avkroken/Avkroken`, branch `main`, root `apps/dumpen`; lokal `wrangler deploy` är inte normal skapande-/releaseväg.

## Routinggräns

`src/access.js` ansvarar för den externa policygränsen. Den hanterar bland annat:

- separat publik startsida,
- `/robots.txt`,
- avsaknad av publik sitemap,
- canonicalisering av privilegierade API-paths till adminytan,
- intern rewrite till applikationens legacy-route,
- `X-Robots-Tag`/cache-policy där ytor inte ska indexeras eller cacheas publikt.

Detta är server-side guarantees. Frontendkod får inte vara enda platsen som upprätthåller dem.

## Tema

Dumpens svart/gröna terminalidentitet behålls som produktaccent, men ytorna använder monorepots gemensamma teman `legacy`, `forest` (visas som **Avkroken**) och `blackout`. `legacy` är fallback och återger det äldre Avkroken-uttryckets mörka bas, cyan/blå/magenta glow och diskreta rutnät utan att ersätta Dumpens lime-/lila produktaccent.

Temavalet använder `localStorage["avkroken.theme"]` och, på denied.se, presentationscookien `avkroken_theme`. Cookien är inte autentiserings- eller auktorisationsstate och får aldrig påverka Dumpens GitHub-session, upload-tickets eller access-routing.

## Storage

R2-bucketen `dumpen` är durable object storage för applikationen. Dokumentation, debugoutput och loggning får inte dumpa objektinnehåll som en generell felsökningsmekanism.

## Verifieringsmodell

Appens grundkontroll från `apps/dumpen` är:

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run check
```

Root-CI kör samma appgate som checken `Dumpen`. Cloudflare Workers Builds ska kopplas till `Avkroken/Avkroken`, branch `main`, root directory `apps/dumpen`, med `npm run deploy:workers-builds` som produktionsentrypoint. På `main` kör scriptet `npm run check`, deployar och avslutar med `npm run verify:production`. Om Cloudflare anropar samma entrypoint för en annan branch avslutas körningen framgångsrikt utan deployment; feature-/PR-branches får alltså aldrig producera en Dumpen-produktionsdeploy. Denna GitHub-import är den avsedda mekanismen för att återskapa Workern.

`wrangler.jsonc` har dessutom ett explicit tomt `previews`-block. Det gör branch-previews fail-closed: production-R2, Secrets Store och authvars är inte bundna i previewmiljön. En preview får därför verifiera build/runtime-skal men får inte läsa eller skriva Dumpens production-data.

## Dokumentationsgräns

App-specifik runtime och kodnära invariants dokumenteras här. Organisationsgemensam GitHub-governance, rulesets och Custom Properties hör inte hemma i denna fil.

## Uppdateringskontrakt

Uppdatera denna fil när någon av följande ändras:

- Worker entrypoint eller domain,
- R2-binding eller storageansvar,
- routing-/accessgräns,
- observabilitymodell,
- deploy-/verifieringsmodell.
