# Deployment och migrering

Det här dokumentet beskriver appens deploybara teknik. Konto-, policy- och credentialvärden som inte behövs för att förstå koden hör inte hemma här.

## Förutsättningar

- Node-version enligt appens package/runtimekrav
- Wrangler-autentisering med rätt deploybehörighet
- nödvändiga Worker secrets/Secrets Store-bindings provisionerade
- D1-resurs tillgänglig eller möjlig att provisionera genom deployscriptet.

## Deploybar source of truth

`wrangler.jsonc` definierar:

- Worker-entrypoint `src/index.ts`
- custom domain
- D1-binding `AUTH_DB`
- `workers_dev=false`
- `preview_urls=false`
- observability
- icke-hemliga client/runtimevars
- Secrets Store-bindings.

Känsliga värden ska inte skrivas in direkt i filen.

## D1 och deployscript

`npm run deploy` kör appens `scripts/deploy.ts`.

Deployflödet ska vara fail-closed:

1. fastställ D1-resursen;
2. verifiera entydigt databas-ID;
3. rendera temporär Wrangler-konfiguration när runtime kräver konkret ID;
4. applicera versionsstyrda migrationer;
5. deploya samma Worker-konfiguration;
6. radera temporär config även vid fel.

Ett oklart eller saknat resource-ID ska stoppa deployen i stället för att gissas.

## Migrationer

Migrationer ligger i `migrations/`.

Better Auth-schema genereras/versioneras i appkatalogen. Runtime ska inte skapa ett parallellt oversionerat schema.

Vid schemaändring:

1. generera eller skriv migrationen enligt appens modell;
2. verifiera lokalt/med test;
3. kontrollera deploymentordning;
4. applicera migration före den Worker-version som kräver den.

## Runtime secrets

Auth signing, upstream provider secrets, intern administration och länkade providercredentials ska tillhandahållas genom avsedd secretmekanism.

Inga secretvärden ska:

- committas,
- läggas i README/docs,
- skrivas till logg,
- bakas in i statiska assets.

## Callback och discovery

Publika callback-/discoveryvägar måste överensstämma med authimplementationens issuer/base URL.

Efter protocoländring ska en testklient verifiera:

- discovery,
- JWKS,
- Authorization Code + PKCE,
- state/nonce,
- ID-token issuer/audience/signatur,
- UserInfo/refresh/revoke/logout när respektive funktion berörs.

## Rollout

Migrera konsumtionsklienter stegvis. En fungerande identitetsväg ska inte tas bort förrän ersättaren är verifierad.

Detta är en klientmigrationsprincip; specifika externa policy-ID:n eller privata runbooks ska dokumenteras utanför den versionsstyrda appdokumentationen.
