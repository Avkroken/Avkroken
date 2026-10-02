# Jobb project context

Det här dokumentet är den app-specifika, versionsstyrda tekniska kontexten för `Avkroken/Avkroken` / `apps/jobb`.

**Senast verifierad mot repositoryt:** 2026-10-02

## Auktoritet och läsordning

Vid konflikt för repo-specifik teknik gäller följande ordning:

1. Filer på aktuell `main` i `Avkroken/Avkroken`, under `apps/jobb`.
2. Versionerade D1-migrationer och runtimekonfiguration i repositoryt.
3. Publika upstream-kontrakt för de externa API:er och tjänster implementationen använder.
4. Det här dokumentet.
5. Äldre pull requests, issues och historik.

`docs/organization/` innehåller delad kontext för `Avkroken/Avkroken`-monorepot. Jobbs app-local current-state ägs av `apps/jobb`, medan extern GitHub-/Cloudflare-live-state verifieras hos respektive provider. Historik hör hemma i Git.

## Syfte och säkerhetsgräns

Jobb automatiserar ett begränsat jobbsöknings- och aktivitetsrapporteringsflöde med StudentConsulting och Arbetsförmedlingen.

Systemets hårda mål är **10 verifierade lämpliga ansökningar per kalendermånad**. Det är ett tak i automationsflödet, inte bara en dashboard-mätare.

Viktiga säkerhetsgränser:

- StudentConsulting-autosubmit är fail-closed och kräver `STUDENTCONSULTING_AUTOSUBMIT=true`. Efter login återbesöks den autentiserade svenska landningssidan och jobbmatchningsnavigation identifieras semantiskt via etablerade **Matcha jobb**-varianter samt explicita former av `Jobbmatchning(ar)` och `Matchning(ar) mot jobb`; orelaterade etiketter accepteras inte. En vanlig länk måste använda exakt origin `https://www.studentconsulting.com`, sakna URL-credentials och stanna under `/sv/min-profil/`. Om sådan ankarlänk saknas får en enda entydig synlig button/role-link/data-navigation-kontroll aktiveras, men destinations-URL:en måste efter klick passera samma origin-/profilvalidering. Saknad/otillåten/ambivalent matchningsnavigation stoppar körningen och ingen hårdkodad profilfallback används. Vid saknad träff får diagnostik endast exponera högst 20 same-origin `/sv/min-profil/...`-paths, aldrig etiketter, profiltext, queryvärden eller inputvärden. Synliga login-kontroller kontrolleras efter auth, profilöppning och varje listing-navigation. Okänd vald matched-page-struktur rapporterar endast sanerade elementräknare. Land enrichas från StudentConsultings publika jobb-API med explicita landsfilter för Sverige/Norge/Danmark när detaljsidan saknar `Land`; olöst eller ambivalent land stoppar kandidaten före autosubmit.
- En ansökan räknas inte som verifierad förrän exakt StudentConsulting Jobb-ID återfinns i `Ansökningar`.
- D1 har exakt tio quota-slots per månad. Ett osäkert submit-resultat behåller sin slot som `uncertain`; systemet kompenserar inte med en potentiell elfte ansökan.
- BankID/e-identifikation automatiseras aldrig. Användaren genomför den själv i Cloudflare Browser Run Live View.
- Arbetsförmedlingens rapportflöde är idempotent runt externa Save/Submit-side effects och återupprepar inte ett osäkert side effect blint.
- Obligatoriska handlingsplanfrågor besvaras inte automatiskt när ett säkert svar saknas.
- Credentials, Browser Run-sessioner och hemligheter ska inte exponeras i publika dokument, dashboarddata eller loggar.

## Runtime-arkitektur

Primär runtime är Cloudflare Worker `jobb` med entrypoint `apps/web/src/index.ts`.

Appens `apps/jobb/wrangler.jsonc` är deployment-konfigurationen och binder:

- Browser Run som `BROWSER`.
- D1-databasen `jobb-eu` som `DB`.
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

1. GitHub-dashboardautentisering,
2. exakt same-origin mutation guard,
3. konfigurerat StudentConsulting-konto med autosubmit aktiverat,
4. öppet applikationsfönster.

