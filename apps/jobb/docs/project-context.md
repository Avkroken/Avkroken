# Jobb project context

Det här dokumentet är den app-specifika, versionsstyrda tekniska kontexten för `Avkroken/Avkroken` / `apps/jobb`.

**Senast verifierad mot repositoryt:** 2026-09-24

## Auktoritet och läsordning

Vid konflikt för repo-specifik teknik gäller följande ordning:

1. Filer på aktuell `main` i `Avkroken/Avkroken`, under `apps/jobb`.
2. Versionerade D1-migrationer och runtimekonfiguration i repositoryt.
3. Publika upstream-kontrakt för de externa API:er och tjänster implementationen använder.
4. Det här dokumentet.
5. Äldre pull requests, issues och historik.

Organisationsgemensamma standarder finns i `docs/organization/` i `Avkroken/Avkroken`, men externa GitHub-/Cloudflare-inställningar är inte repo-local current-state och kopieras inte hit. Historik hör hemma i Git.

## Syfte och säkerhetsgräns

Jobb automatiserar ett begränsat jobbsöknings- och aktivitetsrapporteringsflöde med StudentConsulting och Arbetsförmedlingen.

Systemets hårda mål är **10 verifierade lämpliga ansökningar per kalendermånad**. Det är ett tak i automationsflödet, inte bara en dashboard-mätare.

Viktiga säkerhetsgränser:

- StudentConsulting-autosubmit är fail-closed och kräver både explicit lämplighetspolicy och `STUDENTCONSULTING_AUTOSUBMIT=true`.
- En ansökan räknas inte som verifierad förrän exakt StudentConsulting Jobb-ID återfinns i `Ansökningar`.
- D1 har exakt tio quota-slots per månad. Ett osäkert submit-resultat behåller sin slot som `uncertain`; systemet kompenserar inte med en potentiell elfte ansökan.
- BankID/e-identifikation automatiseras aldrig. Användaren genomför den själv i Cloudflare Browser Run Live View.
- Arbetsförmedlingens rapportflöde är idempotent runt externa Save/Submit-side effects och återupprepar inte ett osäkert side effect blint.
- Obligatoriska handlingsplanfrågor besvaras inte automatiskt när ett säkert svar saknas.
- Credentials, Browser Run-sessioner och hemligheter ska inte exponeras i publika dokument, dashboarddata eller loggar.

## Runtime-arkitektur

Primär runtime är Cloudflare Worker `jobb` med entrypoint `apps/web/src/index.ts`.

Appens root-`wrangler.jsonc` är deployment-konfigurationen och binder:

- Browser Run som `BROWSER`.
- D1-databasen `jobb` som `DB`.
- R2-bucketen `jobb-evidence` som `EVIDENCE`.
- Cloudflare Email som `EMAIL`.
- Workflow `jobb-automation`, klass `JobAutomationWorkflow`, som `JOB_AUTOMATION`.
- Cron `0 9 10-13 * *`.
- Custom domain `jobb.denied.se`.

Workspace använder pnpm 10.17.1. Root-skripten kör repoövergripande typecheck/test och produktionens deploykommando applicerar D1-migrationer före Wrangler deploy.

## Körningsmodell

### Manuell körning

Den skyddade dashboarden kan starta samma pipeline manuellt under den 1:a–14:e varje månad i `Europe/Stockholm`.

Manuell start kräver:

1. dashboard-autentisering,
2. same-origin mutation,
3. giltig Cloudflare Turnstile-token för action `manual_run`,
4. öppet applikationsfönster.

### Automatisk säkerhetskörning

Cron kör en gång per dag den **10:e–13:e** vid `09:00 UTC`.

- Den 10:e är normal autonom körning.
- Den 11:e–13:e används endast som retry när månadens stabila `scheduled:YYYY-MM` fortfarande är `failed`.
- `completed`, `running` eller `needs_user_auth` startas inte om.
- Ingen autonom jobbsökning körs den 14:e eller den 15:e–månadens slut.

## Data och state

D1-migrationerna är canonical schemahistorik:

- `0001_initial.sql` — jobb, ansökningar, attempts, evidence och reports.
- `0002_automation.sql` — automation runs och notifieringshistorik.
- `0003_integration_probes.sql` — sanitiserade metadata för autentiserade integrationsprobes.
- `0004_monthly_application_quota.sql` — exakt tio quota-slots per månad.
- `0005_activity_report_submission.sql` — idempotent state för rapportaktiviteter.

Centrala stateflöden:

