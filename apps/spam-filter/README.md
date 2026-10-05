# Spam filter

Incoming Email Routing Worker for `denied.se`.

The Worker receives the domain catch-all, performs deterministic MIME/header/content analysis for every incoming message, selectively escalates uncertain/risky messages to Workers AI, applies user-feedback reputation, rejects high-confidence spam, and forwards the rest to a verified Email Routing destination.

## Filtering pipeline

1. Reject exact matches from `BLOCKED_SENDERS` or domain/subdomain matches from `BLOCKED_DOMAINS`.
2. Parse MIME with `postal-mime` for messages up to `MAX_ANALYSIS_BYTES`.
3. Score deterministic spam/phishing signals.
4. Load privacy-preserving sender reputation from D1.
5. Escalate grey-zone or previously user-reported senders to Workers AI.
6. Combine heuristic score, bounded user-reputation adjustment, and bounded AI adjustment.
7. Reject high-confidence spam; forward clean/suspicious mail with `X-Spam-*` diagnostics.

All incoming mail gets the local deterministic analysis. AI is selective, not universal.

Messages that cannot be fully parsed fail open to header-only analysis instead of being discarded.

## Workers AI

The Worker uses `@cf/meta/llama-3.3-70b-instruct-fp8-fast` with JSON schema output.

AI runs when:

- adjusted heuristic score is at least `AI_MIN_SCORE` (default `2`); or
- user feedback has previously marked that sender as spam more often than legitimate.

The model sees bounded subject/body content, heuristic reason codes, sender domain, attachment MIME types, and aggregate reputation counters. It does not receive the forwarding destination or stored full sender address.

AI output is constrained to one category:

- `legitimate`
- `bulk`
- `suspicious`
- `spam`
- `phishing`

The model does not directly decide rejection. Its category/confidence maps to a bounded score adjustment. Executable attachments remain a hard reject signal regardless of AI output.

## Reputation and feedback

Reputation is stored in the D1 binding `REPUTATION_DB`.

Stored state is intentionally limited to:

- SHA-256 hash of normalized sender address
- sender domain
- aggregate clean/suspicious/spam counters
- user feedback counters
- aggregate AI category counters
- last verdict/category/confidence
- timestamps

The database does **not** store message body, subject, URLs, attachment contents, the forwarding address, or the full sender address.

### Report a missed spam message

Forward the message normally from the forwarding mailbox to:

`spam@denied.se`

Forwarding it as an attached `.eml` is also supported and gives the parser the cleanest original headers.

The Worker:

1. verifies that feedback came from the same address as `MAIL_FORWARD_TO`;
2. extracts the attached original;
3. reruns deterministic analysis;
4. asks Workers AI to classify it again regardless of its prior score;
5. records authoritative user feedback in D1;
6. raises future reputation risk for that sender.

### Correct a false positive / trusted sender

Forward the message normally from the forwarding mailbox to:

`notspam@denied.se`

An attached `.eml` works as well.

This records an authoritative legitimate signal. Trust adjustment is deliberately capped so a previously trusted sender cannot bypass strong new technical attack signals.

Feedback does not fine-tune the base Workers AI model. The adaptive behaviour comes from D1 reputation being fed back into future scoring and AI context.

Feedback sent by any address other than `MAIL_FORWARD_TO` is rejected, preventing external reputation poisoning.

## Deterministic signals

The current scorer considers:

- SPF/DKIM/DMARC failure results exposed in authentication headers.
- Envelope sender versus header `From` mismatch.
- `Reply-To` domain mismatch.
- Executable, macro-enabled, and active-content attachment metadata.
- High-risk phishing and spam phrases in subject/body.
- Excessive capitalization and suspicious punctuation.
- HTML forms, scripts, iframes, and data-URL links.
- Suspicious URL structure such as IP-literal hosts, punycode hosts, URL userinfo, and excessive link counts.
- Bulk/list mail combined with multiple marketing-spam phrases.

The Worker still does not run antivirus or attachment detonation and does not query an external third-party reputation database.

## Verdicts

Default thresholds:

- score `0-3`: `clean` → forward
- score `4-7`: `suspicious` → forward with diagnostic headers
- score `8+`: `spam` → reject

Forwarded mail can receive:

- `X-Spam-Score`
- `X-Spam-Verdict`
- `X-Spam-Reasons`
- `X-Spam-Engine`
- `X-Spam-AI`
- `X-Spam-AI-Confidence`

Reason values are fixed codes and never contain subject, body text, URLs, or full sender addresses.

## Runtime configuration

- `MAIL_FORWARD_TO` — required Worker secret containing the verified forwarding destination.
- `MAIL_DOMAIN` — receiving domain.
- `BLOCKED_SENDERS` — optional comma/newline-separated exact sender addresses.
- `BLOCKED_DOMAINS` — optional comma/newline-separated domains; subdomains are included.
- `REJECT_MESSAGE` — SMTP rejection text.
- `SPAM_SUSPICIOUS_SCORE` — suspicious threshold; default `4`.
- `SPAM_REJECT_SCORE` — reject threshold; default `8`.
- `MAX_ANALYSIS_BYTES` — maximum raw message size for full MIME/content analysis; default `5242880` (5 MiB).
- `AI_MIN_SCORE` — minimum adjusted deterministic score for normal AI escalation; default `2`.
- `AI_MAX_INPUT_CHARS` — maximum body characters supplied to AI; default `8000`.
- `SPAM_FEEDBACK_LOCALPART` — feedback localpart for spam; default `spam`.
- `LEGITIMATE_FEEDBACK_LOCALPART` — feedback localpart for legitimate mail; default `notspam`.

Bindings:

- `AI` — Workers AI.
- `REPUTATION_DB` — production D1 `spam-filter-reputation-eu`; previews use a separate D1 database.

The Email Routing trigger `*@denied.se` is provider-managed state in Cloudflare and is intentionally **not** declared through Wrangler.

## Privacy and logging

Worker logs contain decision metadata such as sender domain, score components, verdict, fixed reason codes, AI category/confidence, feedback label, and analysis mode. The Worker must not log message body, subject, URLs, attachment contents, forwarding destination, or full sender address.

## Validate

```bash
npm ci
npm run check
```

Database schema is versioned under `migrations/`. Production and Preview D1 are separate resources. `npm run migrate:production` and `npm run migrate:preview` apply the tracked migrations.

Production deployment runs through Cloudflare Workers Builds after repository integration. Worker Previews remain isolated from production D1 and production mail configuration.
