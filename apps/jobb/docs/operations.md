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

Det versionsstyrda produktionskommandot är:

```bash
pnpm deploy:cloudflare
```

Enligt `apps/jobb/package.json` gör kommandot två saker i ordning:

1. applicerar D1-migrationer remote via `apps/jobb/wrangler.jsonc`;
2. deployar Workern med samma Wrangler-konfiguration.

Hur ett externt CI/CD-system triggar detta kommando är inte canonical repo-state och ska inte hårdkodas i detta dokument.

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
