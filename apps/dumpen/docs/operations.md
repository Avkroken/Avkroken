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
- `/admin` kräver GitHub-session och oautentiserade browserrequests går via `/login` → Krösa-Maja;
- `/admin/api/*` kräver samma signerade GitHub-session och når rätt intern applikationsroute;
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

Repositoryts produktionsmodell är Cloudflare Workers Builds, inte en GitHub Actions-deployworkflow. Workern ska skapas/importeras från repository `Avkroken/Avkroken`, branch `main`, root directory `apps/dumpen`, med deploy command `npm run deploy:workers-builds`. Scriptet deployar endast från `main`; när Cloudflare startar samma build command för en PR-/feature-branch avslutas den explicit utan deployment. Scriptet skapar inga tokens eller runtime-secrets.

Branch-previews är dessutom explicit fail-closed i `wrangler.jsonc`: previewkonfigurationen är tom och ärver därför inte production-R2, Secrets Store eller authvars. Previewbuilden får inte använda production-data som genväg.

### Nuvarande providerläge

Live-verifiering 2026-09-30 visar att `dumpen` är provisionerad i det repository-deklarerade Cloudflare-kontot. Wrangler visar aktiva deployments/versioner och `https://dumpen.denied.se/` samt `/robots.txt` svarar HTTP 200. Den lokala Wrangler-identiteten får däremot `403` mot Workers Builds logg-API och kan inte separat inventera R2-bucketen; dessa delar ska därför fortsatt markeras `permission_denied`/`unknown` i stället för att antas.

`wrangler.jsonc` binder den befintliga delade GitHub OAuth-klientens publika client ID och den neutralt namngivna Cloudflare Secrets Store-bindingen `GITHUB_OAUTH_CLIENT_SECRET`; bindingen återanvänder den redan existerande OAuth-hemligheten i samma store i stället för att skapa en ny credential. Adminåtkomst begränsas av `DUMPEN_ALLOWED_GITHUB_IDS`. De gamla `DUMPEN_ADMIN_USER`/`DUMPEN_ADMIN_PASSWORD` används inte längre. Legacy machine upload fortsätter använda `DUMPEN_TOKEN`. R2-bindingen förblir `DUMPEN -> dumpen`; den separata bucket-inventeringen är fortfarande permission-denied för den lokala identiteten.

## GitHub Auth

- OAuth-app: befintliga Krösa-Maja.
- Callback: `https://dumpen.denied.se/auth/callback`.
- Provider scope: `read:user`.
- Flow: state + PKCE (S256).
- Authorization: versionsstyrd numerisk GitHub-ID-allowlist, inte användarnamn.
- Session: signerad `__Host-dumpen_session`, HttpOnly, Secure, SameSite=Lax, 12 h max.
- OAuth access token används endast för identitetsuppslag och revokeras efter callback.
- `GITHUB_OAUTH_CLIENT_SECRET` hämtas från Cloudflare Secrets Store och får inte kopieras till GitHub Actions eller repositoryt.