- application: `queued → applying → submitted → verified`, med `failed` och `needs_user_action` som explicita avvikelser.
- application attempt: `started → submitted|verified|failed|unknown`.
- quota slot: `free → reserved → submitted|verified|uncertain`.
- report activity: `pending → save_attempted → saved`.
- report: `collecting → ready → needs_user_auth|submitting → submitted`, med `failed` som felstate.
- automation run: `running → needs_user_auth|completed|failed`.

## Evidens

Verifierad StudentConsulting-evidens skrivs som JSON till privata R2-bucketen `jobb-evidence`. D1-tabellen `evidence` lagrar metadata och R2 object key.

Schemafältet `evidence.sha256` finns men fylls **inte** av nuvarande lagringsväg. Det ska därför inte beskrivas som ett aktivt integritetsskydd förrän hashing faktiskt implementerats och verifierats.

Dashboarden visar evidence-metadata men är inte en generell R2 object-browser.

## StudentConsulting

StudentConsulting-integrationen använder Browser Run för autentisering, discovery, formulärkontroll, submission och verifiering.

Autonom submission kräver:

- runtime credentials,
- `STUDENTCONSULTING_AUTOSUBMIT=true`,
- minst ett explicit `JOB_INCLUDE_TERMS`,
- att jobbkandidaten passerar allow/exclude/location/country-policy,
- ett säkert och entydigt formulärläge,
- en quota-slot innan submit-side effect.

Ett definitivt misslyckande kan frigöra en reserverad slot. Ett osäkert resultat behåller sloten för att förhindra dubbel/elfte ansökan.

## Arbetsförmedlingen

Den publika JobSearch-integrationen är read-only och används för jobbdata.

Aktivitetsrapportering använder en separat autentiserad Browser Run-session:

1. systemet startar en handoff till Mina sidor,
2. användaren genomför BankID/e-identifikation,
3. systemet verifierar autentiserat state,
4. en sanitiserad form-probe verifierar den faktiska UI-strukturen,
5. exakt tio verifierade ansökningar från föregående månad laddas,
6. occupation löses fail-closed via JobTech Taxonomy,
7. aktiviteter sparas idempotent,
8. slutlig rapportsubmission verifieras före `submitted`.

Probe-lagring får beskriva formulärstruktur men ska inte lagra användarens ifyllda inputvärden.

## Dashboard och API

Dashboarden på `/` är operativt kontrollplan. Repositoryts implementation använder Krösa-Maja som OIDC-provider och kräver komplett konfiguration för `KROSA_MAJA_OIDC_CLIENT_ID` och `KROSA_MAJA_OIDC_CLIENT_SECRET`; ofullständig konfiguration failar stängt.

Top-level-vyer:

- **Översikt** — månadsmål, rapportstate, blockers och alla tio quota-slots.
- **Ansökningar** — filtrerbar ansökningshistorik, fel, run-koppling och evidence-count.
- **Körningar** — run history och read-only drill-down till applications, attempts, evidence, notifications och probe-state.
- **Aktivitetsrapport** — rapportstatus och per-aktivitet `pending/save_attempted/saved`.
- **System** — konfigurationsstatus och notifieringshistorik utan credential-värden.

Primära endpoints:

- `GET /login` — publik, mobilanpassad login-sida för Krösa-Maja med samma mörka visuella språk som dashboarden.
- `GET /auth/start` — startar Authorization Code + PKCE mot Krösa-Maja.
- `GET /auth/callback` — exakt OIDC callback för `jobb.denied.se`.
- `POST /auth/logout` — rensar den lokala Jobb-sessionen; kräver autentiserad same-origin request.
- `GET /api/health` — minimal liveness.
- `GET /api/ready` — minimal readiness; läser `SELECT 1` från D1 och verifierar att dashboard-auth är faktiskt användbar. När OIDC är aktivt läses Secrets Store-bindingen för klienthemligheten, men inga credential-värden returneras och inga externa provideranrop görs.
- `GET /api/dashboard` — canonical dashboard read model.
- `GET /api/runs/:id` — read-only run-detail.
- `POST /api/runs/manual` — manuell Workflow-start.
- `POST /api/runs/:id/bankid/check` — fortsätter säkert det autentiserade AF-flödet.
- `GET /api/jobs/search` — read-only JobSearch.

Alla skyddade mutationer kräver exakt same-origin `Origin`; inkompatibel `Sec-Fetch-Site` avvisas också när headern finns. Detta är ett extra CSRF-skydd ovanpå dashboard-auth. Manuell run kräver dessutom Turnstile.

Dashboard-CSP tillåter egna scripts/styles samt Turnstile från `https://challenges.cloudflare.com`; `unsafe-inline` används inte.

