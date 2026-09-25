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

### Projektkatalog

`GET /api/projects` läser GitHubs publika repositorylista och normaliserar den.

Om GitHub API inte kan läsas returnerar backend `502 github_unavailable` och UI visar att projekt-/tjänstelistan är otillgänglig.

Katalogsvaret innehåller `generatedAt` och deklarerad coverage `active_public_repositories_and_opt_in_apps`.

### Appdiscovery

Opt-in-appdiscovery läser endast `portal.public.json` under appkataloger.

- saknat manifest är normalt och publicerar ingenting;
- ogiltigt manifest eller manifest-read-fel markerar `source.appDiscovery = partial`;
- fel vid listning av appkatalogen markerar `source.appDiscovery = unavailable`;
- repositorykatalogen kan fortfarande returneras när appdiscovery är unavailable/partial;
- inga appkatalogers övriga filer eller skyddade payloads läses av discovery-steget.

### Publicerade sites

`GET /api/sites` härleds från projektkatalogen och behåller den tidigare endpointpolicyn genom `portalPublished`.

### Dokumentationskatalog

Om GitHub-katalogen inte kan läsas returneras `502` med `github_unavailable`. UI visar ett explicit unavailable-state.

Opt-in-appdokument tas endast med när appen först har passerat samma giltiga `portal.public.json`-gräns som projektkatalogen. Appens publika route-path hålls separat från provider-path.

### Dokumentinnehåll

- okänd katalognyckel/route-path eller path som inte finns i katalogpostens allowlist: `404 document_not_found`;
- providerfel: `404` eller `502 document_unavailable`;
- dokument över tillåten storlek: `413 document_too_large`.

### Heartbeat

`OperationalWatchdog` håller state för Skvallerbyttans heartbeat och kan markera stale när förväntad leverans uteblir.

Heartbeat-state ska inte automatiskt tolkas som komplett provider health för GitHub eller Cloudflare.

## Cache

### Projektkatalog

`/api/projects` lagras i Workers Cache API med fem minuters cachetid.

Klientresponsen kräver revalidering. Workers Cache API lagrar en separat response-kopia med `Cache-Control: public, max-age=300`, och cache-hit-responsen normaliseras tillbaka till klientrevalidering. `/api/sites` härleds från samma normaliserade response.

### Dokumentation

Dokumentationscache kan invalideras internt via `DocsInvalidationService`.

Invalidering använder:

- global tag `docs-catalog`;
- repositoryspecifik `docs-repo-...`-tag.

Service binding används i stället för att exponera en publik administrationsendpoint.

## Säkerhetsgränser

- Lägg inte providercredentials i browser assets.
- Skapa inte ny credential för Portal v2 om befintligt verifierat flöde räcker.
- `.github`, retired sources, arkiverade och icke-publika repositories ska inte hamna i den publika projektkatalogen.
- Monorepo-appar får endast publiceras genom det appägda, strikt validerade `portal.public.json`-kontraktet; saknat manifest får inte ge en publik post eller app-docs-källa.
- Appdokument får endast hämtas efter exakt katalogmatchning; manifestpayload får inte styra source-repository/ref/path.
- Jobb/Auth-data får inte passera publik Portal-cache, publik docs-katalog eller publik sök.
- Skvallerbyttans providerintegration förblir read-only.
- DNS, Cloudflare Access, Worker permissions och credentialscope är arkitekturkrav och ändras inte som sidoeffekt av UI-arbete.

## Efter deployment

En framtida produktiondeployment ska verifieras mot faktisk provider-state:

1. deployworkflow/checks är gröna;
2. Worker-route och custom domain svarar enligt avsett URL-kontrakt;
3. `/api/projects`, `/api/sites` och `/api/docs` fungerar utan att exponera credentials;
4. `/api/projects` inkluderar aktiva publika repositories utan krav på homepage men exkluderar `.github` och retired sources;
5. Skvallerbyttans opt-in-manifest ger en app-post utan att skapa en publik dashboard-länk, medan Jobb saknar app-post;
6. deep links returnerar Portal-shell;
7. `/projekt/skvallerbyttan/dokumentation` renderar app-lokal README/docs med source-path-oberoende URL och “Visa original” till `Avkroken/Avkroken`;
8. en godtycklig Jobb-path mot `/api/docs/content` ger inte en publik dokumentträff;
9. `/auth/jobb[/...]` redirectar till Jobbs skyddade origin och Jobb-data går inte att hämta genom publika Portal-routes;
10. cache-/heartbeat-beteende har inte regresserat.

Kalla inte deployment klar innan den verifieringen är gjord.
