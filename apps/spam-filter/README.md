# Spam filter

Incoming Email Routing Worker for `denied.se`.

The Worker receives the domain catch-all, rejects configured senders/domains, and forwards all other messages to a verified Email Routing destination.

## Runtime configuration

- `MAIL_FORWARD_TO` — required Worker secret containing the verified forwarding destination.
- `MAIL_DOMAIN` — receiving domain.
- `BLOCKED_SENDERS` — optional Worker secret containing comma/newline-separated exact sender addresses.
- `BLOCKED_DOMAINS` — optional Worker secret containing comma/newline-separated domains; subdomains are included.
- `REJECT_MESSAGE` — SMTP rejection text.

Standards-compliant delivery failure notifications use a null SMTP reverse-path (`MAIL FROM:<>`). The Worker rejects null reverse-path messages before forwarding, so normal bounce traffic does not need sender-specific blocklist entries.

Private blocklists are runtime state and must not be committed to `wrangler.jsonc`. Configure non-empty blocklists as Worker secrets; Wrangler preserves existing secret bindings across code deployments when they are not replaced by tracked plaintext vars.

The Email Routing trigger `*@denied.se` is provider-managed state in Cloudflare and is intentionally **not** declared through Wrangler. Omitting top-level `addresses` prevents `wrangler deploy` from modifying Email Routing rules, so Workers Builds can deploy code without requiring Email Routing write access or trying to take over the existing catch-all rule.

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
