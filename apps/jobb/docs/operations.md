# Drift och verifiering

**Senast verifierad mot repositoryt:** 2026-10-01

## Lokal verifiering

Från `apps/jobb` i monorepot:

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
```

Appens rootskript kör motsvarande workspacekontroller för projekten under `apps/*` och `packages/*`.

## Lokal utveckling

```bash
pnpm dev
```

Det kör `@avkroken/web`-paketets Wrangler-baserade devscript.

## Deployment

Cloudflare Workers Builds äger produktionsdeploymenten. GitHub Actions används endast för repository-CI och behöver ingen Cloudflare deploy-secret.

Workers Builds ska använda app-roten `apps/jobb` och:

```bash
pnpm deploy:workers-builds
```

Scriptet kräver `WORKERS_CI=1` och `WORKERS_CI_BRANCH=main`, kör `pnpm typecheck` och `pnpm test`, och anropar därefter `pnpm deploy:cloudflare`.

`pnpm deploy:cloudflare` applicerar D1-migrationer remote via `apps/jobb/wrangler.jsonc` och deployar därefter Workern med samma konfiguration.

## Worker Preview state

Jobbs Preview har nu separat D1 `jobb-preview-eu` och separat R2 `jobb-evidence-preview`, båda EU-isolerade och bundna endast under `previews`. Production-D1 `jobb-eu`, production-R2 `jobb-evidence`, Workflow `jobb-automation`, Email och production OAuth/providercredentials återanvänds inte i Preview.

Resurserna provisionerades 2026-10-01 med den befintliga write-identiteten `CLOUDFLARE_API_TOKEN_W1` från Cloudflare Secrets Store utan att exportera secretvärdet. Jobbs migrationer `0001`–`0006` applicerades mot preview-D1 med Wranglers ordinarie migrationsmotor och en efterföljande idempotenskontroll gav `No migrations to apply`.

Framtida Jobb-migrationer ska appliceras på både production-D1 och `jobb-preview-eu` innan Preview betraktas som aktuell. Provider-side effects ska fortsatt vara fail-closed tills separata previewidentiteter finns. Se `../../docs/organization/preview-state-standard.md`.

## D1 data locality

Produktionsbindingen `DB` ska använda en D1-databas skapad med `jurisdiction=eu`. Cloudflare tillåter inte att jurisdiction läggs till eller ändras efter att databasen skapats, så ett framtida byte ska göras som en kontrollerad export/import till en ny EU-databas före binding-cutover.

Read replication ska vara avstängd tills Jobbs D1-requestväg använder D1 Sessions API. Att aktivera repliker utan Sessions API flyttar inte querytrafik från primären.

## Readiness

`GET /api/health` är minimal liveness.

`GET /api/ready` verifierar D1, att dashboard-authkonfigurationen är användbar och att `0006_runtime_configuration.sql` både finns i schemat och är registrerad i D1:s migrationshistorik. Readiness får inte exponera credential-värden.

## Månadskörning

Kontrollera före manuell omkörning:

1. aktuell månads stable run,
2. quota slots,
3. applications med `uncertain` state,
4. senaste providerfel/evidence,
5. att en ny körning inte kan överskrida månadsgränsen.

## Workflow/orphan-incident

En automation räknas som **orphaned** när D1 fortfarande visar `running`, `workflow_instance_id` saknas, ingen application är kopplad till runnen och `updated_at` är äldre än fem minuter. Dashboarden visar sådana rader som **Övergivna körningar** i stället för som aktiva.

Före varje manuell eller schemalagd start reconcilerar Workern utgångna/ogiltiga `needs_user_auth`-BankID-handoffs och orphaned rader till `failed`. En BankID-handoff räknas som utgången när `auth_expires_at` saknas/är ogiltig eller har passerats; dashboarden ska då inte längre blockera nästa manuella start. Den atomiska run-claimen tillåter därefter högst en `running` eller `needs_user_auth` automation åt gången. En failed `scheduled:YYYY-MM`-retry återställs till rent `running`-state innan nytt Workflow startas.

Vid incident, kontrollera i denna ordning:

1. Cloudflare Workflow-instansens status och fel,
2. D1 `automation_runs.status`, `workflow_instance_id`, `last_error`, `updated_at`,
3. om runnen har applications/attempts eller provider-side effects,
4. quota slots och eventuell `uncertain` state innan retry.

Korrigera inte en run med observerade provider-side effects som orphaned enbart för att Workflow-länken saknas. Om direkt D1-write saknar behörighet ska state återställas genom den versionerade reconciliation/startvägen efter deployment, inte genom att byta Cloudflare-identitet eller kringgå behörighetsmodellen.

## Browser/providerincident

Vid browser/providerfel:

- bevara run/application state i D1,
- klassificera oklar submission som `uncertain`,
- undvik blind retry om providern kan ha accepterat submission,
- kontrollera evidence och providerstate innan ny submission tillåts.

## GitHub OAuth

Vid loginfel verifiera:

- GitHub OAuth client ID,
- Secrets Store-binding `GITHUB_OAUTH_CLIENT_SECRET` för client secret. Bindingnamnet är neutralt, men production återanvänder den befintliga delade OAuth-hemligheten i Secrets Store; skapa inte en ny OAuth-secret enbart för Jobb,
- att exakt callback `https://jobb.denied.se/auth/callback` är registrerad på OAuth-klienten,
- `JOBB_ALLOWED_GITHUB_IDS`,
- PKCE/state-validering och GitHub `/user`-uppslag.

Lägg inte till Basic Auth, OIDC-proxy eller parallell authväg som fallback.

## Evidence och privacy

R2-evidence ska vara begränsad till det som behövs för auditability. Probe-state för aktivitetsrapportering får beskriva formulärstruktur men inte lagra användarens ifyllda känsliga fältvärden som generell diagnostik.

## Observability

`apps/jobb/wrangler.jsonc` definierar:

- persistent observability,
- log sampling `0.1`,
- trace sampling `0.01`,
- `redact_query_string=true`.

OAuth callback-parametrar kan förekomma i query string; redaction ska därför behållas. Credentials, sessionsmaterial och privata providerpayloads får inte läggas i logs.

## Dokumentationsunderhåll

Uppdatera denna fil när appens test-/deployscripts, runtimebindings, migrationsordning eller incidentmodell ändras. Extern live-state ska verifieras i sitt auktoritativa system och inte kopieras in som permanent app-current-state.
