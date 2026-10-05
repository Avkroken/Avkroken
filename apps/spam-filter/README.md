# Spam filter

Incoming Email Routing Worker for `denied.se`.

The Worker receives the domain catch-all, rejects explicitly blocked senders/domains, analyzes message structure and content, rejects high-confidence spam, and forwards the rest to a verified Email Routing destination.

## Filtering pipeline

1. Reject exact matches from `BLOCKED_SENDERS` or domain/subdomain matches from `BLOCKED_DOMAINS`.
2. Parse MIME with `postal-mime` for messages up to `MAX_ANALYSIS_BYTES`.
3. Score independent spam/phishing signals.
4. Reject when the score is at least `SPAM_REJECT_SCORE`.
5. Forward lower-scoring mail with `X-Spam-*` headers so the downstream mailbox can see the decision.

Messages that cannot be fully parsed fail open to header-only analysis instead of being discarded.

### Signals

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

The Worker does not run antivirus, detonate attachments, query an external reputation database, or call an AI model. Attachment checks use metadata only.

## Verdicts

Default thresholds:

- score `0-3`: `clean` → forward
- score `4-7`: `suspicious` → forward with diagnostic headers
- score `8+`: `spam` → reject

Forwarded mail receives:

- `X-Spam-Score`
- `X-Spam-Verdict`
- `X-Spam-Reasons`
- `X-Spam-Engine`

Reason values are fixed codes and never contain subject, body text, URLs, or full sender addresses.

## Runtime configuration

- `MAIL_FORWARD_TO` — required Worker secret containing the verified forwarding destination.
- `MAIL_DOMAIN` — receiving domain.
- `BLOCKED_SENDERS` — optional comma/newline-separated exact sender addresses.
- `BLOCKED_DOMAINS` — optional comma/newline-separated domains; subdomains are included.
- `REJECT_MESSAGE` — SMTP rejection text.
- `SPAM_SUSPICIOUS_SCORE` — score at which mail is marked suspicious; default `4`.
- `SPAM_REJECT_SCORE` — score at which mail is rejected; default `8`.
- `MAX_ANALYSIS_BYTES` — maximum raw message size for full MIME/content analysis; default `5242880` (5 MiB).

The Email Routing trigger `*@denied.se` is provider-managed state in Cloudflare and is intentionally **not** declared through Wrangler. Omitting top-level `addresses` prevents `wrangler deploy` from modifying Email Routing rules, so Workers Builds can deploy code without requiring Email Routing write access or trying to take over the existing catch-all rule.

## Privacy and logging

Worker logs contain only decision metadata such as sender domain, score, verdict, reason codes, and analysis mode. The Worker must not log message body, subject, full sender address, or attachment contents.

## Validate

```bash
npm ci
npm run check
```

Production deployment is intended to run through Cloudflare Workers Builds after repository integration. The deploy script refuses to run outside Workers Builds.

Workers Builds contract:

- root directory: `/apps/spam-filter/`
- production branch: `main`
- deploy command: `npx wrangler deploy`
- preview command: `npx wrangler preview`
- build watch include path: `apps/spam-filter/*`

Worker Previews use the explicit `previews.vars` block in `wrangler.jsonc`. Preview state must remain non-production: no forwarding secret, Email Routing address, service binding, or production mail domain is added to the Preview configuration. Production Email Routing must be verified separately from live Cloudflare provider state after deploys because the trigger is no longer owned by Wrangler.
