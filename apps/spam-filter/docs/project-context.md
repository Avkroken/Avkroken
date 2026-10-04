# Project context

`spam-filter` tar emot catch-all-post för `*@denied.se` via Cloudflare Email Routing. Själva catch-all-regeln är provider-managed state i Cloudflare och deklareras inte i `wrangler.jsonc`; Workers Builds ska deploya Worker-kod utan att reconcila Email Routing-regler.

## Ansvar

1. Normalisera avsändaradressen.
2. Avvisa explicit blockerade avsändare eller domäner.
3. Vidarebefordra all annan post till den verifierade destination som anges i `MAIL_FORWARD_TO`.

## Runtime-konfiguration

- `MAIL_FORWARD_TO` — obligatorisk, lagras som Worker secret.
- `MAIL_DOMAIN` — receiving domain.
- `BLOCKED_SENDERS` — valfri kommaseparerad eller radseparerad lista.
- `BLOCKED_DOMAINS` — valfri kommaseparerad eller radseparerad lista.
- `REJECT_MESSAGE` — SMTP-rejection text.

Blockerade domäner matchar även subdomäner. Worker-loggar får bara innehålla domännivå och beslut, aldrig meddelandekropp, subject eller fullständig avsändaradress.