Starten gör därefter en atomisk D1-claim: högst en `running`/`needs_user_auth` automation får finnas åt gången över manuella och schemalagda starter. Run-raden skapas eller, för en failed schemalagd retry, återställs till ett rent `running`-state innan Workflow startas. Workflow-ID länkas både direkt efter create och som första Workflow-step. Startfel och Workflow-undantag skrivs tillbaka som `failed`; gamla `running`-rader utan Workflow-länk eller ansökningsaktivitet klassas/reconcileras som orphaned efter fem minuter. Utgångna eller ogiltiga `needs_user_auth`-handoffs reconcileras till `failed` före ny claim och räknas inte som aktiva i dashboarden efter `auth_expires_at`.

### Automatisk säkerhetskörning

Cron kör en gång per dag den **10:e–13:e** vid `09:00 UTC`.

- Den 10:e är normal autonom körning.
- Den 11:e–13:e används endast som retry när månadens stabila `scheduled:YYYY-MM` fortfarande är `failed`.
- `completed`, `running` eller `needs_user_auth` startas inte om.
- Ingen autonom jobbsökning körs den 14:e eller den 15:e–månadens slut.

## Data och state

Produktionsbindingen `DB` ska peka på en D1-databas som skapats med Cloudflare-jurisdiction `eu`. Jurisdiction är creation-time providerkonfiguration och ska verifieras i Cloudflare när databasen ersätts; repositoryts UUID/name-binding är inte i sig bevis på data locality.

D1-migrationerna är canonical schemahistorik:

- `0001_initial.sql` — jobb, ansökningar, attempts, evidence och reports.
- `0002_automation.sql` — automation runs och notifieringshistorik.
- `0003_integration_probes.sql` — sanitiserade metadata för autentiserade integrationsprobes.
- `0004_monthly_application_quota.sql` — exakt tio quota-slots per månad.
- `0005_activity_report_submission.sql` — idempotent state för rapportaktiviteter.
- `0006_runtime_configuration.sql` — krypterad dashboard-hanterad runtimekonfiguration.

Centrala stateflöden:

- application: `queued → applying → submitted → verified`, med `failed` och `needs_user_action` som explicita avvikelser.
- application attempt: `started → submitted|verified|failed|unknown`.
- quota slot: `free → reserved → submitted|verified|uncertain`.
- report activity: `pending → save_attempted → saved`.
- report: `collecting → ready → needs_user_auth|submitting → submitted`, med `failed` som felstate.
- automation run: atomisk claim till `running → needs_user_auth|completed|failed`; en failed schemalagd retry nollställer tidigare completion/error/auth/workflow-fält innan nytt Workflow startas. Dashboarden visar äldre oanslutna `running`-rader som `orphaned` i stället för som verkligt aktiva.

## Evidens

Verifierad StudentConsulting-evidens skrivs som JSON till privata R2-bucketen `jobb-evidence`. D1-tabellen `evidence` lagrar metadata och R2 object key.

Schemafältet `evidence.sha256` finns men fylls **inte** av nuvarande lagringsväg. Det ska därför inte beskrivas som ett aktivt integritetsskydd förrän hashing faktiskt implementerats och verifierats.

Dashboarden visar evidence-metadata men är inte en generell R2 object-browser.

## StudentConsulting

StudentConsulting-integrationen använder Browser Run för autentisering, discovery, formulärkontroll, submission och verifiering. Discovery läser navigationsvärden från `href`, `data-href`, `data-url` och inline `onclick` på den verifierade Matcha-jobb-vyn. Absoluta URL:er behåller sin ursprungliga authority vid validering; endast betrodda StudentConsulting-rutter av formen `/sv/lediga-jobb/.../<Jobb-ID>` får bli kandidater.

Autonom submission kräver:

- runtime credentials,
- `STUDENTCONSULTING_AUTOSUBMIT=true`,
- att kandidaten kommer från den autentiserade **Matcha jobb**-vyn,
- att jobbkandidaten passerar eventuella extra include/exclude/location/country-filter,
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

Dashboarden på `/` är operativt kontrollplan. Repositoryts implementation använder GitHub OAuth direkt och kräver komplett konfiguration för `GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET` och `JOBB_ALLOWED_GITHUB_IDS`; ofullständig konfiguration failar stängt.

