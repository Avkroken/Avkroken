# Stateful Worker Preview-standard

> **Scope:** Avkroken/Avkroken och monorepots Cloudflare Worker-appar.

## Syfte

Worker Previews får vara stateful endast när state ligger i uttryckligt separata previewresurser.
Production-D1, R2, Workflows, service bindings, Email eller providercredentials får inte återanvändas
som genväg för att få en branch-preview att fungera.

Cloudflare Previews är egna runtimekonfigurationer och ärver inte productionbindings automatiskt.
D1/R2 blir isolerade först när Preview binds mot andra resurser än production.

## Canonical previewresurser

| App | Binding | Previewresurs | Jurisdiction | Status 2026-10-01 |
| --- | --- | --- | --- | --- |
| Jobb | `DB` | `jobb-preview-eu` | EU | provisionerad, migration `0001`–`0006` applicerad |
| Jobb | `EVIDENCE` | `jobb-evidence-preview` | EU | provisionerad |
| Skvallerbyttan | `STATS_DB` | `skvallerbyttan-stats-preview-eu` | EU | provisionerad, migration `0001`–`0006` applicerad |
| Skvallerbyttan | `OBSERVABILITY` | `skvallerbyttan_preview` | providerdataset | konfigurerad |

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

## Provisionering genomförd 2026-10-01

Live providerstate verifierades före och efter provisionering. De tre previewresurserna ovan skapades med
befintliga `CLOUDFLARE_API_TOKEN_W1` i Cloudflare Secrets Store. Secretvärdet exporterades aldrig: en temporär
zone edge-preview fick Secrets Store-bindingen och exponerade endast hårdkodade, idempotenta create-anrop för
de tre beslutade resursnamnen. Den temporära Workern och lokala filer togs bort direkt efteråt.

Båda D1-databaserna skapades med `jurisdiction=eu`; R2-bucketen skapades med EU-jurisdiction. Jobbs migrationer
`0001`–`0006` och Skvallerbyttans `0001`–`0006` applicerades därefter med Wranglers ordinarie
migrationsmotor. En separat temporär edge-preview proxy tillät endast D1 `POST .../query` mot exakt de två
preview-UUID:erna och injicerade W1 inne i Cloudflare. Efter applicering gav båda databaserna
`No migrations to apply` vid idempotenskontroll.

Repositorybindings ska peka direkt på dessa verkliga resurs-ID:n. Workflow, Email, Secrets Store-bindings,
production Service Bindings och providercredentials ska fortsatt vara frånkopplade i Preview.

Vid framtida D1-migration ska samma SQL-version appliceras på både production och respektive preview-D1 innan
Preview accepteras som aktuell. W1 ska fortsatt användas server-side från Secrets Store; secretvärdet får inte
exporteras till terminal, GitHub Actions eller repositoryfiler.

## Vad "stateful Preview" betyder här

Efter D1/R2-provisioneringen är lagringsdelen stateful och production-isolerad. Full providerfunktionalitet är ett
separat steg: den kräver dedikerade previewidentiteter/targets där side effects kan ske utan productionpåverkan.
Frånvaro av sådana credentials ska fortsätta ge fail-closed state, inte fallback till production.
