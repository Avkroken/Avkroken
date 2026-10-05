#!/usr/bin/env bash
set -euo pipefail

TOTAL_STAGES=7
STAGE_INDEX=0

say() {
  printf '  %s\n' "$1"
}

step() {
  printf '  • %s\n' "$1"
}

warn() {
  printf '  ⚠ %s\n' "$1"
}

pause() {
  printf '  %s ' "$1"
  read -r _ || true
}

confirm() {
  local answer=""
  printf '  ? %s [y/N] ' "$1"
  read -r answer || true
  [[ "$answer" =~ ^[Yy]$ ]]
}

open_url() {
  local url="$1"
  printf '  ↗ %s\n' "$url"
  if command -v wslview >/dev/null 2>&1; then
    wslview "$url" >/dev/null 2>&1 || true
  elif command -v explorer.exe >/dev/null 2>&1; then
    explorer.exe "$url" >/dev/null 2>&1 || true
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$url" >/dev/null 2>&1 || true
  elif command -v open >/dev/null 2>&1; then
    open "$url" >/dev/null 2>&1 || true
  else
    warn "Kunde inte öppna webbläsaren automatiskt; öppna URL:en manuellt."
  fi
}

stage() {
  STAGE_INDEX=$((STAGE_INDEX + 1))
  printf '\n▸ Steg %s/%s · %s\n' "$STAGE_INDEX" "$TOTAL_STAGES" "$1"
}

require_app_root() {
  if [[ ! -f package.json || ! -f wrangler.jsonc || ! -f docs/permissions.md ]]; then
    printf 'Kör från apps/skvallerbyttan.\n' >&2
    exit 1
  fi
  if ! grep -q '"name"[[:space:]]*:[[:space:]]*"skvallerbyttan"' package.json; then
    printf 'Fel app-root: package.json är inte Skvallerbyttan.\n' >&2
    exit 1
  fi
}

verify_contract_names() {
  local name
  local missing=0
  for name in \
    GAMNACKEN_GITHUB_APP_CLIENT_ID \
    GAMNACKEN_GITHUB_APP_PRIVATE_KEY \
    SKVALLERBYTTAN_SESSION_SECRET \
    SKVALLERBYTTAN_WEBHOOK_SECRET \
    CLOUDFLARE_API_TOKEN_R1 \
    CLOUDFLARE_API_TOKEN_R2 \
    CLOUDFLARE_API_TOKEN_R3 \
    GITHUB_OAUTH_CLIENT_SECRET; do
    if ! grep -q "$name" wrangler.jsonc; then
      warn "Runtimekontraktet saknar förväntat namn: $name"
      missing=1
    fi
  done
  if (( missing == 0 )); then
    say "✓ Versionsstyrt runtimekontrakt innehåller förväntade credentialnamn."
  fi
}

require_app_root

printf '\nSkvallerbyttan · credential prerequisite wizard\n'
printf '%s steg. Inga token- eller secretvärden samlas in, skrivs eller visas.\n' "$TOTAL_STAGES"
pause "Tryck Enter för att börja."

stage "GitHub App · Gamnacken"
say "Verifiera den befintliga GitHub App-installationen och dess read-only permissions."
open_url "https://github.com/settings/apps"
step "Öppna Gamnacken och kontrollera installationens owner/repository-scope."
step "Behåll endast read-behörigheter för de observationsytor som används."
step "Lägg inte till write-permissions. Organization-only ytor får vara not_supported när current owner är en GitHub User."
if ! confirm "Är Gamnacken installerad och fortsatt read-only?"; then
  warn "Åtgärda GitHub App-installation/permissions innan du fortsätter."
  pause "Tryck Enter när du vill fortsätta."
fi

stage "Cloudflare API Tokens · R1/R2/R3"
say "Verifiera de tre befintliga tokenklasserna. Skapa inte nya tokens i detta flöde."
open_url "https://dash.cloudflare.com/profile/api-tokens"
step "R1: verifiera read-scope för Zone, Workers metadata, D1, KV och R2 inventory enligt docs/permissions.md."
step "R2: verifiera read-scope för Account Settings, Notifications, Audit/Operations och Account Analytics."
step "R3: verifiera read-scope för Access Apps/Policies, cloudflared/Tunnels och övrig Zero Trust/security-observation."
step "Om en read-permission saknas: justera den befintliga tokenen; lägg inte till Edit/Write."
if ! confirm "Matchar R1/R2/R3 read-behoven utan write-scope?"; then
  warn "Stanna tills read-scope är korrekt."
  pause "Tryck Enter när du vill fortsätta."
fi

