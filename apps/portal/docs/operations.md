# Drift — Avkroken Portal

## Lokal verifiering

Kör från `apps/portal`.

```bash
npm install
npm test
npx wrangler deploy --dry-run --config wrangler.jsonc
```

`npm test` kör Portalens Node-testsvit.

Dry-run verifierar Worker-bundle och Wrangler-konfiguration utan produktionsdeployment.

## Deployment

Repositoryts `.github/workflows/deploy-portal.yml` är produktionsflödet för Portal.

Aktuellt versionsstyrt kontrakt:

- workflow startas manuellt;
- deployjobbet använder `apps/portal` som working directory;
- production deployment måste köras från `main`;
- befintlig repository secret mappas till `CLOUDFLARE_API_TOKEN`;
- workflow kör Wrangler dry-run före deployment;
- deployment kör `npm run deploy`.

Feature branches ska inte deploya produktion.

Det här dokumentet beskriver repositorykontraktet. Privat Cloudflare account/DNS/Access live-state måste verifieras hos providern före en driftändring.

## Worker-konfiguration

`wrangler.jsonc` definierar bland annat:

- Worker `avkroken`;
- statiska assets via `ASSETS`;
- cachebinding;
- observability med loggar och traces;
- schedulerad watchdog-kontroll;
- Durable Object `OperationalWatchdog`;
- e-postbinding för operativa notifieringar.

Credentialvärden dokumenteras inte här.

## Felmodell

### GitHub project/site discovery

Om GitHub API inte kan läsas returnerar `/api/projects` eller `/api/sites` `502` och UI visar att berörd katalog är otillgänglig. Project catalog och site catalog har separata cache keys.

### Dokumentationskatalog

Om GitHub-katalogen inte kan läsas returneras `502` med `github_unavailable`. UI visar ett explicit unavailable-state.

### Dokumentinnehåll

- okänd repository/path: `404 document_not_found`;
- providerfel: `404` eller `502 document_unavailable`;
- dokument över tillåten storlek: `413 document_too_large`.

### Heartbeat

`OperationalWatchdog` håller state för Skvallerbyttans heartbeat och kan markera stale när förväntad leverans uteblir.

Heartbeat-state ska inte automatiskt tolkas som komplett provider health för GitHub eller Cloudflare.

## Cacheinvalidering

Dokumentationscache kan invalideras internt via `DocsInvalidationService`.

Invalidering använder:

- global tag `docs-catalog`;
- repositoryspecifik `docs-repo-...`-tag.

Service binding används i stället för att exponera en publik administrationsendpoint.

## Säkerhetsgränser

- Lägg inte providercredentials i browser assets.
- Skapa inte ny credential för Portal v2 om befintligt verifierat flöde räcker.
- Jobb/Auth-data får inte passera publik Portal-cache eller publik sök.
- Skvallerbyttans providerintegration förblir read-only.
- DNS, Cloudflare Access, Worker permissions och credentialscope är arkitekturkrav och ändras inte som sidoeffekt av UI-arbete.

## Efter deployment

En framtida produktiondeployment ska verifieras mot faktisk provider-state:

1. deployworkflow/checks är gröna;
2. Worker-route och custom domain svarar enligt avsett URL-kontrakt;
3. `/api/projects`, `/api/sites` och `/api/docs` fungerar utan att exponera credentials;
4. deep links returnerar Portal-shell;
5. dokumentationsrendering visar “Visa original” till canonical källa;
6. `/auth/jobb[/...]` redirectar till Jobbs skyddade origin och Jobb-data går inte att hämta genom publika Portal-routes;
7. cache-/heartbeat-beteende har inte regresserat.

Kalla inte deployment klar innan den verifieringen är gjord.
