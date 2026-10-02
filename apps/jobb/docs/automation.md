# Dashboard and monthly automation

`jobb` supports two execution modes that use the same idempotent application pipeline.

## Operational dashboard

The protected dashboard is the operational control plane for the automation. It has five top-level views:

- **Översikt** — monthly target, all ten quota slots, report state and active attention signals.
- **Ansökningar** — filterable applications with run linkage, latest diagnostics and evidence count.
- **Körningar** — run history with read-only drill-down to applications, attempts, evidence metadata, notifications and probe state.
- **Aktivitetsrapport** — report status and per-activity `pending`, `save_attempted` and `saved` state.
- **System** — runtime configuration status, a protected configuration editor and notification history; write-only secrets are never read back into the browser.

`GET /api/health` is minimal liveness. `GET /api/ready` performs only a read-only D1 `SELECT 1` plus a check that dashboard authentication is configured; it does not call external providers or expose credentials.

### Dashboard authentication

Jobb använder GitHub OAuth direkt som enda dashboard-login. Authorization Code-flödet använder state och PKCE S256 med exakt callback `https://jobb.denied.se/auth/callback` och scope `read:user`.

Authvägen är fail-closed:

- `GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET` och `JOBB_ALLOWED_GITHUB_IDS` krävs;
- saknad eller partiell konfiguration gör auth/readiness unavailable;
- legacy Basic Auth och OIDC-proxy accepteras inte;
- GitHub access-token används endast för `GET /user`, persisteras inte och revokeras best-effort;
- numeriskt GitHub-ID måste finnas i aktuell allowlist innan lokal signerad session skapas.

I produktion läses client secret via Cloudflare Secrets Store-bindingen `GITHUB_OAUTH_CLIENT_SECRET`. Client ID och allowlist är icke-hemliga Worker-vars. Real credential values får aldrig committas.

## Manual mode

The protected dashboard exposes **Kör nu** only during the active application window, the **1st–14th** of each calendar month in `Europe/Stockholm`. Outside that window the UI disables the action and the API rejects manual runs.

Manual start is protected by GitHub dashboard authentication and an exact same-origin mutation check; no second Turnstile challenge is embedded in Jobb. The same-origin guard is also applied to authenticated run stop/delete controls and the BankID continuation POST endpoint. A real active run disables a new manual start until the run leaves the active state.

The button atomically claims the D1 run only when no `running` or `needs_user_auth` run exists, so concurrent tabs and the scheduler cannot launch overlapping Workflows. It then starts a Cloudflare Workflow, immediately links the Workflow instance ID, and returns control to the browser; the Workflow also records its instance ID as its first persistent step. Workflow exceptions are persisted back to the run as `failed` before being rethrown to Cloudflare. Legacy running rows without a Workflow link or application activity are treated as orphaned after five minutes and are reconciled before a new run starts. Expired or malformed `needs_user_auth` BankID handoffs are reconciled to `failed` before the next claim and are excluded from the dashboard active-run model immediately after expiry. A failed stable scheduled run is reset to clean `running` state, including clearing stale error/completion/auth/workflow fields, as part of the same atomic claim before a retry is launched. Progress, failures, completed applications, quota state, notification state and BankID handoff state are displayed by the dashboard.

## Automatic safety mode

The low-traffic fallback runs **once per day on the 10th–13th**. Cloudflare Cron invokes the Worker at `09:00 UTC`, which is 10:00 CET or 11:00 CEST, safely inside the requested **10:00–20:00 Europe/Stockholm** window.

The 10th is the normal autonomous attempt. The 11th–13th are retries only when the stable monthly run (`scheduled:YYYY-MM`) is still `failed`. Completed, running, or BankID-waiting monthly runs are not restarted. There is no autonomous job-search traffic on the 14th or the 15th–end of month.

A scheduled run:

1. Counts already verified applications for the current calendar month.
2. Applies only to configured suitable StudentConsulting jobs.
3. Uses exactly ten D1 quota slots for the month; an 11th automatic submission cannot acquire a slot.
4. Never counts an application as verified until the exact StudentConsulting Jobb-ID is visible in `Ansökningar`.
5. During the 1st–14th reporting window, prepares the previous calendar month's activity report and starts the user-controlled BankID handoff.
6. Sends a notification when BankID is required.

## Exact monthly quota

`migrations/0004_monthly_application_quota.sql` creates ten slots for each month. A slot is reserved **before** StudentConsulting submission starts.

- A definitely failed submission releases its reservation.
- A confirmed submission keeps its slot.
- A verified submission marks its slot verified.
- An ambiguous/unknown result keeps the slot as `uncertain` rather than allowing a replacement application that could accidentally become number 11.

This is deliberately fail-closed: the automation will never knowingly submit more than ten jobs in a calendar month. If an external site leaves the result ambiguous, the dashboard reports the problem and blocks additional submissions until it is resolved.

## Error diagnostics

Application attempts persist a machine-readable `error_code` plus the provider's error message. The dashboard renders the failure stage and reason, for example:

- `APPLICATION_FAILED` — StudentConsulting rejected or failed the application.
- `APPLICATION_UNKNOWN` — submission outcome could not be determined safely.
- `VERIFICATION_FAILED` — submission was reported, but the exact Jobb-ID was not found in `Ansökningar`.
- `UNEXPECTED_APPLICATION_ERROR` — browser/provider automation raised an unexpected error.

Run-level and Arbetsförmedlingen probe errors are also persisted and shown separately.

## Required runtime secrets/configuration

Secrets must never be committed to the public repository. Deployment/runtime values remain authoritative. For the fields exposed in the authenticated System view, missing deployment values may instead come from the AES-GCM-encrypted D1 runtime configuration.

```text
GITHUB_OAUTH_CLIENT_SECRET      # Cloudflare Secrets Store in production; local string only for development
STUDENTCONSULTING_EMAIL
STUDENTCONSULTING_PASSWORD
```

`GITHUB_OAUTH_CLIENT_ID` and `JOBB_ALLOWED_GITHUB_IDS` are non-secret runtime configuration.

Autonomous application submission additionally requires:

```text
STUDENTCONSULTING_AUTOSUBMIT=true
# Optional extra filter on top of StudentConsulting Matcha jobb:
JOB_INCLUDE_TERMS=supporttekniker,it-support,helpdesk
```

Optional suitability constraints:

```text
JOB_EXCLUDE_TERMS=chef,senior
JOB_ALLOWED_LOCATIONS=Stockholm,Uppsala
JOB_ALLOWED_COUNTRIES=SE
```

After StudentConsulting login, the engine revisits the authenticated Swedish landing page and prefers the visible **Matcha jobb** navigation link when present. The visible link must normalize to StudentConsulting under `/sv/min-profil/`; missing, untrusted or ambiguous visible navigation fails closed. The canonical `/sv/min-profil/matcha-jobb/` route is used only when no matching navigation item is rendered. Visible login controls are rechecked after authentication, after opening the matched profile and after each listing navigation. Discovery accepts only strictly normalized StudentConsulting job-detail URLs from the verified page, including navigation exposed through `href`, `data-href`, `data-url` or inline `onclick`; absolute URLs retain their original authority for host validation, and discovery never falls back to the public jobs listing. An unrecognized first matched page reports only structural element counts for diagnostics and does not persist profile text or form values. Current job-detail pages do not consistently expose `Land`, so country is enriched from StudentConsulting's public job-search API using its explicit Sverige/Norge/Danmark country filters; unresolved or ambiguous country remains fail-closed. `JOB_INCLUDE_TERMS` is optional and acts only as an additional narrowing filter.

The protected System view can manage StudentConsulting credentials, autosubmit, optional extra suitability filters and BankID notification settings. Manual run start is already behind the authenticated GitHub dashboard session and exact same-origin mutation guard, so Jobb does not embed or require Turnstile. The StudentConsulting password and webhook URL are write-only from the browser's perspective and are never returned after saving. `POST /api/configuration` is authenticated, same-origin protected and stores one encrypted configuration document in D1.