Login- och browser-felsidor använder separat same-origin CSS på `/assets/auth.css`, strikt CSP utan inline-script och en gemensam felvy med sanitiserad felkod och korrelations-ID. OIDC-startfel klassas till konfiguration, provider/transport, metadata eller oväntat fel utan att credentials exponeras.

## Runtime configuration

Hemliga värden ligger i Cloudflare/runtime och får aldrig committas.

Credential-/security-namn:

- `KROSA_MAJA_OIDC_CLIENT_SECRET` — utfärdas av Krösa-Maja för Jobbs konfidentiella webklient; produktion läser värdet via Cloudflare Secrets Store-binding medan lokal utveckling kan använda en vanlig runtime-sträng
- `TURNSTILE_SECRET`
- `STUDENTCONSULTING_EMAIL`
- `STUDENTCONSULTING_PASSWORD`

Icke-hemliga eller policyrelaterade runtime-värden:

- `KROSA_MAJA_OIDC_CLIENT_ID` — icke-hemligt client ID från Krösa-Majas server-side klientregistrering
- `TURNSTILE_HOSTNAMES`
- `STUDENTCONSULTING_AUTOSUBMIT`
- `JOB_INCLUDE_TERMS`
- `JOB_EXCLUDE_TERMS`
- `JOB_ALLOWED_LOCATIONS`
- `JOB_ALLOWED_COUNTRIES`
- `NOTIFY_EMAIL_TO`
- `NOTIFY_EMAIL_FROM`
- `NOTIFY_WEBHOOK_URL`
- `PUBLIC_BASE_URL`

Notifiering kan använda Email binding och/eller HTTPS-webhook.

## Auth, request-säkerhet och privacy

Krösa-Maja (`https://auth.denied.se`) är vald som Jobbs centrala OpenID Connect-provider. Jobb är en konfidentiell webklient med Authorization Code + PKCE S256 och scopes `openid profile email`. Callback är exakt `https://jobb.denied.se/auth/callback`. ID-token valideras mot Krösa-Majas RS256-JWKS inklusive issuer, audience, authorized party, expiry, issued-at, not-before och nonce. Access- och refresh-token lagras inte. Jobb skapar i stället en lokal 12-timmars `__Host-jobb_session` som HMAC-signeras med en HKDF-separerad nyckel härledd från klienthemligheten. Login-state ligger separat i signerad `__Host-jobb_oidc`-cookie med högst tio minuters livstid.

OIDC är fail-closed och enda dashboard-authvägen: komplett OIDC-konfiguration krävs, och saknad eller halvkonfigurerad klient ger fel i auth/readiness. Produktionshemligheten binds från Cloudflare Secrets Store under namnet `KROSA_MAJA_OIDC_CLIENT_SECRET`, medan client ID ligger som icke-hemlig Worker-var. Legacy Basic Auth accepteras inte av koden.

Turnstile används på user-triggered manuell körning och valideras server-side mot secret, action och tillåtet hostname.

Dashboardens mutationsendpoints har same-origin-kontroll. UI-responsen sätter CSP, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `frame-ancestors 'none'` och `Cache-Control: no-store`.

Wrangler sätter `observability.redact_query_string=true` innan OIDC aktiveras. Det är ett krav eftersom OIDC-callbacken bär kortlivade `code`/`state` i query-strängen och de inte ska persisteras i Worker-logs/traces.

## Verifiering och deployment

Repositoryts versionerade verifieringsväg är:

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
```

Appens root-`package.json` definierar produktionskommandot:

```bash
pnpm deploy:cloudflare
```

Kommandot applicerar remote D1-migrationer och deployar därefter Workern med root-`wrangler.jsonc`.

Vilket externt CI/CD-system som eventuellt kör kommandona är inte repo-local current-state och dokumenteras inte här.

## Ändringskontrakt

Uppdatera detta dokument när någon av följande ändras:

- körningsfönster, cron eller månadsquota,
- provider-/BankID-/rapportflöde,
- D1/R2 state eller migrations,
- dashboard/API-surface,
- auth, Turnstile, same-origin-regler eller CSP,
- Cloudflare bindings/resources/deploymentmodell,
- repositoryts test-/deployscripts och versionerade runtimekonfiguration,
- evidensmodell eller integrity semantics,
- observability/privacy-state som påverkar vad som kan hamna i loggar.

Materiella ändringar i security boundary, permissions eller deploymentarkitektur ska förankras innan implementation. Extern governance/live-state verifieras i sitt auktoritativa system och ska inte dupliceras som permanent repo-current-state.
