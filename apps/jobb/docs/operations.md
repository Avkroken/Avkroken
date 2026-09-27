# Drift och verifiering

**Senast verifierad mot repositoryt:** 2026-09-24

## Lokal verifiering

Från `apps/jobb` i monorepot:

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
```

Appens rootskript kör motsvarande workspacekontroller för projekten under `apps/*` och `packages/*`.

## Lokal utveckling

```bash
pnpm dev
```

Det kör `@avkroken/web`-paketets Wrangler-baserade devscript.

## Deployment

Cloudflare Workers Builds äger produktionsdeploymenten. GitHub Actions används endast för repository-CI och behöver ingen Cloudflare deploy-secret.

Workers Builds ska använda app-roten `apps/jobb` och:

```bash
pnpm deploy:workers-builds
```

Scriptet kräver `WORKERS_CI=1` och `WORKERS_CI_BRANCH=main`, kör `pnpm typecheck` och `pnpm test`, och anropar därefter `pnpm deploy:cloudflare`.

`pnpm deploy:cloudflare` applicerar D1-migrationer remote via `apps/jobb/wrangler.jsonc` och deployar därefter Workern med samma konfiguration.

## D1 data locality

Produktionsbindingen `DB` ska använda en D1-databas skapad med `jurisdiction=eu`. Cloudflare tillåter inte att jurisdiction läggs till eller ändras efter att databasen skapats, så ett framtida byte ska göras som en kontrollerad export/import till en ny EU-databas före binding-cutover.

Read replication ska vara avstängd tills Jobbs D1-requestväg använder D1 Sessions API. Att aktivera repliker utan Sessions API flyttar inte querytrafik från primären.

## Readiness

`GET /api/health` är minimal liveness.

`GET /api/ready` verifierar D1 och att dashboard-authkonfigurationen är användbar enligt implementationen. Readiness får inte exponera credential-värden.

## Månadskörning

Kontrollera före manuell omkörning:

1. aktuell månads stable run,
2. quota slots,
3. applications med `uncertain` state,
4. senaste providerfel/evidence,
5. att en ny körning inte kan överskrida månadsgränsen.

## Browser/providerincident

Vid browser/providerfel:

- bevara run/application state i D1,
- klassificera oklar submission som `uncertain`,
- undvik blind retry om providern kan ha accepterat submission,
- kontrollera evidence och providerstate innan ny submission tillåts.

## GitHub OAuth

Vid loginfel verifiera:

- GitHub OAuth client ID,
- Secrets Store-binding för client secret,
- att exakt callback `https://jobb.denied.se/auth/callback` är registrerad på OAuth-klienten,
- `JOBB_ALLOWED_GITHUB_IDS`,
- PKCE/state-validering och GitHub `/user`-uppslag.

Lägg inte till Basic Auth, OIDC-proxy eller parallell authväg som fallback.

## Evidence och privacy

R2-evidence ska vara begränsad till det som behövs för auditability. Probe-state för aktivitetsrapportering får beskriva formulärstruktur men inte lagra användarens ifyllda känsliga fältvärden som generell diagnostik.

## Observability

`apps/jobb/wrangler.jsonc` definierar:

- persistent observability,
- log sampling `0.1`,
- trace sampling `0.01`,
- `redact_query_string=true`.

OAuth callback-parametrar kan förekomma i query string; redaction ska därför behållas. Credentials, sessionsmaterial och privata providerpayloads får inte läggas i logs.

## Dokumentationsunderhåll

Uppdatera denna fil när appens test-/deployscripts, runtimebindings, migrationsordning eller incidentmodell ändras. Extern live-state ska verifieras i sitt auktoritativa system och inte kopieras in som permanent app-current-state.
