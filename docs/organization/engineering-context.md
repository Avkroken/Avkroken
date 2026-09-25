# Avkroken engineering context

Det här dokumentet beskriver **repository-deklarerad** engineering-, CI- och dokumentationsstruktur för de publika Avkroken-repositories som kan verifieras från GitHub-koden.

Extern GitHub-/Cloudflare-state — exempelvis plan, aktiva rulesets, Custom Property-tilldelningar, webhookkonfiguration, tokenpermissions eller deploymentintegrationer — är inte canonical fakta här och måste verifieras i respektive provider när sådan driftstate spelar roll.

## Repositorystruktur

`Avkroken/Avkroken` är ett publikt monorepository med applikationer under `apps/`.

Publikt versionsstyrda applikationsytor i monorepot omfattar:

- Portal,
- Skvallerbyttan,
- Jobb.

Krosa-Maja är inte en deploybar app i monorepot; root-CI innehåller en retirement guard som blockerar återintroduktion av den pensionerade runtime-/OIDC-ytan.

`Avkroken/.github` är separat och hålls minimal för organisationsprofil, community health-filer och mallar.

Fristående publika projektrepositories har sin egen kod, dokumentation och CI.

## Repository-lokal CI

`.github/workflows/ci.yml` i monorepot triggar på:

- `pull_request` mot `main`,
- `merge_group`.

Workflowen deklarerar följande jobb:

- `Dependency review`,
- `Portal`,
- `Skvallerbyttan`,
- `Krosa-Maja` retirement guard,
- `Jobb`.

Att ett checknamn finns i workflowen betyder inte i sig att det är required i ett externt GitHub-ruleset. Faktisk enforcement är GitHub-state och dokumenteras inte här som current state.

## Deploy- och driftworkflows

Monorepot innehåller repository-lokala workflows för:

- Portal-deploy,
- Skvallerbyttan-deploy,
- Jobb-deploy,
- Skvallerbyttans runtime-secret-sync,
- labeler/auto-assignment.

Workflowfilerna beskriver vad GitHub Actions kan göra när de körs. Dokumentationen gör inga antaganden om att en viss external integration, secret, token eller providerresource faktiskt är provisionerad.

## Säkerhetsmodell

- `pull_request_target` får inte användas för att checka ut eller exekvera opålitlig PR-head-kod.
- Secrets, tokens och privata nycklar får inte dokumenteras eller loggas.
- Provider-write ska inte införas i Skvallerbyttans observationsruntime.
- Dependency- och code-scanning ska behandlas utifrån vad repositoryts workflows och GitHub faktiskt exponerar, utan att dokumentationen antar en viss betalplan eller aktiv rulesetkonfiguration.

## Dokumentation

`README.md` är kort ingång och `docs/` är canonical source för utförlig publik dokumentation.

- organisationsgemensamma tekniska dokument ligger under `docs/organization/`,
- Jobb-dokumentation ligger under `apps/jobb/docs/`,
- Skvallerbyttan-dokumentation ligger under `apps/skvallerbyttan/docs/`.

Repo-specifika dokument ska beskriva kod, config, workflows och publika kontrakt som går att verifiera från repositoryt. Extern providerstate ska inte kopieras in som permanent project-current-state.

## Operativ heartbeat

Repositorykoden deklarerar en intern heartbeatväg från Skvallerbyttan till Portal via Cloudflare Service Binding och entrypoint `OperationalHeartbeatService`.

Portalens kod innehåller en Durable Object-baserad watchdog för mottagen heartbeat. Intervaller, payloadformat och notifieringslogik som finns i koden kan dokumenteras. Om service-bindingen, Email Service eller mottagar-/avsändarkonfigurationen faktiskt är deployad och aktiv är extern Cloudflare-state och dokumenteras inte här som verifierad live-state.

## Konsolidering

Portal, Skvallerbyttan och Jobb ligger under `apps/` i `Avkroken/Avkroken`.

Historiska repositoryflyttar och borttagningar hör hemma i Git-historik och eventuell migrationsdokumentation; de ska inte användas som källa för nuvarande provider- eller governance-state.
