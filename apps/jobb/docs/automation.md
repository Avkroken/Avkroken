# Dashboard and monthly automation

`jobb` supports two execution modes that use the same idempotent application pipeline.

## Operational dashboard

The protected dashboard is the operational control plane for the automation. It has five top-level views:

- **Översikt** — monthly target, ten visible result slots filled only by verified applications, report state and active attention signals. Internal `uncertain` quota reservations are shown as separate safety blockers instead of consuming a visible approved slot. Historical failed runs do not inflate the active-attention count after a later run resolves the monthly target.
- **Ansökningar** — filterable applications with run linkage, latest diagnostics and evidence count. On narrow screens the application table becomes mobile cards. `needs_user_action` rows expose a provider-backed **Kontrollera igen** action and an explicit **Markera ej inskickad** resolution; only provider-confirmed applied state can promote an application to `verified`.
- **Körningar** — run history with read-only drill-down to applications, attempts, evidence metadata, notifications and probe state. On narrow screens both run history and attempt history use cards instead of wide tables. A run that reached 10/10 applications is displayed as completed even when the separate previous-month report lacks historical source data; that report limitation remains visible as a non-blocking note.
- **Aktivitetsrapport** — the current calendar month's activity queue plus separate state for the previous month's submission. Verified applications are prepared for the same activity month in which they were made, with per-activity `pending`, `save_attempted` and `saved` state. A month calendar marks verified application days and the distinct day when the immutable monthly `.txt` export became available.
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
4. Never counts an application as verified until the exact StudentConsulting Jobb-ID is proven from authenticated state. Verification first queries the same-origin job-openings API inside Browser Run and requires the exact row to have `is_applied=true`; otherwise it falls back to the authenticated `Ansökningar` view, where the exact Jobb-ID must appear as text or in a trusted StudentConsulting job-detail URL. `Ansökningar` navigation uses the same exact-origin/profile-area fail-closed rules as discovery and may handle placeholder/data-navigation or one semantic SPA click; reconciliation never resubmits an uncertain application.
5. During the 1st–14th reporting window, prepares the previous calendar month's activity-report context and waits for the user to continue in Arbetsförmedlingen in their own browser.
6. Sends a notification when the report needs user action.

## Exact monthly quota

`migrations/0004_monthly_application_quota.sql` creates ten slots for each month. A slot is reserved **before** StudentConsulting submission starts.

- A definitely failed pre-submit attempt releases its reservation. The same automation run may atomically requeue only its own `failed` application with `applied_at IS NULL` and `verified_at IS NULL`, creating the next numbered attempt without transferring application history between runs. Submitted, uncertain/user-action, verified, queued/applying, or otherwise possibly-sent applications are never requeued for a replacement submit.
- A confirmed submission keeps its slot.
- A verified submission marks its slot verified.
- An ambiguous/unknown result keeps the slot as `uncertain` rather than allowing a replacement application that could accidentally become number 11.

This is deliberately fail-closed: the automation will never knowingly submit more than ten jobs in a calendar month. If an external site leaves the result ambiguous, the dashboard reports the problem and blocks additional submissions until it is resolved. These internal reservations are safety holds, not completion credit: dashboard `quotaUsed` and the ten visible monthly result slots count only `verified` applications. An authenticated user may recheck the provider state or explicitly confirm that an uncertain application was not submitted; the latter releases the safety hold but never turns the application into a successful result.

## Error diagnostics

Application attempts persist a machine-readable `error_code` plus the provider's error message. The dashboard renders the failure stage and reason, for example:

- `APPLICATION_FAILED` — StudentConsulting rejected or failed the application.
- `APPLICATION_UNKNOWN` — submission outcome could not be determined safely.
- Definite pre-submit failures are retryable across later runs even if the job is no longer present in the current Matcha jobb page. `APPLICATION_REQUIRES_INPUT` is retried once per run rather than being permanently capped by attempt count.
- For StudentConsulting application questions, the automation may only answer facts explicitly approved by the user. It expands experience questions and selects `Ingen erfarenhet` when that exact option is available, and uses `Behöver jobb.` for the known motivation/Pitch field. Other unresolved required questions remain fail-closed.
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

