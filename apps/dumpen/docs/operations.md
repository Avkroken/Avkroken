# Drift

## Lokal utveckling

Installera beroenden och starta Wrangler:

```bash
npm install
npm run dev
```

Använd lokal utveckling för request-/routingarbete. Produktion ska inte användas som första verifieringsmiljö.

## Full lokal verifiering

```bash
npm run check
```

Dry-run ska verifiera att Worker-bundlen och Wrangler-konfigurationen är giltiga utan att deploya.

## Routingchecklista

Efter ändringar i `src/access.js`, verifiera minst:

- `/` ger den avsedda publika ytan;
- `/robots.txt` svarar enligt publiceringspolicyn;
- `/sitemap.xml` inte introduceras oavsiktligt;
- legacy privilegierade `/api/*` canonicaliseras;
- `/admin/api/*` når rätt intern applikationsroute;
- icke-publika ytor får avsedda `X-Robots-Tag`-headers;
- känsliga redirects/svar inte får publik cachepolicy.

## R2

När en ändring rör objektoperationer:

1. verifiera att rätt binding används (`DUMPEN`);
2. verifiera key/path-hantering i kod och test;
3. undvik generella list-/dumpoperationer som felsökningsgenväg;
4. testa felutfall separat från happy path.

R2-innehåll ska behandlas som applikationsdata, inte dokumentationsdata.

## Deployment

Det underliggande deployscriptet kör:

```bash
npm run deploy
```

Det använder `wrangler deploy --strict`. PR-verifiering ska stanna vid `npm run check` och får inte deploya.

Efter en **avsedd** deployment:

```bash
npm run verify:production
```

Produktionsverifieringen kompletterar lokala tester; den ersätter dem inte.

## Felsökning

### Fel publik sida eller fel route

Kontrollera i ordning:

1. custom domain/Worker-route,
2. `src/access.js`,
3. redirects/rewrites och response headers,
4. `src/index.js`.

### R2-relaterat fel

Kontrollera binding, key och operationstyp innan applikationslogik ändras. Undvik att exponera privata objekt i logs.

### Observability

Wrangler-konfigurationen har persistent logs/traces med sampling och query-string-redaction. Behåll redaction vid felsökning; öka inte datainsamlingen permanent bara för att lösa ett enskilt fel.

## CI och Workers Builds

`Avkroken/Avkroken/.github/workflows/ci.yml` äger PR-/merge-group-checken `Dumpen` och kör `npm ci --ignore-scripts --no-audit --no-fund` följt av `npm run check` i `apps/dumpen`.

Repositoryts avsedda produktionsmodell är Cloudflare Workers Builds, inte en GitHub Actions-deployworkflow. När en runtime senare är explicit provisionerad ska providerkonfigurationen använda repository `Avkroken/Avkroken`, branch `main`, root directory `apps/dumpen` och deploy command `npm run deploy:workers-builds`. Scriptet vägrar andra branches och skapar inga tokens eller runtime-secrets.

### Nuvarande providerläge

Live-verifiering 2026-09-29 visar ingen `dumpen` Worker i de två konton som den autentiserade Wrangler-profilen kan läsa. `dumpen.denied.se` saknade observerbara A/AAAA-poster. R2 kan inte verifieras i det repository-deklarerade kontot eftersom bucket-listning ger authentication error; i det andra kontot är R2 inte aktiverat.

Därför ska ingen Workers Builds-source-cutover, `npm run deploy`, R2-provisionering, DNS-ändring eller secret-skrivning utföras som del av repositorymigreringen. Runtime-secretnamnen `DUMPEN_TOKEN`, `DUMPEN_ADMIN_USER` och `DUMPEN_ADMIN_PASSWORD` är kodkontrakt men deras provider-state är **not_observed** tills en Worker finns och kan läsas. Den deklarerade bindingen förblir `DUMPEN -> dumpen` i repositoryt.
