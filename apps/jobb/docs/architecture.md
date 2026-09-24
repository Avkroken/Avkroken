# Arkitektur

**Senast verifierad mot repositoryt:** 2026-09-24

## Runtime

Jobb är en Cloudflare Worker-applikation med repositoryts root-`wrangler.jsonc` som deploykonfiguration.

Verifierade bindings och runtimeytor:

- entrypoint `apps/web/src/index.ts`,
- D1-binding `DB`,
- R2-binding `EVIDENCE`,
- Browser Run-binding `BROWSER`,
- Workflow-binding `JOB_AUTOMATION`,
- Email-binding `EMAIL`,
- cron `0 9 10-13 * *`,
- custom domain `jobb.denied.se`,
- Krösa-Maja OIDC client ID som icke-hemlig Worker-var,
- OIDC client secret via Secrets Store-binding.

## Översikt

```text
Dashboard / scheduler
        |
        v
jobb.denied.se
Cloudflare Worker
  |      |       |        \
  |      |       |         +--> Email
  |      |       +------------> R2 evidence
  |      +--------------------> D1 canonical state
  +---------------------------> Workflow
                                  |
                                  +--> Browser Run
                                  +--> provider adapters
```

## State ownership

### D1

D1 är canonical state för:

- automation runs,
- quota,
- applications,
- application attempts,
- activity-report state,
- notifierings- och probe-metadata enligt migrationerna.

### R2

R2 innehåller supporting evidence. Objektinnehåll är inte generell loggning och får inte exponeras som debugoutput eller publik dokumentation.

### Workflow

Cloudflare Workflows orkestrerar längre körningar. Manuell och schemalagd start ska konvergera mot samma persistenta D1-state och samma domäninvarianter.

### Browser Run

Browser Run används för browserbaserade providerflöden och autentiserade handoffs/probes. Browser-sessionen är transport-/integrationsstate, inte canonical application state.

## Quota och fail-closed

Månadsgränsen skyddas av exakt tio quota slots.

Ett osäkert providerresultat får inte behandlas som ett säkert misslyckande om det kan möjliggöra en potentiell elfte submission. `uncertain` är därför ett explicit blockerande state.

## Auth boundary

Jobb är downstream OIDC client till Krösa-Maja, inte identity authority.

Authorization Code + PKCE används. Access-/refresh-token ska inte bli application session state; efter validerad OIDC-login används Jobbs lokala signerade session enligt implementationen.

## Request security

Skyddade mutationer använder same-origin-kontroll och `Sec-Fetch-Site` när headern finns. Manuell körning kräver dessutom Turnstile.

## Deployment boundary

Repositoryts deploykontrakt är versionerat i `package.json` och `wrangler.jsonc`.

Rootkommandot:

```bash
pnpm deploy:cloudflare
```

applicerar remote D1-migrationer och kör därefter Wrangler deploy med rootkonfigurationen.

Vilket externt CI/CD-system som eventuellt anropar kommandot är inte repo-local current-state och dokumenteras därför inte här.

## Dokumentationsgräns

Arkitekturdokumentet beskriver kod, bindings och versionerade kontrakt i repositoryt. Extern organisationsgovernance och deployment-live-state hör hemma i respektive auktoritativa system.
