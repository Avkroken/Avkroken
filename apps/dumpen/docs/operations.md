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
- `/admin/api/assets/*` kan lista indirekt via objekt-API:t och skapa nya assets men är aldrig publik;
- asset-direktlänkar går mot den separat verifierade custom domainen `logos.denied.se`; Dumpen exponerar ingen publik asset-listning;
- icke-publika ytor får avsedda `X-Robots-Tag`-headers;
- känsliga redirects/svar inte får publik cachepolicy.

## R2

När en ändring rör objektoperationer:

1. verifiera att rätt binding används (`DUMPEN` för privata transferer, `ASSETS` för assetlagret);
2. verifiera key/path-hantering i kod och test;
3. undvik generella list-/dumpoperationer som felsökningsgenväg;
4. testa felutfall separat från happy path.

R2-innehåll ska behandlas som applikationsdata, inte dokumentationsdata. `DUMPEN -> dumpen` är privat transferstorage och privat capability-state. `ASSETS -> avkroken-assets` är den befintliga asset-bucketen; dess exakta objekt-URL:er är publika via `logos.denied.se`, men inventory och generell upload är fortsatt adminskyddade. Den enda publika write-routen är den kortlivade, engångs- och path-låsta `PUT /api/asset-upload/<token>` för tema-v2 staging.

Live 2026-10-02: `dumpen` och `avkroken-assets` är available i rätt konto. Wrangler-profilen `avkroken` har fungerande R2 object write; resize-synken genomförde 124 lyckade writes och representativa liveobjekt lästes tillbaka med matchande SHA-256. Cloudflares bucket-metrik för object count/storage kan eftersläpa och ska inte användas som ensam verifiering. Custom domain `logos.denied.se` är aktiv och `r2.dev` är avstängt. Båda buckets har endast standardregeln för abort av ofullständiga multipart-uploads efter 7 dagar och ingen automatisk objektradering.

### Tema-v2 staging via engångs-HTTP-ticket

Staging-upload sker en fil i taget. Mintning får bara skapa tickets för nycklar som matchar `staging/themes-v2/apps/<app>/<app>-<1..7>.png`; uploaden accepterar bara PNG, gäller i 15 minuter och får inte skriva över en befintlig staging-fil.

Från MP100 kan driftkommandot skapa ticket-state direkt i privata `DUMPEN` utan att exponera en permanent credential:

```bash
npm run assets:ticket -- staging/themes-v2/apps/plex/plex-2.png
```

Kommandot skriver en kortlivad `uploadUrl`. Skicka därefter exakt en fil till den URL:en:

```bash
curl --fail-with-body \
  -X PUT \
  -H 'Content-Type: image/png' \
  --data-binary @plex-2.png \
  '<uploadUrl>'
```

Verifiera efter varje fil genom att läsa tillbaka exakt staging-nyckel från R2 och jämföra dimension/hash med källan. Staging-objekt visas inte i Dumpens vanliga asset-inventory. Canonical `apps/...` och `hotlink-ok/apps/...` uppdateras först efter att hela 56-originalmatrisen har granskats.

### App Launcher-varianter

`scripts/sync-app-assets.mjs` äger den reproducerbara one-way-syncen för de versionsstyrda app-/temakombinationerna. Den läser numrerade original från `apps/<app>/<app>-<tema>.png`, genererar exakt 256×256 och 512×512 med Sharp och kan skriva både canonical-objektet och motsvarande `hotlink-ok/`-spegel. Syncen raderar inte objekt och använder inte äldre `<app>-256.png` som källa eller tema.

Kör kommandona från `apps/dumpen` med installerade beroenden. App-/temalistan finns i `APP_ASSET_APPS` i `scripts/app-assets-sync.mjs` och omfattar 56 original över 8 appar (7 teman per app). `DUMPEN_ASSET_WORK` anger arbetskatalogen; standardvärdet är `.asset-work`, relativt aktuell katalog och ignorerat av Git. Original lagras som `source/<app>-<tema>.png` och genererade varianter som `generated/apps/<app>/<app>-<tema>-<storlek>.png` under arbetskatalogen. Utan `--fetch` måste samtliga original redan finnas där.

Lokal generering från befintlig arbetskopia:

```bash
DUMPEN_ASSET_WORK=.asset-work npm run assets:sync
```

Hämta canonical-original från live-R2 och generera varianterna:

```bash
npm run assets:sync -- --fetch
```

Efter explicit R2-skrivbehörighet kan samma verifierade pipeline även synka objekten:

```bash
npm run assets:sync -- --fetch --upload
```

`--upload` kräver `--fetch`; lokala original får inte vara källa för en live-upload. Hela batchens original måste vara exakt 1254×1254 och samtliga genererade dimensioner valideras före första PUT. Upload skriver sedan varje canonical-variant följd av dess hotlink-spegel, seriellt, med `image/png`. En full körning genererar och skriver 112 storleksvarianter (256 och 512) till canonical-paths och 112 motsvarande speglar; de 56 canonical-originalen är separata källobjekt. Körningen avbryts vid första fel; om felet inträffar under upload kan tidigare PUT redan ha lyckats och ingen rollback görs.

Live-verifiering 2026-10-04: Wrangler-profilen `avkroken` har fungerande object PUT mot `avkroken-assets` när mål-account anges explicit. Den kompletta 8×7×3-matrisen, 168 canonical PNG-objekt, laddades upp seriellt från MP100 till `apps/<app>/...`. Representativa objekt i början, mitten och slutet av matrisen hämtades tillbaka och matchade lokala källor byte-för-byte via SHA-256. Bucketens aggregerade object-count kan eftersläpa.

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

Live-verifiering 2026-10-02 visar att `dumpen` och `avkroken-assets` finns i det repository-deklarerade Cloudflare-kontot. Wrangler kan läsa och skriva R2-objekt samt läsa bucket-inventory, public-access-state och lifecycle direkt. `https://dumpen.denied.se/` samt `/robots.txt` svarar HTTP 200, och exakta asset-URL:er via `logos.denied.se` är tillgängliga. Workers Builds logg-API har tidigare varit permission-denied för den lokala identiteten och ska inte beskrivas som läst utan en ny lyckad direktkontroll.

`wrangler.jsonc` binder den befintliga delade GitHub OAuth-klientens publika client ID och den neutralt namngivna Cloudflare Secrets Store-bindingen `GITHUB_OAUTH_CLIENT_SECRET`; bindingen återanvänder den redan existerande OAuth-hemligheten i samma store i stället för att skapa en ny credential. Adminåtkomst begränsas av `DUMPEN_ALLOWED_GITHUB_IDS`. De gamla `DUMPEN_ADMIN_USER`/`DUMPEN_ADMIN_PASSWORD` används inte längre. Legacy machine upload fortsätter använda `DUMPEN_TOKEN`. R2-bindings är `DUMPEN -> dumpen` och `ASSETS -> avkroken-assets`; previewblocket förblir tomt så production-buckets inte binds i branch previews.

## GitHub Auth

- OAuth-app: befintliga Krösa-Maja.
- Callback: `https://dumpen.denied.se/auth/callback`.
- Provider scope: `read:user`.
- Flow: state + PKCE (S256).
- Authorization: versionsstyrd numerisk GitHub-ID-allowlist, inte användarnamn.
- Session: signerad `__Host-dumpen_session`, HttpOnly, Secure, SameSite=Lax, 12 h max.
- OAuth access token används endast för identitetsuppslag och revokeras efter callback.
- `GITHUB_OAUTH_CLIENT_SECRET` hämtas från Cloudflare Secrets Store och får inte kopieras till GitHub Actions eller repositoryt.
