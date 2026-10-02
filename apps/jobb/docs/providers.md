# Provider implementation

## StudentConsulting

The StudentConsulting provider uses Browser Run through a small browser abstraction.

Implemented flow:

1. Open StudentConsulting's `/signin` entry point.
2. Follow the OIDC redirect to `id.studentconsulting.com`.
3. If `/signin` reuses an existing authenticated session and lands directly on the exact `/sv/profil/` area without visible login controls, accept that session without reading credentials again. Otherwise fill the configured email/password credentials and submit the login form.
4. Authenticate with OIDC returning to the verified StudentConsulting profile entry `https://www.studentconsulting.com/sv/profil/`, then revisit that profile entry for discovery. Authentication is accepted only when Browser Run is on the exact StudentConsulting origin under `/sv/profil/`. Resolve visible job-matching navigation semantically. Accepted labels are restricted to established **Matcha jobb** variants plus explicit `Jobbmatchning`/`Jobbmatchningar` and `Matchning(ar) mot jobb` forms; unrelated public labels such as `Rusta och matcha jobb` are rejected. A matched-profile anchor must resolve to exactly one URL on the exact configured origin inside `/sv/profil/...` or legacy `/sv/min-profil/...`. StudentConsulting may render a benign root placeholder in `href`; in that case an exact trusted `data-href` or `data-url` on the same semantic anchor may supply the route. If no trusted data route exists, exactly one visible semantic placeholder anchor may be clicked. If the URL stays on the profile entry, navigation is rescanned once for a newly exposed trusted semantic route/control; the same placeholder is not clicked recursively. Any resulting route must validate to the same trusted profile area. External, credential-bearing, redirected-outside-profile or ambiguous values fail closed. If no matching anchor exists, one unambiguous visible button/role-link/data-navigation control may be activated and its resulting URL must pass the same validation. Missing, untrusted or ambiguous navigation fails closed. There is no hardcoded matched-profile fallback.
5. Reject visible login controls after authentication, after opening the matched profile, and after every paginated listing navigation. Redirects outside the selected verified profile route fail closed.
6. Accept only strictly normalized StudentConsulting job-detail URLs exposed by that verified page through `href`, `data-href`, `data-url` or inline navigation such as `onclick`; absolute URLs retain and validate their original authority. If no job-matching navigation is recognized, diagnostics contain only same-origin `/sv/profil/...` or legacy `/sv/min-profil/...` paths (bounded to 20) plus structural counts for total/visible anchors and controls, semantic-match counts, and `data-href`/`data-url`/`onclick` elements. Labels, profile text, query values, attribute payloads and input values are never emitted. If the selected first matched page is neither explicitly empty nor exposes a trusted job URL, the provider emits only structural counts (anchors/data attributes/onclick/iframes/job-like elements).
7. Read Jobb-ID, location, occupational category and country from each job page; if country cannot be resolved to a supported country code, the candidate is not eligible for autosubmit.
8. Treat optional include/exclude/location/country rules as additional filters on top of the provider match.
9. Reserve one of exactly ten monthly D1 quota slots before any submit side effect.
10. Stop if any visible required application field is unresolved.
11. Submit only when `STUDENTCONSULTING_AUTOSUBMIT=true` and there is exactly one recognized application submit control.
12. Verify the application from authenticated StudentConsulting state before it can be treated as confirmed. The provider first reads the same-origin job-openings API inside the authenticated Browser Run and accepts only the exact Jobb-ID with `is_applied=true`. If that signal is unavailable or false, it falls back to the authenticated `Ansökningar` navigation, which accepts only one trusted exact-origin profile destination (including placeholder/data-navigation or a single semantic click) and requires the exact Jobb-ID either in the applications view text or in a trusted StudentConsulting job-detail URL. Reconciliation never submits a new application.

Runtime secrets/configuration:

- `STUDENTCONSULTING_EMAIL`
- `STUDENTCONSULTING_PASSWORD`
- `STUDENTCONSULTING_AUTOSUBMIT` (`true` enables submission after policy and form validation)
- optional `JOB_INCLUDE_TERMS`, `JOB_EXCLUDE_TERMS`, `JOB_ALLOWED_LOCATIONS`, and `JOB_ALLOWED_COUNTRIES`