Dashboarden erbjuder `legacy`, `forest` (visas som **Avkroken**) och `blackout` med Legacy som fallback. Legacy bygger på Portalens faktiska pre-v2 Avkroken-uttryck med cyan/blå/magenta glow och diskret rutnät; de cyan/gröna operativa accenterna förblir Jobb-specifika. Dashboarden persisterar samma presentationspreferens som övriga monorepoappar; login-sidan kan läsa `avkroken_theme` server-side för visuell kontinuitet, men cookien är aldrig auth-, CSRF- eller sessionsstate.

Top-level-vyer:

- **Översikt** — månadsmål, rapportstate, blockers och alla tio quota-slots.
- **Ansökningar** — filtrerbar ansökningshistorik, fel, run-koppling och evidence-count.
- **Körningar** — run history och read-only drill-down till applications, attempts, evidence, notifications och probe-state.
- **Aktivitetsrapport** — rapportstatus och per-aktivitet `pending/save_attempted/saved`.
- **System** — konfigurationsstatus, skyddad konfigurationseditor och notifieringshistorik. Skrivkänsliga hemligheter visas aldrig igen efter sparning.

Primära endpoints:

- `GET /login` — publik, mobilanpassad GitHub-login-sida med samma mörka visuella språk som dashboarden.
- `GET /auth/start` — startar GitHub Authorization Code + PKCE S256.
- `GET /auth/callback` — exakt GitHub OAuth callback `https://jobb.denied.se/auth/callback`.
- `POST /auth/logout` — rensar den lokala Jobb-sessionen; kräver autentiserad same-origin request.
- `GET /api/health` — minimal liveness.
- `GET /api/ready` — minimal readiness; läser `SELECT 1` från D1 och verifierar att dashboard-auth är faktiskt användbar. När GitHub OAuth är aktivt läses Secrets Store-bindingen för klienthemligheten, men inga credential-värden returneras och inga externa provideranrop görs.
- `GET /api/dashboard` — canonical dashboard read model utan hemliga credential-värden.
- `POST /api/configuration` — same-origin, autentiserad write av dashboard-hanterad krypterad runtimekonfiguration.
- `GET /api/runs/:id` — read-only run-detail.
- `POST /api/runs/manual` — manuell Workflow-start.
- `POST /api/runs/:id/stop` — terminerar en aktiv Workflow-instans och finaliserar runnen som manuellt stoppad.
- `DELETE /api/runs/:id` — raderar terminal run utan ansökningshistorik samt run-bundna probes/notifications och Workflow-state.
- `POST /api/runs/:id/bankid/check` — fortsätter säkert det autentiserade AF-flödet.
- `GET /api/jobs/search` — read-only JobSearch.

Alla skyddade mutationer kräver exakt same-origin `Origin`; inkompatibel `Sec-Fetch-Site` avvisas också när headern finns. Detta är ett extra CSRF-skydd ovanpå dashboard-auth. Manuell run, stop och delete kräver samma GitHub-auth och same-origin-skydd.

Dashboard-CSP tillåter endast egna scripts/styles/connect-källor; `unsafe-inline` används inte och ingen extern Turnstile-scriptkälla behövs.

Login- och browser-felsidor använder separat same-origin CSS på `/assets/auth.css`, strikt CSP utan inline-script och en gemensam felvy med sanitiserad felkod och korrelations-ID. GitHub OAuth-startfel klassas utan att credentials exponeras.

## Runtime configuration

Hemliga värden får aldrig committas. Produktionsvärden kan komma från Cloudflare/runtime eller, för de fält som dashboarden hanterar, från den krypterade D1-raden `runtime_configuration`. Deployment-värden har alltid företräde framför dashboard-värden.

Credential-/security-namn:

- `GITHUB_OAUTH_CLIENT_SECRET` — GitHub OAuth-klienthemligheten; produktion läser värdet via Cloudflare Secrets Store-binding medan lokal utveckling kan använda en vanlig runtime-sträng
- `STUDENTCONSULTING_EMAIL`
- `STUDENTCONSULTING_PASSWORD`

Icke-hemliga eller policyrelaterade runtime-värden:

- `GITHUB_OAUTH_CLIENT_ID` — icke-hemligt GitHub OAuth client ID
- `JOBB_ALLOWED_GITHUB_IDS` — numeriska GitHub-ID:n som får använda dashboarden
- `STUDENTCONSULTING_AUTOSUBMIT`
- `JOB_INCLUDE_TERMS` — valfritt extra positivt filter ovanpå **Matcha jobb**
- `JOB_EXCLUDE_TERMS`
- `JOB_ALLOWED_LOCATIONS`
- `JOB_ALLOWED_COUNTRIES`
- `NOTIFY_EMAIL_TO`
- `NOTIFY_EMAIL_FROM`
- `NOTIFY_WEBHOOK_URL`
- `PUBLIC_BASE_URL`

Notifiering kan använda Email binding och/eller HTTPS-webhook.

Den autentiserade System-vyn kan spara StudentConsulting-konto, autosubmit, valfria extra lämplighetsfilter och notifieringsinställningar. Manuell körning skyddas av GitHub-dashboardens session och exact same-origin mutation guard; Jobb bäddar inte in eller kräver Turnstile. Det dashboard-hanterade dokumentet krypteras med AES-GCM innan D1-write; krypteringsnyckeln härleds med separat HKDF-context från den befintliga GitHub OAuth-klienthemligheten. StudentConsulting-lösenord och webhook-URL returneras aldrig efter sparning. Vid rotation av OAuth-klienthemligheten måste dashboard-konfigurationen sparas om eftersom gammal ciphertext inte kan dekrypteras med den nya nyckeln.

## Auth, request-säkerhet och privacy

GitHub är Jobbs externa identity provider. Jobb använder Authorization Code + PKCE S256 med scope `read:user` och exakt callback `https://jobb.denied.se/auth/callback`. Access-tokenen används endast för `GET /user`, numeriskt GitHub-ID kontrolleras mot `JOBB_ALLOWED_GITHUB_IDS`, tokenen persisteras aldrig och revokeras best-effort efter uppslaget. Jobb skapar därefter en lokal 12-timmars `__Host-jobb_session` som HMAC-signeras med en HKDF-separerad nyckel härledd från OAuth-klienthemligheten. Login-state ligger separat i signerad `__Host-jobb_oauth`-cookie med högst tio minuters livstid.

GitHub OAuth är fail-closed och enda dashboard-authvägen: komplett klient-, secret- och allowlistkonfiguration krävs, och saknad eller halvkonfigurerad konfiguration ger fel i auth/readiness. Produktionshemligheten binds från Cloudflare Secrets Store som `GITHUB_OAUTH_CLIENT_SECRET`; client ID och allowlist ligger som icke-hemliga Worker-vars. Legacy Basic Auth och OIDC-proxy accepteras inte av koden.

Manuell körning kräver en giltig GitHub-dashboard-session och exact same-origin mutation guard. Körningsdetaljer erbjuder stop för aktiva Workflow-instanser och delete för terminala testkörningar utan ansökningshistorik; körningar med ansökningshistorik kan inte raderas via dashboarden.

Dashboardens mutationsendpoints har same-origin-kontroll. UI-responsen sätter CSP, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `frame-ancestors 'none'` och `Cache-Control: no-store`.

Wrangler sätter `observability.redact_query_string=true`. Det är ett krav eftersom OAuth-callbacken bär kortlivade `code`/`state` i query-strängen och de inte ska persisteras i Worker-logs/traces.

## Verifiering och deployment

Appens versionerade verifieringsväg är:

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
```

`apps/jobb/package.json` definierar produktionskommandot:

```bash
pnpm deploy:cloudflare
```

Kommandot applicerar remote D1-migrationer och deployar därefter Workern med `apps/jobb/wrangler.jsonc`.

Vilket externt CI/CD-system som eventuellt kör kommandona är inte app-local current-state och dokumenteras inte här.

## Ändringskontrakt

Uppdatera detta dokument när någon av följande ändras:

- körningsfönster, cron eller månadsquota,
- provider-/BankID-/rapportflöde,
- D1/R2 state eller migrations,
- dashboard/API-surface,
- auth, same-origin-regler eller CSP,
- Cloudflare bindings/resources/deploymentmodell,
- repositoryts test-/deployscripts och versionerade runtimekonfiguration,
- evidensmodell eller integrity semantics,
- observability/privacy-state som påverkar vad som kan hamna i loggar.

Materiella ändringar i security boundary, permissions eller deploymentarkitektur ska förankras innan implementation. Extern governance/live-state verifieras i sitt auktoritativa system och ska inte dupliceras som permanent repo-current-state.
