# AGENTS.md

- Läs `docs/project-context.md` före materiella ändringar.
- Den här appen är en inkommande Email Routing Worker för `denied.se`.
- Bevara catch-all-semantiken: godkänd post ska vidarebefordras, blockerad post ska avvisas.
- Logga aldrig meddelandeinnehåll, subject eller fullständiga avsändaradresser.
- Forward-destination och privata blocklistor ska vara runtime-konfiguration, inte versionshanterade värden.
- `wrangler.jsonc` är deklarativ källa för Worker-inställningar och Email Routing-adresser.
- Kör `npm run check` före commit.
- Produktion deployas via Cloudflare Workers Builds när integrationen är aktiverad.