## BankID notifications

Email notifications use the Cloudflare `EMAIL` binding plus:

```text
NOTIFY_EMAIL_TO=user@example.com
NOTIFY_EMAIL_FROM=jobb@example.com
PUBLIC_BASE_URL=https://jobb.example.com
```

An optional generic HTTPS webhook can be configured with:

```text
NOTIFY_WEBHOOK_URL=https://example.com/hooks/bankid
```

The notification links to the protected dashboard. It does not expose the ephemeral Browser Run Live View URL outside the authenticated dashboard.

## BankID and authenticated form discovery

The application can start and retain an Arbetsförmedlingen browser session and display the BankID handoff in the dashboard. The user must personally complete the BankID/e-identification step.

While a handoff is active, the dashboard shows an **Öppna BankID** action for the ephemeral Live View URL and a separate **Jag är klar – kontrollera** action. The dashboard may also poll the authenticated session, but it never performs the BankID step for the user. After BankID succeeds, a fail-closed integration probe navigates to the activity report and stores its **form schema**, not the user's entered values. The probe records items such as headings, input/select/button names, control types, list options and sanitized link paths. It never reads or stores input values.

The probe exists because the authenticated activity-report form is not publicly documented as a write API. The report adapter uses semantic labels/roles and the verified probe instead of guessing private endpoints.

After a successful BankID login, the adapter loads exactly ten verified applications from the previous month. It validates the application dates in Europe/Stockholm, includes the StudentConsulting Jobb-ID together with the employer name, resolves occupations through JobTech Taxonomy, marks international applications as outside Sweden, and fills Swedish locations through the structured location control.

Each activity is idempotent: D1 persists `pending → save_attempted → saved` before/after the external Save side effect. If Save returns an ambiguous result, the next pass first checks whether the exact Jobb-ID is already present and never blindly clicks Save again. The final report submission uses the same rule: `reports.status='submitting'` is persisted before the external submit click; later retries verify confirmation instead of resubmitting.

Since June 2026, Arbetsförmedlingen can also require answers to activities transferred from the user's handlingsplan. The automation does **not** invent those answers. Any unresolved required question leaves the Browser Run session available in the dashboard for the user; after the user answers, polling resumes the same report flow.

## D1 migrations

Apply migrations in order:

```text
migrations/0001_initial.sql
migrations/0002_automation.sql
migrations/0003_integration_probes.sql
migrations/0004_monthly_application_quota.sql
migrations/0005_activity_report_submission.sql
migrations/0006_runtime_configuration.sql
```

`0002_automation.sql` adds workflow/run state, notification history, BankID handoff metadata, and links applications to their automation run.

`0003_integration_probes.sql` stores metadata for sanitized authenticated integration probes. Full probe documents are kept in the private R2 evidence bucket.

`0004_monthly_application_quota.sql` enforces the ten-slot monthly submission ceiling.

`0005_activity_report_submission.sql` tracks idempotent Arbetsförmedlingen activity-item saves so browser/network ambiguity cannot cause duplicate reporting actions.

`0006_runtime_configuration.sql` adds the single-row encrypted dashboard-managed runtime configuration store.

## Deployment contract

Appens deploybara source of truth är `apps/jobb/wrangler.jsonc`.

Produktionskommandot är versionerat i `apps/jobb/package.json`:

```bash
pnpm deploy:cloudflare
```

Det applicerar D1-migrationer mot bindingen `DB` och kör därefter Wrangler deploy med samma appkonfiguration.

Detta dokument beskriver inte vilket externt CI/CD-system som eventuellt triggar kommandot, eftersom sådan live-state inte ägs av appens versionsstyrda kontext.

Worker-konfigurationen binder Browser Run, D1, R2, Email, Workflow och Cron och publicerar custom domain `jobb.denied.se`.

Dashboardens response-policy ska fortsatt hålla scripts/styles/connect till `self` enligt implementationen. Worker observability använder `redact_query_string=true` så authorization `code`/`state` i callback-queryn inte persisteras i logs/traces.