StudentConsulting OIDC returns to the verified profile entry `https://www.studentconsulting.com/sv/profil/`, and discovery/verification revisit that entry rather than the public `/sv/` landing page. If `/signin` reuses an existing authenticated Browser Run session and lands directly in that profile area without visible login controls, the session is accepted without another credential read or form submission. Authentication is accepted only on the exact StudentConsulting origin under `/sv/profil/`. The engine then resolves visible job-matching navigation semantically. Accepted labels are restricted to established **Matcha jobb** variants plus explicit `Jobbmatchning`/`Jobbmatchningar` and `Matchning(ar) mot jobb` forms. A matched-profile anchor must resolve to exactly one trusted URL under `/sv/profil/...` or the legacy observed `/sv/min-profil/...` area. A benign root placeholder in `href` may be paired with one exact trusted `data-href` or `data-url`. If no trusted data route exists, exactly one visible semantic placeholder anchor may be clicked. If the URL remains on the profile entry, navigation is rescanned once for a newly exposed trusted semantic route/control without recursively clicking the same placeholder. Any resulting route must validate to the trusted profile area. External, credential-bearing, redirected-outside-profile or ambiguous alternatives fail closed. If no matching anchor is present, one unambiguous visible button/role-link/data-navigation control may be activated and the resulting URL must pass the same origin/profile validation. Missing, untrusted or ambiguous matching navigation fails closed. There is no hardcoded matched-profile fallback. When no matching navigation is recognized, diagnostics expose at most 20 same-origin `/sv/profil/...` or legacy `/sv/min-profil/...` pathnames plus structural counts for total/visible anchors and controls, semantic matches, and `data-href`/`data-url`/`onclick` elements. They expose no labels, profile text, query values, attribute payloads or input values. Visible login controls are rechecked after authentication, after opening the matched profile and after each listing navigation. Discovery accepts only strictly normalized StudentConsulting job-detail URLs from the verified page, including navigation exposed through `href`, `data-href`, `data-url` or inline `onclick`; absolute URLs retain their original authority for host validation, and discovery never falls back to the public jobs listing. An unrecognized selected matched page reports only structural element counts for diagnostics and does not persist profile text or form values. Current job-detail pages do not consistently expose `Land`, so country is enriched from StudentConsulting's public job-search API using its explicit Sverige/Norge/Danmark country filters; unresolved or ambiguous country remains fail-closed. `JOB_INCLUDE_TERMS` is optional and acts only as an additional narrowing filter.

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

The notification links to the protected dashboard. It does not expose a remote browser session.

## BankID and local-browser activity reporting

The activity report is completed in the user's own browser. The dashboard exposes **Öppna aktivitetsrapporten**, which deep-links directly to Arbetsförmedlingen's activity-report service on the current device. If the user is not authenticated, Arbetsförmedlingen handles the e-identification step before the user continues in its own UI. BankID/e-identification, any mandatory handlingsplan questions, and the final external submission remain entirely in Arbetsförmedlingen's own UI.

Jobb keeps two periods distinct: the **current activity month** and the **previous month that may be submitted now**. A verified application made in October belongs to the October activity queue even though October's report cannot be submitted until the following reporting window. Missing historical Jobb records never cause activities to be fabricated or backdated.

For the current activity month, Jobb prepares up to ten verified applications as a guided queue. The dashboard shows the next job's known fields from the verified application record and deep-links directly to Arbetsförmedlingen's **Lägg till aktivitet** page. It also links back to the source job ad so unknown fields can be checked. Because `denied.se` cannot write into `arbetsformedlingen.se` DOM across origins, the user saves each item in Arbetsförmedlingen and explicitly confirms that save back in Jobb; Jobb then advances to the next item. StudentConsulting scope/omfattning is persisted from the source facts during discovery; JobSearch candidates use the provider's structured working-hours field where available.

As soon as the month reaches ten verified applications, Jobb snapshots a monthly UTF-8 text export. Each entry contains only **Jobbsök-ID**, **Yrkesroll**, **Stad** and **Omfattning**; the application date is intentionally omitted because the manual Arbetsförmedlingen workflow uses the current day when entered. The snapshot is kept month by month in D1 and is downloaded through authenticated `GET /api/reports/:month/export.txt`. The calendar's download-ready day is the verification time of the tenth application, not the later click/download time.

After Arbetsförmedlingen itself shows that the **previous month's** report is submitted, the user selects **Föregående rapport är inskickad** in Jobb. That mutation is authenticated, same-origin protected, and requires an explicit confirmation payload. Jobb then marks that previous report `submitted` with external reference `manual:user-confirmed-local-browser` and completes the waiting run.

A submitted previous report does **not** close the item-level historical queue. If genuine applications are later backfilled from StudentConsulting, Jobb keeps those `report_activity_items` independently pending and exposes them as **Historisk backfill**. The user can add each already-made application to Arbetsförmedlingen with its original application date and confirm it item by item. Marking all historical items saved never downgrades an already `submitted` report back to `ready`.

Legacy Browser Run probe/submission code remains isolated for compatibility but is not used by the dashboard's report workflow.

For historical repair, an operator-only Workflow path can read the authenticated StudentConsulting **Ansökningar** history through StudentConsulting's own `v1/user/application` API, enrich each matching application from `v1/jobopening/:id`, and backfill only source-observed applications for an explicitly named month. The repair path never submits new applications. If the user has separately confirmed that the already-sent Arbetsförmedlingen report is submitted, the same repair can reconcile Jobb's stale `needs_user_auth` report/run state without changing anything at Arbetsförmedlingen.

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

