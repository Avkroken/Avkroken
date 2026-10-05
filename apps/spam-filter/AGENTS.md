# AGENTS.md

- Läs `docs/project-context.md` före materiella ändringar.
- Den här appen är en inkommande Email Routing Worker för `denied.se`.
- Bevara catch-all-semantiken: godkänd post ska vidarebefordras, explicit blockerad/högkonfidens-spam ska avvisas.
- All inkommande post får lokal deterministic analys; Workers AI ska endast användas selektivt för gråzon/risk-reputation och explicit feedback.
- AI-output får endast påverka score inom definierade gränser och får inte ensamt bypassa hard-reject-signaler.
- Feedback via `spam@denied.se` / `notspam@denied.se` måste autentiseras mot `MAIL_FORWARD_TO`; externa avsändare får aldrig påverka reputation.
- Feedback innebär D1-baserad reputation/adaptation, inte finetuning av basmodellen.
- D1 får inte lagra message body, subject, URL-värden, attachment-innehåll, forwarding destination eller full sender address; sender identity lagras som SHA-256 key plus domän.
- MIME-/AI-/reputationfel ska fail-open till kvarvarande säkra signaler; ett hjälpsystemfel får inte ensamt kasta vanlig post.
- Logga aldrig meddelandeinnehåll, subject, URL-värden, attachment-innehåll, forwarding destination eller fullständiga avsändaradresser.
- Forward-destination och privata blocklistor ska vara runtime-konfiguration, inte versionshanterade värden.
- `wrangler.jsonc` är deklarativ källa för Worker-inställningar men **inte** Email Routing-triggern. Catch-all-regeln är provider-managed state i Cloudflare.
- Production och Preview ska använda separata D1-databaser.
- Kör `npm run check` före commit.
- Produktion deployas via Cloudflare Workers Builds när integrationen är aktiverad.
