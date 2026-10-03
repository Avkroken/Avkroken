# Spam filter

Incoming Email Routing Worker for `denied.se`.

The Worker receives the domain catch-all, rejects configured senders/domains, and forwards all other messages to a verified Email Routing destination.

## Runtime configuration

- `MAIL_FORWARD_TO` — required Worker secret containing the verified forwarding destination.
- `MAIL_DOMAIN` — receiving domain.
- `BLOCKED_SENDERS` — optional comma/newline-separated exact sender addresses.
- `BLOCKED_DOMAINS` — optional comma/newline-separated domains; subdomains are included.
- `REJECT_MESSAGE` — SMTP rejection text.

The Email Routing trigger is declared in `wrangler.jsonc` as `*@denied.se`. Cloudflare requires this trigger to be a literal address pattern; Wrangler does not interpolate variables in `addresses`.

## Validate

```bash
npm ci
npm run check
```

Production deployment is intended to run through Cloudflare Workers Builds after repository integration. The deploy script refuses to run outside Workers Builds.
