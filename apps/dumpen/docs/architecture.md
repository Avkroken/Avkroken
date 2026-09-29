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
      +--> R2 bucket via DUMPEN
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

`DUMPEN` binder Workern till bucket `dumpen`. R2 är den persistenta lagringsgränsen; Worker-processens minne ska betraktas som tillfälligt.

## Requestflöden

### Publik root

`/` hanteras av accesslagret och kan presenteras publikt utan att exponera den privilegierade applikationsytan.

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
- R2-innehåll ska inte exponeras genom generell debugfunktion;
- query strings ska fortsatt redigeras i persistent observability.
