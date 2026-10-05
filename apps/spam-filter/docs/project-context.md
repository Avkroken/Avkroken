# Project context

`spam-filter` tar emot catch-all-post för `*@denied.se` via Cloudflare Email Routing. Själva catch-all-regeln är provider-managed state i Cloudflare och deklareras inte i `wrangler.jsonc`; Workers Builds ska deploya Worker-kod utan att reconcila Email Routing-regler.

## Ansvar

1. Normalisera avsändaradressen.
2. Avvisa explicit blockerade avsändare eller domäner.
3. MIME-parsa och analysera innehåll för meddelanden upp till konfigurerad storleksgräns.
4. Beräkna spam-score från flera oberoende signaler.
5. Avvisa endast högkonfidens-spam över reject-tröskeln.
6. Vidarebefordra clean/suspicious post till `MAIL_FORWARD_TO` med `X-Spam-*`-headers.

Parsefel och för stora meddelanden får inte orsaka automatisk förlust av mail; de faller tillbaka till header-only analys.

## Analysmodell

Nuvarande scorer använder signaler från autentiseringsheaders, envelope/header-avsändare, Reply-To, attachment-metadata, phishing/spamfraser, subject-format, HTML-aktiva element och URL-struktur.

Standardtrösklar:

- `0-3`: clean → forward
- `4-7`: suspicious → forward
- `8+`: spam → reject

Filtret gör inte antivirus-/sandboxanalys, extern reputation lookup eller AI-klassificering. Attachment-innehåll loggas eller exekveras aldrig.

## Runtime-konfiguration

- `MAIL_FORWARD_TO` — obligatorisk, lagras som Worker secret.
- `MAIL_DOMAIN` — receiving domain.
- `BLOCKED_SENDERS` — valfri kommaseparerad eller radseparerad lista.
- `BLOCKED_DOMAINS` — valfri kommaseparerad eller radseparerad lista.
- `REJECT_MESSAGE` — SMTP-rejection text.
- `SPAM_SUSPICIOUS_SCORE` — suspicious-tröskel, default `4`.
- `SPAM_REJECT_SCORE` — reject-tröskel, default `8`.
- `MAX_ANALYSIS_BYTES` — maxstorlek för full MIME/content-analys, default 5 MiB.

Blockerade domäner matchar även subdomäner.

## Integritet och observability

Worker-loggar får bara innehålla domännivå, beslut, score, fasta reason-codes och analysläge. Logga aldrig meddelandekropp, subject, fullständig avsändaradress, URL-värden eller attachment-innehåll.

Forwardade mail kan få `X-Spam-Score`, `X-Spam-Verdict`, `X-Spam-Reasons` och `X-Spam-Engine` för felsökning och downstream-regler.
