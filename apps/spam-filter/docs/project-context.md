# Project context

`spam-filter` tar emot catch-all-post för `*@denied.se` via Cloudflare Email Routing. Själva catch-all-regeln är provider-managed state i Cloudflare och deklareras inte i `wrangler.jsonc`; Workers Builds deployar Worker-kod utan att reconcila Email Routing-regler.

## Ansvar

1. Avvisa explicit blockerade avsändare/domäner.
2. MIME-parsa och lokalt analysera all inkommande post upp till konfigurerad storleksgräns.
3. Hämta privacy-preserving sender reputation från D1.
4. Eskalera gråzon och tidigare user-reported spam till Workers AI.
5. Kombinera deterministisk score, begränsad reputation-adjustment och begränsad AI-adjustment.
6. Avvisa högkonfidens-spam; vidarebefordra clean/suspicious med `X-Spam-*` headers.
7. Ta emot autentiserad feedback via `spam@denied.se` och `notspam@denied.se`.

Parse-/AI-/reputationfel får inte ensamma kasta vanlig inkommande post. Filtret faller tillbaka till den signalnivå som fortfarande är tillgänglig.

## AI

Workers AI-binding: `AI`.

Normal mail eskaleras till AI först när adjusted deterministic score når `AI_MIN_SCORE` (default 2) eller tidigare user-feedback gör avsändaren riskfylld. Det minskar kostnad och undviker att låg-risk-mail skickas till modell i onödan.

AI-modellen klassificerar i fasta kategorier och påverkar score inom hårda gränser. Modellen får aldrig ensam bypassa hard-reject-signaler.

## Feedback / learning

Feedback är användarstyrd reputation, inte modell-finetuning.

- Missad spam: vanlig forward (eller `.eml`-attachment) till `spam@denied.se`.
- Legitimitetskorrigering: vanlig forward (eller `.eml`-attachment) till `notspam@denied.se`.
- Endast avsändare som exakt matchar `MAIL_FORWARD_TO` får lämna feedback.
- Originalet återanalyseras och körs genom AI oavsett tidigare score.
- Full sender address lagras inte. D1 använder SHA-256 sender key + domän + räknare/metadata.

En spam-feedback ger positiv riskadjustment (max +6). Legitimate-feedback ger begränsad trust-adjustment (max -2), så historiskt gröna avsändare fortfarande kan bli röda vid nya starka signaler.

## D1

Production: `spam-filter-reputation-eu`.

Preview: `spam-filter-reputation-preview-eu`.

Schema finns under `migrations/`.

D1 lagrar inte body, subject, URLs, attachment-innehåll eller forwarding destination.

## Integritet och observability

Worker-loggar får endast innehålla domän, verdict, score-komponenter, fasta reason-codes, AI category/confidence, feedback-label och analysläge. Logga aldrig body, subject, full sender address, URL-värden, attachment-innehåll eller `MAIL_FORWARD_TO`.
