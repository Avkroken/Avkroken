# Stateful Worker Preview-standard

> **Scope:** Avkroken/Avkroken och monorepots Cloudflare Worker-appar.

## Syfte

Worker Previews får vara stateful endast när state ligger i uttryckligt separata previewresurser.
Production-D1, R2, Workflows, service bindings, Email eller providercredentials får inte återanvändas
som genväg för att få en branch-preview att fungera.

Cloudflare Previews är egna runtimekonfigurationer och ärver inte productionbindings automatiskt.
D1/R2 blir isolerade först när Preview binds mot andra resurser än production.

## Canonical previewresurser

| App | Binding | Previewresurs | Jurisdiction | Status 2026-09-30 |
| --- | --- | --- | --- | --- |
| Jobb | `DB` | `jobb-preview-eu` | EU | saknas hos provider |
| Jobb | `EVIDENCE` | `jobb-evidence-preview` | EU | saknas hos provider |
| Skvallerbyttan | `STATS_DB` | `skvallerbyttan-stats-preview-eu` | EU | saknas hos provider |
| Skvallerbyttan | `OBSERVABILITY` | `skvallerbyttan_preview` | providerdataset | redan konfigurerad |

Dessa namn ska inte återanvändas av production.

## Säkerhetsgräns

Jobb Preview får efter state-provisionering binda separat D1/R2 och Browser Run. Den får inte binda
production-Workflow `jobb-automation`, production-Email eller production OAuth/providercredentials.

Skvallerbyttan Preview får efter state-provisionering binda separat D1 och separat Analytics Engine-dataset.
Den får inte binda production-Portal-services, production Secrets Store-bindings, Cloudflare account-tokenklasser,
GitHub App private key, webhooksecrets eller machine read token.

Cloudflare dokumenterar att Preview service bindings anropar den bundna Workerns production deployment och
att Workflow-bindings använder ett redan existerande Workflow. Därför lämnas de bortkopplade tills dedikerade
previewtargets faktiskt finns.

## Providerblocker 2026-09-30

Live inventory verifierade att preview-D1/R2-resurserna ovan saknas. Provisioneringsförsök med den befintliga
`avkroken` Wrangler OAuth-profilen avvisades med Cloudflare error 10000.

OAuth-granten annonserar relevanta produktscopes, men kontomedlemskapet är Developer Platform Editor.
Cloudflares rollmodell tillåter Editor att ändra befintliga Developer Platform-resurser men inte skapa/radera dem.
Resursskapande kräver en auktoriserad Developer Platform Admin-/motsvarande create-roll. Skapa inte en ny API-token
som workaround.

## Provisioneringsordning när create-rätt finns

1. Skapa `jobb-preview-eu` som D1 med `jurisdiction=eu`.
2. Applicera Jobbs migrationer `0001`–`0005` mot previewdatabasen.
3. Skapa `jobb-evidence-preview` som R2 med EU-jurisdiction.
4. Lägg D1/R2-bindings under `apps/jobb/wrangler.jsonc -> previews`; behåll Workflow/Email/secrets/provider-vars frånkopplade.
5. Skapa `skvallerbyttan-stats-preview-eu` som D1 med `jurisdiction=eu`.
6. Applicera Skvallerbyttans migrationer `0001`–`0006`.
7. Lägg D1-bindingen under `apps/skvallerbyttan/wrangler.jsonc -> previews`; behåll befintligt preview-AE-dataset.
8. Kör apparnas fulla test/typecheck/dry-run och skapa en Preview.
9. Verifiera att Preview aldrig refererar till production-D1/R2/Workflow/service/secrets.

Cloudflare rekommenderar en separat Wrangler-konfiguration för D1 Preview-migrationer som pekar på exakt samma
previewdatabas som `previews.d1_databases`. Den filen ska skapas först när verkliga database IDs finns; placeholders
ska inte mergas till `main`.

## Vad "stateful Preview" betyder här

Efter D1/R2-provisioneringen är lagringsdelen stateful och production-isolerad. Full providerfunktionalitet är ett
separat steg: den kräver dedikerade previewidentiteter/targets där side effects kan ske utan productionpåverkan.
Frånvaro av sådana credentials ska fortsätta ge fail-closed state, inte fallback till production.
