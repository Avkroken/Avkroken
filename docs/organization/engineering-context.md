# Avkroken engineering context

Det här dokumentet är Avkrokens levande, versionsstyrda tekniska kontext för arbetsgrenar, repository-regler och repo-specifik CI.

**Senast verifierad:** 2026-09-24

## Auktoritet och läsordning

Vid konflikt gäller:

1. GitHubs aktiva repository-inställningar och repository-rulesets.
2. Filer på `main` i berört repository.
3. Det här dokumentet.
4. Äldre issues, pull requests, chattar och agentminnen.

Repository-specifik kontext hör hemma i respektive repository, normalt i `docs/project-context.md`.

## GitHub-plan och styrmodell

Avkroken kör GitHub Free.

`Avkroken/Avkroken` är publikt och dess repository-ruleset `main` är aktivt utan bypass. Live state verifierades 2026-09-24 efter visibility-bytet.

Rulesetet träffar default branch och kräver pull request, upplösta review-trådar, deletion/non-fast-forward-skydd, required status checks samt separat CodeQL-policy. Required status checks är `Dependency review`, `Portal`, `Skvallerbyttan`, `Krosa-Maja` och `Jobb`. `Krosa-Maja` är efter auth-förenklingen en retirement guard som skyddar mot att den pensionerade identity-providern eller dess OIDC-kontrakt återintroduceras; den är inte längre en deploybar applikation.

Övriga publika fristående repositories kan fortsatt använda repository-rulesets enligt planens stöd.

Organisationens tidigare cross-repository required/reusable workflows är inte CI-policykällan. Monorepots repository-lokala CI och live repository-ruleset är canonical enforcement för `Avkroken/Avkroken`.

Custom Properties kan behållas som metadata/inventering men binder inte monorepots CI-policy.

## Repository-lokal CI

Varje repository äger sina egna workflows under `.github/workflows/`.

Monorepots canonical CI triggar på `pull_request` mot `main` och `merge_group`. Portal, Skvallerbyttan och Jobb kör apparnas verifierade gates; `Krosa-Maja` kör retirement guard. Alla required checks är ruleset-enforced på det publika repositoryt.

Cross-repository `workflow_call` till `Avkroken/.github` används inte.

`Avkroken/Avkroken` och `docs/organization/` är central teknisk organisationskontext. `Avkroken/.github` är endast publik organisationsprofil/community health-yta.

## Canonical CI checks

- Docker-idempotent-update: `Dependency review`, `Python`, `Docker`.
- Produkter: `Dependency review`, `Node and Cloudflare`, `Python`, `Container security / app`, `Container security / scraper`.
- Pastebinit: `Dependency review`, `Python 3.10`, `Python 3.14`.
- Politiker: `Dependency review`, `Node and Cloudflare`, `Python`, `Docker`.
- Bastion: `Swift package (ubuntu-latest)`, `Swift package (macos-latest)`, `Apple applications`, `Rust`, `.NET tests`, `Windows application`, `Android Gradle`, `Generate dependency graph`.
- Klarsprak: `Dependency review`, `Node and Cloudflare`.
- Avkroken monorepo: `Dependency review`, `Portal`, `Skvallerbyttan`, `Krosa-Maja` (retirement guard), `Jobb` samt ruleset-separat CodeQL.

## GitHub Free och säkerhet

Betald GitHub Code Security/Secret Protection ska inte antas finnas.

Dependency Review används på publika repositories där stödet finns och dependency snapshots är kompletta och stabila. `Avkroken/Avkroken` är nu publikt och `Dependency review` är en required status check i live ruleset.

Code scanning/CodeQL används där GitHub exponerar stödet. För det publika `Avkroken/Avkroken` innehåller live ruleset en separat CodeQL-regel med security-alert-tröskel `medium_or_higher` och `alerts_threshold=errors`.

## Auto-assignment och pull_request_target

Auto-assignment är repository-lokal och använder repositoryts eget `GITHUB_TOKEN`.

`pull_request_target` används endast för metadataautomation. Sådana workflows får inte checka ut eller exekvera PR-head-kod.

## Publik dokumentation

`README.md` är kort ingång och `docs/` är canonical source för utförlig publik dokumentation.

Skvallerbyttans tekniska dokumentation ligger under `apps/skvallerbyttan/docs/` och har ingen separat Pages-publicering från monorepot. `Avkroken/.github` tillhandahåller inget centralt Pages-workflow.

Portalens dokumentationsnav, provider-webhooks och Cloudflare Service Bindings påverkas inte av CI-decentraliseringen.

## Operativ heartbeat och watchdog

Skvallerbyttan skickar heartbeat via Cloudflare Service Binding till live Worker-tjänsten `avkroken`, entrypoint `OperationalHeartbeatService`.

Portalen lagrar heartbeat-state i Durable Object `OperationalWatchdog`. Watchdog-cron kör var 10:e minut, heartbeat förväntas var 15:e minut och betraktas som utebliven efter 35 minuter.

Heartbeat innehåller endast tjänstenamn, tidsstämpel, ready-värde och booleska readiness-resultat. Credentials och hemligheter skickas inte.

Cloudflare Email Service-bindingen heter `OPS_EMAIL`. Mottagare och avsändare är icke-hemliga Worker-vars `OPS_NOTIFY_TO` och `OPS_NOTIFY_FROM`.

## Konsolidering

Portal, Skvallerbyttan och Jobb ligger i det publika `Avkroken/Avkroken` under `apps/`. Krösa-Maja är pensionerad som separat identity provider; GitHub OAuth används direkt av de skyddade dashboarderna. Monorepots repository-lokala CI producerar tre appchecks plus den ruleset-kompatibla `Krosa-Maja` retirement guarden. Cross-repository workflow reuse via `Avkroken/.github` används inte.
