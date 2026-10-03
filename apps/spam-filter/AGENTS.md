# AGENTS.md

- Läs `docs/project-context.md` före materiella ändringar.
- Den här appen är en inkommande Email Routing Worker för `denied.se`.
- Bevara catch-all-semantiken: godkänd post ska vidarebefordras, blockerad post ska avvisas.
- Logga aldrig meddelandeinnehåll, subject eller fullständiga avsändaradresser.
- Forward-destination och privata blocklistor ska vara runtime-konfiguration, inte versionshanterade värden.
- `wrangler.jsonc` är deklarativ källa för Worker-inställningar men **inte** Email Routing-triggern. Catch-all-regeln är provider-managed state i Cloudflare och ska verifieras live; lägg inte tillbaka `addresses` utan ett uttryckligt beslut att flytta ägarskapet till Wrangler.
- Kör `npm run check` före commit.
- Produktion deployas via Cloudflare Workers Builds när integrationen är aktiverad.
