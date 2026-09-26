---
layout: default
title: Säkerhet
permalink: /security/
---

# Säkerhet

## Hård gräns: read-only

Skvallerbyttan observerar GitHub och Cloudflare men administrerar dem inte. Observationslagret får inte lägga till write-permissions för att kringgå en providerbegränsning.

Det innebär bland annat att Skvallerbyttan inte kan ändra rulesets, Actions policies, Custom Properties, repository settings, security configurations, Workers, Zero Trust, DNS, Cloudflare policies eller secrets.

GitHub-providerobservationer använder endast read-behörigheter. Administration read är tillåtet när det är miniminivån; provider-write ingår inte i observationslagret.

## Interaktiv auth

Dashboarden använder GitHub OAuth direkt:

- scope `read:user`
- OAuth state
- PKCE S256
- allowlist med numeriska GitHub-ID:n
- `__Host-` cookies med `HttpOnly`, `Secure`, `SameSite=Lax`
- signerad lokal session med högst 12 timmars TTL

OAuth-token används endast för identitetsuppslag och lagras inte.

## Machine read API

`/api/v1/*` kan autentiseras med vanlig dashboard-session eller med en separat bearer-secret i `SKVALLERBYTTAN_READ_API_TOKEN`. Det finns inga separata legacy dashboard-API-routes utanför det versionerade kontraktet.

Machine-token:

- ger endast GET-access till `/api/v1/*`
- ger inte assets/dashboard-session
- attribueras consumer `chatgpt`
- ska lagras som Worker secret
- returneras aldrig av något API

Alla API-responser använder privata/no-store cacheheaders.

## GitHub provider auth

Provider-readkoden använder `GAMNACKEN_GITHUB_APP_CLIENT_ID` och `GAMNACKEN_GITHUB_APP_PRIVATE_KEY` som GitHub App-bindings. Workflow/runtime-kontraktet refererar till dessa namn; faktisk App-installation och credentialprovisionering är extern state.

GitHub App client secret används inte i installation-auth-flödet. Worker skapar App-JWT och kortlivade installation tokens från de konfigurerade GitHub App-bindings. Providerpermissions ska följa minsta möjliga read-nivå; se [Permissions]({{ '/permissions/' | relative_url }}).

## Cloudflare provider auth

Cloudflare-providerreads använder tre separata read-klasser enligt Skvallerbyttans repo-deklarerade credentialmodell:

- **R1:** platform/resource reads.
- **R2:** analytics/observability/operations reads.
- **R3:** security/identity reads.

Klasserna är partitionerade och rangordnade utan arv. Ett R3-token ersätter därför inte R1 eller R2.

Worker-runtime får `CLOUDFLARE_API_TOKEN_R1`, `CLOUDFLARE_API_TOKEN_R2` och `CLOUDFLARE_API_TOKEN_R3` som Cloudflare Secrets Store-bindings. Koden hämtar värdet asynkront via bindingens `get()` och har ingen generisk Cloudflare-tokenfallback. De bundna secreten ska vara scope:ade för `workers`.

Produktionsdeploy och explicit secret-sync använder W1 som operationscredential genom `CLOUDFLARE_API_TOKEN_W1`. W1 distribueras inte till observationsruntime som providercredential. Deploycredentialen behöver de rättigheter som Cloudflare kräver för de operationer workflowen kör; faktisk tokenpermission-state dokumenteras inte här.

Observationskoden får inte använda W1/O1 som fallback vid 403. En saknad providerpermission ska i stället rapporteras som capability-/permission-state.

Skvallerbyttan läser inte D1-tabellinnehåll, KV values eller R2 object content som del av observationsinventeringen.

## Raw-data-policy

Provideradapters får läsa providerresponser internt men externa modeller minimeras.

API:t får inte returnera:

- token- eller secret-värden
- privata nycklar
- Authorization headers
- webhook-secrets
- Worker secret bindings
- KV values eller R2 object contents
- upptäckta secret-scanning-hemligheter
- råa Audit Log request/response payloads
- Cloudflare Audit actor IP/token metadata

Audit Log-normalisering har regressionstest för dessa gränser.

## Webhooks

### GitHub

`/webhooks/github` kräver POST, det befintliga Worker-secretet `SKVALLERBYTTAN_WEBHOOK_SECRET` och giltig `X-Hub-Signature-256`. **Runtimekontraktet för extern GitHub-eventingress är signerade provider-webhooks vars owner, när den finns i payloaden, måste matcha current owner-konfigurationen.** Gamnacken används i koden för read-auth; faktisk webhookkonfiguration måste verifieras i GitHub. Som migrationsskydd känner runtime primärt igen GitHub App-ingress via `X-GitHub-Hook-Installation-Target-Type: integration`, med top-level `installation` som fallback, och kvitterar den som pensionerad ingress utan att skriva Activity, cache, säkerhetsledger eller en extra warning-logg per leverans. Övriga leveranser måste fortfarande passera HMAC-verifieringen; skyddet accepterar alltså inte en alternativ secret. Delivery-ID dedupliceras innan ledger/cache uppdateras. Koden centraliserar GitHub-eventhantering i Skvallerbyttan och skickar docs-relevanta signaler vidare internt. Docs-relevanta events skickas efter providerverifiering genom den interna Cloudflare Service Bindingen `AVKROKEN_PORTAL_DOCS` till portalens namngivna RPC-entrypoint. Service Bindingen kräver ingen separat secret och är inte en publik HTTP-endpoint.

### Cloudflare

`/webhooks/cloudflare/notifications` och `/webhooks/cloudflare/casb` är runtime-endpoints för Cloudflare-händelser från dessa mekanismer; faktisk providerkonfiguration är extern state. Befintliga Worker secrets återanvänds: Notifications använder `CLOUDFLARE_NOTIFICATIONS_WEBHOOK_SECRET` och verifierar `cf-webhook-auth`; CASB använder `CLOUDFLARE_CASB_WEBHOOK_SECRET` och verifierar den statiska headern `x-skvallerbyttan-casb-auth`.

Godtyckliga webhookpayloads lagras inte. Endast explicit normaliserad metadata går till D1.

## Operativ heartbeat

Liveness och readiness går outbound från Skvallerbyttan via den interna Service Bindingen `AVKROKEN_OPERATIONS`. Ingen publik health-endpoint behöver undantas från Bot Fight Mode, WAF eller andra edge-skydd.

Heartbeatpayloaden är explicit reducerad till tjänstenamn, tidsstämpel, ready-boolean och booleska resultat för namngivna readiness-kontroller. Den innehåller inga tokenvärden, privata nycklar, providerpayloads eller headers. Mottagaren använder sin egen mottagningstid som liveness-evidens.

## Public/private boundaries

Publikt routbara auth/protokollendpoints:

- `/login`
- OAuth callback/start/logout
- verifierade webhookendpoints

Dashboard-assets och API-state är privata. Svar sätter `noindex`/säkerhetsheaders; noindex är inte access control.

## Logging

Fel loggas utan credentials. Capability `lastError` klipps och ska innehålla status/orsak, inte providerrawdata eller secret material.
