# Projektkontext

**Senast verifierad:** 2026-09-24

## Ansvar

Krösa-Maja är en OAuth 2.1/OpenID Connect-provider som körs som Cloudflare Worker.

Repositoryt innehåller:

- Worker-entrypoint och authimplementation,
- D1-schema/migrationer,
- signing/OIDC-konfiguration,
- providerkopplingar,
- deploy- och valideringsscripts,
- tester för protocol- och runtimekontrakt.

## Runtime

`wrangler.jsonc` definierar repo-specifik deploykonfiguration:

- Worker `krosa-maja`
- entrypoint `src/index.ts`
- custom domain `auth.denied.se`
- `workers_dev=false`
- preview URLs avstängda
- D1-binding `AUTH_DB`
- persistent observability med query-string-redaction
- Secrets Store-bindings för känsliga runtimevärden.

## Implementation

`package.json` använder:

- Better Auth
- `@better-auth/oauth-provider`
- TypeScript
- Wrangler.

Verifieringskommandot är:

```bash
npm run check
```

## Protokollmodell

Tjänsten implementerar OAuth/OIDC med Authorization Code + PKCE för interaktiva klienter.

Discovery/JWKS och övriga endpoints ska ses som ett protokollkontrakt; ändringar måste verifiera issuer, redirect URI, state/nonce, tokenvalidering och klientbeteende.

## Upstream identity

GitHub används som upstream identity. Upstream access token behövs för identitetsuppslag men ska inte bli permanent lokal bearer-credential.

## Linked provider

Cloudflare kan länkas som separat provider för delegerad API-access. Länkningen ska hållas skild från skapandet av den lokala användaridentiteten.

## D1

D1 innehåller auth-/providerstate och Better Auth-schema. Schemaändringar ska ske via versionsstyrda migrationer.

## Secrets

Känsliga runtimevärden tillhandahålls genom Worker secrets/Secrets Store-bindings. Dokumentation får beskriva ansvar och bindingnamn när det behövs för implementationen, men aldrig värden eller känsliga authorization-listor.

## Dokumentationsgräns

Denna fil innehåller endast repo-specifik, publikt verifierbar teknisk current-state. Extern organisationsgovernance, deployment-live-state och privata operatörsbeslut hör inte hemma här.

## Uppdateringskontrakt

Uppdatera filen när runtime, authprotocol, D1-schema, signingmodell, providergränser eller deploymodell ändras.
