# Projektkontext

**Senast verifierad:** 2026-10-06

## Ansvar

Dumpen är en Cloudflare Worker med R2-lagring och ett explicit access-/routinglager.

- `src/access.js` är extern entrypoint.
- `src/index.js` innehåller applikationslogik.
- R2-bindings är `DUMPEN -> dumpen` för privata transferer och `ASSETS -> avkroken-assets` för publika assets.
- privata transferer och publika assets använder separata R2-buckets och separata accesskontrakt; assetfel degraderar separat och får inte blockera privat transferadministration.
- `avkroken-assets` har den verifierade custom domainen `logos.denied.se`; Dumpen listar och laddar upp via bindingen `ASSETS`, medan direktlänkar går direkt mot custom domainen utan publik bucket-listning.
- den publika Dumpen-rooten hålls separat från den privilegierade applikationsytan.

## Repository-deklarerad runtime target

`apps/dumpen/wrangler.jsonc` är importerad från den sista fullständiga pre-retirement-snapshoten och definierar på `Avkroken/Avkroken`-repositoryts `main`:

- Worker: `dumpen`
- entrypoint: `src/access.js`
- custom domain: `dumpen.denied.se`
- `workers_dev=false`
- preview URLs avstängda
- R2-bindings: `DUMPEN -> dumpen` för privata transferer och `ASSETS -> avkroken-assets` för App Launcher-/assetfiler
- persistent Cloudflare observability
- query-string-redaction
- log sampling 0.1 (10 %)
- trace sampling 0.01 (1 %)
- GitHub OAuth client ID via Krösa-Maja
- GitHub OAuth client secret via Cloudflare Secrets Store
- numerisk GitHub-ID-allowlist för adminåtkomst

## Live provider-state

Verifierat 2026-10-02 med den autentiserade Wrangler-profilen och faktisk runtime:

- Worker `dumpen`: **available** — `wrangler deployments list` och `wrangler versions list` visar aktiva versioner/deployments i det deklarerade kontot;
- senaste observerade deployment: **2026-09-30T02:42:42Z**;
- `https://dumpen.denied.se/`: **available** — HTTP 200;
- `https://dumpen.denied.se/robots.txt`: **available** — HTTP 200;
- Workers Builds logg-API: **permission_denied** för den lokala Wrangler-identiteten (`403`), så enskilda provider-buildloggar får inte beskrivas som lästa när de endast syns som GitHub-checkstatus;
- R2-bucket `dumpen`: **available** — skapad 2026-09-29T20:05:35.526Z och 0 objekt / 0 B vid kontrollen; den behålls för privata transferer;
- R2-bucket `avkroken-assets`: **available** — den äldre bucket-metriken visade 78 objekt / 96,7 MB vid kontrollen 2026-10-01. Den 2026-10-02 genomförda resize-synken skrev 124 nya objekt (62 canonical-varianter + 62 `hotlink-ok`-speglar) med exit code 0, och representativa liveobjekt hämtades tillbaka med matchande SHA-256. R2:s object-count/storage-metrik kan eftersläpa och används därför inte som ensam per-object-verifiering;
- `avkroken-assets` public access: **available** — `r2.dev` är avstängt och custom domain `logos.denied.se` är aktiv med TLS; `https://logos.denied.se/apps/plex/plex-256.png` svarade HTTP 200 som `image/png`;
- R2 lifecycle för båda berörda buckets: **available** — enda live-regeln är Cloudflares standardregel som avbryter ofullständiga multipart-uploads efter 7 dagar; ingen automatisk objektradering är konfigurerad.

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

Dumpens mörka Avkroken-identitet behålls med grön produktaccent, men standardtemat `legacy` presenteras nu som **Aurora** och använder lugnare grafitgröna ytor, diskret glow, större spacing och tydligare surface-hierarki. `forest` visas fortsatt som **Avkroken** och `blackout` som **Blackout**; de delar samma moderniserade komponent- och touchkontrakt.

Temavalet använder `localStorage["avkroken.theme"]` och, på denied.se, presentationscookien `avkroken_theme`. Cookien är inte autentiserings- eller auktorisationsstate och får aldrig påverka Dumpens GitHub-session, upload-tickets eller access-routing.

## Storage

R2-bucketen `dumpen` är durable storage för privata transferer och privat capability-state. Den befintliga `avkroken-assets`-bucketen är separat assetlager och binds som `ASSETS`. Dumpens asset-inventory skiljer nu på launcher-loggor och temabilder. Äldre `apps/<app>/<app>-256.png` exponeras som `assetRole = launcher` / legacy och är en separat launcher-kandidat; temamatrisen `<app>-<tema>[-<storlek>].png` exponeras som `assetRole = theme`. `hotlink-ok/apps/...`-speglar och ofärdiga `staging/...`-objekt döljs fortsatt. `assetRole = launcher` betyder inte att Cloudflare Access aktivt använder objektet; aktiv launcher-konfiguration är separat provider-state. Andra objekt under `hotlink-ok/` behålls i inventoryn.

