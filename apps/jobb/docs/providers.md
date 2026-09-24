# Provider implementation

## StudentConsulting

The StudentConsulting provider uses Browser Run through a small browser abstraction.

Implemented flow:

1. Open StudentConsulting's `/signin` entry point.
2. Follow the OIDC redirect to `id.studentconsulting.com`.
3. Fill the configured email/password credentials and submit the login form.
4. Discover jobs from the public job listings.
5. Read Jobb-ID, location and occupational category from each job page.
6. Classify Norway and Denmark using StudentConsulting's country-filtered lists; remaining jobs from the Swedish listing are treated as Sweden.
7. Evaluate the explicit suitability policy before autonomous submission.
8. Reserve one of exactly ten monthly D1 quota slots before any submit side effect.
9. Stop if any visible required application field is unresolved.
10. Submit only when `STUDENTCONSULTING_AUTOSUBMIT=true` and there is exactly one recognized application submit control.
11. Verify the application through the authenticated `Ansökningar` navigation before it can be treated as confirmed.

Runtime secrets/configuration:

- `STUDENTCONSULTING_EMAIL`
- `STUDENTCONSULTING_PASSWORD`
- `STUDENTCONSULTING_AUTOSUBMIT` (`true` enables submission after policy and form validation)
- `JOB_INCLUDE_TERMS`
- optional `JOB_EXCLUDE_TERMS`, `JOB_ALLOWED_LOCATIONS`, and `JOB_ALLOWED_COUNTRIES`

Autosubmit defaults to disabled and suitability fails closed without include terms. A definitely failed submission may release its reserved quota slot; an ambiguous result remains `uncertain` so the system cannot compensate with a possible 11th application.

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

Application attempts persist status, machine-readable error codes and provider messages in D1. Verified StudentConsulting evidence is stored in the private `jobb-evidence` R2 bucket with metadata in D1.

The `evidence.sha256` schema field currently exists but is not populated by the evidence write path. It must not be treated as an active integrity guarantee until hashing is implemented and verified.
