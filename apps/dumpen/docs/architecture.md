# Arkitektur

## Översikt

```text
Browser / client
      |
      v
dumpen.denied.se
      |
      v
src/access.js
      |
      +-- public root
      +-- robots/indexing policy
      +-- admin/API canonicalisering
      +-- response security/cache policy
      |
      v
src/index.js
      |
      +--> GitHub OAuth via Krösa-Maja
      |     +-- PKCE + state
      |     +-- numeric GitHub ID allowlist
      |     +-- signed __Host session cookie
      |
      +--> R2 private transfers via DUMPEN -> dumpen
      +--> R2 assets via ASSETS -> avkroken-assets -> logos.denied.se
```

## Komponentansvar

### `src/access.js`

Det externa Worker-entrypointet är en policygräns framför applikationen. Det ska:

- skilja publik startsida från applikationsytan,
- hålla admin/API-routes under avsedd pathstruktur,
- förhindra oavsiktlig sökmotorindexering,
- sätta lämplig cachepolicy på känsliga svar och redirects,
- skicka till applikationslogiken först efter att requestpolicyn har tillämpats.

Att flytta dessa guarantees till klient-JavaScript skulle ändra trust boundaryn och är därför inte en likvärdig refaktorering.

### `src/index.js`

Applikationslagret hanterar den egentliga funktionaliteten efter accesslagret och använder R2 för persistent data.

### R2

`DUMPEN` binder Workern till bucket `dumpen` för privata transferer. `ASSETS` binder samma Worker till den befintliga bucket `avkroken-assets`, som innehåller App Launcher-bilder och andra publika assets. Worker-processens minne ska betraktas som tillfälligt.

De två lagren blandas inte. Privata transferer behåller sin äldre versionsstruktur i `dumpen`. Asset-inventory läses via `ASSETS`, medan klientens direktlänk härleds till R2-custom-domainen `https://logos.denied.se/<object-key>`. Om asset-inventoryn faller visas assets som otillgängliga utan att den privata transferlistan slutar fungera.

## Requestflöden

### Publik root

`/` hanteras av accesslagret och kan presenteras publikt utan att exponera den privilegierade applikationsytan.

### Publika assets

Admin kan lista den befintliga `avkroken-assets`-inventoryn och ladda upp nya filer via den sessionsskyddade asset-API:n. Nya generiska filer lagras under `uploads/<random-128-bit-id>/<filename>` för att undvika konflikter med befintliga `apps/.../`-nycklar. Ingen publik list-endpoint införs.

För kontrollerad tema-v2-produktion finns dessutom en smal capability-upload. Admin-API:t `POST /admin/api/assets/tickets` mintar en 256-bitars, 15-minuters engångsticket för exakt en förutbestämd staging-nyckel. Den publika capability-routen `PUT /api/asset-upload/<token>` accepterar endast PNG och endast nycklar som matchar `staging/themes-v2/apps/<known-app>/<same-app>-<1..7>.png`. Ticket- och claim-state lagras i privata `DUMPEN`; själva bilden skrivs till `ASSETS`. Uploaden får inte skriva canonical `apps/...`, får inte skriva över en befintlig staging-fil och capabilityn raderas efter lyckad användning.

Bildformat renderas i admin-galleriet; klienten läser bildens naturliga pixelmått och visar storlek, dimensioner och format under kortet. App Launcher-filer under `apps/<app>/` normaliseras dessutom till appkategori, numeriskt tema och variant: `<app>-<tema>.png` är den verifierade 1254×1254-källan, följd av `<app>-<tema>-256.png` och `<app>-<tema>-512.png`. Galleriet erbjuder separata filter för appkategori, pixelstorlek och tema. `hotlink-ok/apps/...` är en lagringsspegel och `staging/...` är ofärdig produktionsdata; båda döljs ur den logiska inventoryn. Äldre `<app>-256.png` klassas som legacy och blir inte ett extra tema. Direktlänken för en logisk asset är R2-custom-domainens canonical `apps/...`-URL. `r2.dev` är avstängt och bucketens custom domain är den enda avsedda publika objektvägen.

Filtren kombineras med AND och gäller galleriets bildkort; separata filrader påverkas inte. Filteralternativen härleds från listade bilder med appkategori och tema, så storleksvarianter blir valbara först när de finns i inventoryn. Äldre `<app>-256.png`-filer döljs helt ur listningen tillsammans med app-speglarna; andra objekt under `hotlink-ok/` behålls. Appbilder sorteras efter appnamn, numeriskt tema och storlek med originalet först.

### Privilegierad API-yta

`/admin` och `/admin/api/*` kräver en giltig lokal session som skapas efter GitHub OAuth via Krösa-Maja. OAuth-flödet använder state + PKCE, tillåter endast versionsstyrda numeriska GitHub-ID:n och återkontrollerar allowlisten för varje session. GitHubs kortlivade provider-token används endast för `/user`-uppslag och revokeras efter callback; den lagras inte som Dumpen-session.

Legacy API-paths canonicaliseras till adminnamnrymden. Accesslagret kan därefter rewrite:a internt till den path som applikationslagret förväntar sig.

Det gör att extern URL-policy och intern implementation kan utvecklas separat utan att gamla interna routes blir den publika kontraktytan.

### Robots och indexering

`robots.txt` är kompletterande metadata, inte en säkerhetsmekanism. Server-side response headers upprätthåller noindex/noarchive på ytor som inte ska hamna i sökindex.

## Failure model

Vid routingfel ska felsökning ske i denna ordning:

1. host/custom-domain och Worker-route,
2. `src/access.js` pathklassificering,
3. rewrite/redirect och response headers,
4. `src/index.js`,
5. R2-operation.

Det minskar risken att ett lagrings- eller applikationsfel felaktigt behandlas som routingproblem.

## Säkerhetsgränser

- privilegierade routes får inte bli publikt indexerbara;
- accesspolicy ska ligga server-side;
- GitHub OAuth/sessionvalidering ska faila stängt om klient, Secrets Store-secret eller allowlist saknas;
- Basic Auth ska inte återintroduceras som parallell interaktiv adminväg;
- R2-innehåll ska inte exponeras genom generell debugfunktion eller publik bucket-listning;
- asset-inventory och generell asset-upload får endast nås genom GitHub-session-skyddad admin-API; enda undantaget är den separata, kortlivade och path-låsta `asset-upload`-capabilityn för tema-v2 staging;
- den befintliga custom domainen `logos.denied.se` får endast användas för exakt kända object-URL:er; Dumpen får inte införa publik bucket-listning;
- nya upload-nycklar ska använda servergenererade oförutsägbara id:n för att undvika kollisioner;
- query strings ska fortsatt redigeras i persistent observability.