Direktlänkar härleds från object key och den verifierade custom domainen `https://logos.denied.se`. Temabilder använder `<app>-<tema>.png` som original och `<app>-<tema>-256.png` respektive `<app>-<tema>-512.png` som normaliserade storleksvarianter. Media Library visar launcher-loggor och temabilder som separata typer och använder launcher-kandidaten som app-preview när en sådan finns. Klick på ett appkort öppnar samma launcher-roll som kortet visar; om appen saknar launcher-kandidat faller drill-down tillbaka till appens 1254×1254-temabilder. Temamatrisen ligger kvar som ett explicit filterval och ska inte tyst ersätta appkortets preview. Media Library kan söka, filtrera på typ/app/tema/storlek och sortera inventoryt och använder ett separat `/admin/api/assets`-flöde från privata transferer. Nya generiska admin-uppladdningar lagras under `uploads/<random-id>/<filename>` för att undvika namnkonflikter och får motsvarande stabila URL.

Appuploads kan ange app, tema och storlek explicit; servern härleder då canonical key oberoende av det lokala filnamnet. Äldre namnkonventioner fortsätter fungera som fallback. Replace behåller canonical URL, och delete är begränsad till servergenererade uploads eller canonical appassets; en canonical app-delete tar också dess dolda hotlink-spegel. Media Library-klienten använder drag/drop/clipboard och **en** native, direkt tryckbar **Välj filer**-input på iPhone/iPad för bilder, kamera och Files/iCloud Drive; klienten förlitar sig inte på JavaScript-`.click()` mot dolda file inputs. Ett filval ska skapa en synlig **Valda filer**-kö **innan** preview/blob-URL eller bildmått läses och startar ingen request. På iOS binds både `input` och `change` till samma deduplicerade handler via `event.currentTarget`, eftersom WebKit inte alltid beter sig identiskt mellan Photos/Kamera och Files. Media Library-bootstrapen är felisolerad från övriga adminfunktioner: `loadAssets` exponeras före eventbindning, saknade DOM-kontroller rapporteras utan att stoppa resten av kontrollpanelen och tomma count-badges renderas inte som tomma kapslar. Logout är en native POST-form och fungerar utan klient-JavaScript. Bildmått läses asynkront i bakgrunden, och först ett explicit **Ladda upp** flyttar staged poster till uploadkön med individuell progress och högst tre aktiva uploads. I Automatisk-läge döljs manuella app/tema/storlek-fält helt; i Manuell temabild visas de som redigerbara kontroller före upload. För att behålla 500 MB-appgränsen serialiseras quota-check + R2-write för både adminuploads och theme-v2 staging med ett kortlivat privat lock i `DUMPEN`; admin-klienten retry:ar lock-konflikter automatiskt. Mutable assets använder kort cache-TTL eftersom replace behåller samma publika URL.

Tema-v2-produktion använder en separat engångscapability: en adminsession eller det lokala driftkommandot mintar en 15-minuters ticket i privata `DUMPEN`; den publika capability-URL:n `/api/asset-upload/<token>` får därefter göra exakt en PNG-write till en förutbestämd nyckel under `staging/themes-v2/apps/<app>/<app>-<1..7>.png`. Capabilityn accepterar inte canonical `apps/...`-nycklar, andra appar eller andra teman, skriver inte över befintlig staging-fil och försvinner efter lyckad användning. Dumpen exponerar ingen publik inventory-route; endast R2-custom-domainens exakta object-URL:er är publika.

Dokumentation, debugoutput och loggning får inte dumpa objektinnehåll som en generell felsökningsmekanism.

## Verifieringsmodell

Appens grundkontroll från `apps/dumpen` är:

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run check
```

Root-CI kör samma appgate som checken `Dumpen`. Cloudflare Workers Builds ska kopplas till `Avkroken/Avkroken`, branch `main`, root directory `apps/dumpen`, med `npm run deploy:workers-builds` som produktionsentrypoint. På `main` kör scriptet `npm run check`, deployar med Wrangler och verifierar provider-side att Wranglers nyss rapporterade `version_id` är den aktiva production-versionen via `wrangler deployments status --json`. Post-deploy HTTP-verifiering ligger inte i Cloudflare-builden: verifiering 2026-10-06 från GitHub-hostad runner gav HTTP 403 för Node-fetch och headless Chrome kunde inte observera appens DOM. Om Cloudflare anropar samma entrypoint för en annan branch avslutas körningen framgångsrikt utan deployment; feature-/PR-branches får alltså aldrig producera en Dumpen-produktionsdeploy.

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