stage "Cloudflare Secrets Store · befintliga värden"
say "Verifiera att runtime återanvänder centrala credentials i stället för duplicerade kopior."
open_url "https://dash.cloudflare.com/"
step "Gå till Workers & Pages → Secrets Store för samma Cloudflare-account som Skvallerbyttan."
step "Verifiera CLOUDFLARE_API_TOKEN_R1, CLOUDFLARE_API_TOKEN_R2 och CLOUDFLARE_API_TOKEN_R3."
step "Verifiera KROSA_MAJA_CLIENT_SECRET; wrangler.jsonc binder den som GITHUB_OAUTH_CLIENT_SECRET."
step "Kontrollera att varje bunden Secrets Store-secret får användas av Workers."
verify_contract_names
if ! confirm "Finns bindings/secrets och är Workers-scope korrekt?"; then
  warn "Ändra endast befintlig binding/scope; exportera inte secretvärden."
  pause "Tryck Enter när du vill fortsätta."
fi

stage "Worker runtime · secretnamn"
say "Verifiera runtime-secrets i Cloudflare utan att kopiera ut deras värden."
open_url "https://dash.cloudflare.com/"
step "Öppna Workers & Pages → skvallerbyttan → Settings och kontrollera runtime variables/secrets."
step "Krävs: GAMNACKEN_GITHUB_APP_CLIENT_ID, GAMNACKEN_GITHUB_APP_PRIVATE_KEY, SKVALLERBYTTAN_SESSION_SECRET och SKVALLERBYTTAN_WEBHOOK_SECRET."
step "Vid aktiverade integrationer: CLOUDFLARE_NOTIFICATIONS_WEBHOOK_SECRET och CLOUDFLARE_CASB_WEBHOOK_SECRET."
step "SKVALLERBYTTAN_READ_API_TOKEN behövs endast om machine read API ska användas."
say "GitHub Actions ska inte synka dessa värden och ska inte bära Cloudflare deploycredential."
if ! confirm "Är de runtime-secrets som faktiskt används konfigurerade?"; then
  warn "Provisionering/rotation görs manuellt på provider-sidan; lägg aldrig värden i Git/repo/chatt."
  pause "Tryck Enter när du vill fortsätta."
fi

stage "Webhookkopplingar"
say "Kontrollera endast att provider- och runtime-sidan använder samma befintliga hemlighet."
open_url "https://github.com/settings/apps"
step "För aktiv GitHub provider-webhook: verifiera kopplingen till SKVALLERBYTTAN_WEBHOOK_SECRET."
open_url "https://dash.cloudflare.com/"
step "För Notifications/Workers Issues: verifiera kopplingen till CLOUDFLARE_NOTIFICATIONS_WEBHOOK_SECRET."
step "För CASB: verifiera kopplingen till CLOUDFLARE_CASB_WEBHOOK_SECRET om CASB-ingress används."
step "Visa, logga eller klistra inte in secretvärden i wizarden. Rotation görs endast vid faktisk mismatch och samordnat på båda sidor."
if ! confirm "Är alla aktiva webhookkopplingar synkroniserade?"; then
  warn "Lämna berörd ingress avstängd/oklar tills provider och runtime är synkroniserade."
  pause "Tryck Enter när du vill fortsätta."
fi

stage "Cloudflare Workers Builds · deployidentitet"
say "Verifiera att deploy sker via Cloudflare Workers Builds, inte via GitHub-hostad Cloudflare-token."
open_url "https://dash.cloudflare.com/"
step "Öppna Workers & Pages → skvallerbyttan → Builds/Settings."
step "Verifiera repository Avkroken/Avkroken, branch main och root directory apps/skvallerbyttan."
step "Verifiera production command: npm run deploy:workers-builds."
step "GitHub Actions ska endast köra repository-CI; lägg inte till Cloudflare deploycredential där."
if ! confirm "Matchar Workers Builds repositoryts deploykontrakt?"; then
  warn "Ändra inte deployment i denna wizard; dokumentera avvikelsen och hantera den separat."
  pause "Tryck Enter när du vill fortsätta."
fi

stage "Skvallerbyttan · capability verification"
say "Slutkontrollen görs från Skvallerbyttans privata dashboard."
open_url "https://skvallerbyttan.denied.se/"
step "Logga in och öppna Insyn. Kör Uppdatera för en explicit read-only reconciliation."
step "Verifiera GitHub App-proben samt Cloudflare R1, R2 och R3. Desired reads ska inte visa permission_denied."
step "Organization-only GitHub capabilities får visa not_supported när owner fortfarande är en GitHub User."
step "Kontrollera freshness/last success och att inga credentialvärden exponeras i dashboard/API."
if ! confirm "Är önskade read-only capabilities tillgängliga eller korrekt markerade?"; then
  warn "Använd capability-status för att hitta den specifika saknade read-permissionen; bredda inte tokenklasser generellt."
fi

printf '\n✓ Credential prerequisite genomgång klar\n'
say "Inga credentials skapades, lästes in, skrevs eller synkades av wizarden."
say "Nästa tekniska gate i repositoryt är: npm run check"