Autosubmit defaults to disabled. Discovery fails closed unless the authenticated **Matcha jobb** profile view is present. A provider-rendered empty matched list is reported separately from a page where no trusted job-detail URL can be discovered; neither condition falls back to the public listing. `JOB_INCLUDE_TERMS` is optional and, when set, narrows that matched list further. These values can be supplied by deployment/runtime or, when absent there, by the authenticated System configuration; deployment values take precedence. Dashboard-managed secrets are encrypted before D1 persistence and are never returned as plaintext. A definitely failed pre-submit attempt releases its reserved quota slot and may be retried within the same automation run: only an application owned by that same run, still in `failed`, with both `applied_at` and `verified_at` unset is atomically requeued for a new attempt. Any application that may already have been sent (`submitted`, `needs_user_action`, `verified`, active states, or a non-null `applied_at`) continues to block a replacement. An ambiguous result remains `uncertain` so the system cannot compensate with a possible 11th application.

## Arbetsförmedlingen JobSearch

`ArbetsformedlingenJobSearchProvider` uses the public JobSearch `/search` endpoint. It maps the fields needed by the internal job model, including employer, location, occupation/taxonomy concept, application URL and application reference.

JobSearch is treated as a read-only job-ad source. It does not itself submit job applications or activity reports.

The Worker exposes a protected read-only endpoint:

`GET /api/jobs/search?q=<query>&limit=<n>&offset=<n>`

## Arbetsförmedlingen authentication handoff

BankID/e-identification remains user-controlled.

`startArbetsformedlingenHandoff()` acquires a reusable Cloudflare Browser Run session, navigates to Mina sidor, follows the public `Logga in` flow and creates a Live View URL. The browser connection is then disconnected while the remote session remains alive.

The user performs the e-identification step in Live View. `getArbetsformedlingenHandoffStatus()` reconnects to the same Browser Run session and determines whether the authenticated Mina sidor UI is present.

The Browser Run session ID is sensitive session state. It is stored server-side and is not exposed as a long-lived public browser credential. The ephemeral Live View URL is surfaced only inside the authenticated dashboard while user action is required.

## Authenticated activity-report adapter

The activity-report form is implemented through the observed authenticated UI rather than a guessed private write API.

After BankID succeeds:

1. A fail-closed integration probe navigates to the authenticated activity report and captures a sanitized form schema.
2. The probe records structure such as headings, control names/types, list options and sanitized link paths; it does not read or persist entered input values.
3. The report adapter loads exactly ten verified applications from the previous report month.
4. Application dates are validated in `Europe/Stockholm` and cannot be moved into another report month.
5. Employer text includes the exact StudentConsulting Jobb-ID.
6. Occupations are resolved through JobTech Taxonomy and fail closed on ambiguous matches.
7. Swedish locations use the structured location control; international applications are marked outside Sweden.
8. Each activity persists `pending → save_attempted → saved` around the external Save side effect.
9. If Save is ambiguous, the next pass verifies whether the exact Jobb-ID already exists instead of clicking Save again blindly.
10. Final report submission persists `submitting` before the external submit action and verifies confirmation before marking the report `submitted`.

Since June 2026, Arbetsförmedlingen can require answers to activities transferred from a handlingsplan. The adapter does not invent those answers. Any unresolved required question leaves the Browser Run session available for the user and the flow resumes only after the user has acted.

## Evidence and diagnostics

Application attempts persist status, machine-readable error codes and provider messages in D1. StudentConsulting Matcha-jobb discovery scans navigational `href`, `data-href`, `data-url` and inline navigation attributes, but every extracted candidate must still normalize to the trusted StudentConsulting `/sv/lediga-jobb/.../<Jobb-ID>` route before it can become a job candidate. Verified StudentConsulting evidence is stored in the private `jobb-evidence` R2 bucket with metadata in D1.

The `evidence.sha256` schema field currently exists but is not populated by the evidence write path. It must not be treated as an active integrity guarantee until hashing is implemented and verified.
