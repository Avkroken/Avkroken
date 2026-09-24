# Drift

**Senast verifierad mot repositoryt:** 2026-09-24

Det här dokumentet kompletterar [deployment.md](deployment.md). Deploymentdokumentet beskriver repositoryts versionerade provisioning-/migreringsordning; här ligger verifierings- och incidentmodellen.

## Lokal/full verifiering

```bash
npm install
npm run check
```

`npm run check` kör:

- tester,
- TypeScript typecheck,
- Worker-validering genom repositoryts `validate:worker`-script.

Delstegen kan även köras separat:

```bash
npm test
npm run typecheck
npm run validate:worker
```

## Deployment

Repositoryts versionerade deploykommando är:

```bash
npm run deploy
```

Deployscriptet ansvarar enligt [deployment.md](deployment.md) för att:

1. identifiera/verifiera D1-resursen,
2. rendera temporär Wrangler-konfiguration när konkret databas-ID krävs,
3. applicera versionsstyrda migrationer,
4. deploya Workern,
5. radera temporär konfiguration även vid fel.

Vilket externt CI/CD-system som eventuellt anropar kommandot är inte repo-local current-state och dokumenteras inte här.

## OIDC smoke test

Vid protocoländring eller innan en ny klient tas i bruk:

1. verifiera discovery,
2. verifiera JWKS,
3. använd en registrerad testklient,
4. kör Authorization Code + PKCE,
5. verifiera issuer, audience, nonce, state och redirect URI,
6. verifiera UserInfo,
7. verifiera refresh/revoke/logout där klienten använder dem.

## Identity invariants

Vid authincident:

- GitHub numeric ID används enligt repositoryts allowlistmodell,
- GitHub-token får inte bli persistent D1-state,
- Cloudflare får endast länkas enligt implementationens account-linking-policy,
- delegerade Cloudflare-token ska ligga krypterade,
- Dynamic Client Registration och Client Credentials ska förbli avstängda om inte repositoryts arkitektur uttryckligen ändras.

## Runtimekonfiguration

Känsliga värden kommer från avsedda Worker secret-/Secrets Store-bindings. Operativ verifiering får kontrollera att bindings är tillgängliga, men aldrig skriva ut deras värden.

`wrangler.jsonc` är repositoryts auktoritativa deploybara runtimekonfiguration för:

- Worker entrypoint,
- custom domain,
- D1-binding,
- icke-hemliga vars,
- secret bindings,
- observability.

## Publika protokollvägar

Discovery, sign-in/callback och övriga OAuth/OIDC-routes som implementationen exponerar måste förbli nåbara enligt protocolkontraktet.

Adminfunktioner ska fortsatt kräva den authorization som repositoryts server-side implementation upprätthåller. Externa edge-/Access-policyer är separat live-state och dokumenteras inte som repo-current-state här.

## Failure model

- saknad/ogiltig runtimekonfiguration → fail closed,
- fel Host/origin → reject,
- D1-problem → stateful authoperationer failar,
- okänd GitHub-identitet → ingen lokal session,
- saknad Cloudflare-klientkonfiguration → Cloudflare linking kan faila utan att OIDC-providerrollen behöver tas ned.

## Observability

`wrangler.jsonc` definierar persistent observability med:

- query-string-redaction,
- log sampling `0.1`,
- trace sampling `0.01`.

Query-string-redaction ska bevaras eftersom OAuth/OIDC-parametrar kan förekomma i URL:er. Secrets, authorization-listor och tokenvärden får inte loggas.

## Dokumentationsunderhåll

Uppdatera denna fil när verifieringsscripts, deployscript, runtimebindings, protocolkontrakt eller incidentmodell ändras. Extern GitHub-/Cloudflare-live-state verifieras i sitt auktoritativa system och kopieras inte in som permanent repo-current-state.
