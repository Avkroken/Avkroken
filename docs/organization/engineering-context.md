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

Avkroken kör GitHub Free. Repository-visibility är live provider-state och ska inte antas från dokumentation; publika repositories kan använda repository-rulesets enligt den aktuella planens stöd.

Varje repository använder ett eget branch-ruleset för default branch. Organisationens tidigare rulesets och cross-repository required/reusable workflows är inte längre CI-policykällan.

Repository-rulesetet ska skydda default branch och kräva de faktiska status checks som repositoryts lokala workflows producerar. Separata rulesets per språk, runtime eller plattform används inte.

Custom Properties kan behållas som metadata/inventering men binder inte CI-policy.

## Repository-lokal CI

Varje repository äger sina egna workflows under `.github/workflows/`.

CI som ska blockera merge triggar på `pull_request` mot `main` och, där merge queue stöds, `merge_group`.

Cross-repository `workflow_call` till `Avkroken/.github` används inte.

`Avkroken/Avkroken` och `docs/organization/` är central teknisk organisationskontext. `Avkroken/.github` är endast publik organisationsprofil/community health-yta.

## Required checks per repository

- Docker-idempotent-update: `Dependency review`, `Python`, `Docker`.
- Produkter: `Dependency review`, `Node and Cloudflare`, `Python`, `Container security / app`, `Container security / scraper`.
- Pastebinit: `Dependency review`, `Python 3.10`, `Python 3.14`.
- Politiker: `Dependency review`, `Node and Cloudflare`, `Python`, `Docker`.
- Bastion: `Swift package (ubuntu-latest)`, `Swift package (macos-latest)`, `Apple applications`, `Rust`, `.NET tests`, `Windows application`, `Android Gradle`, `Generate dependency graph`.
- Klarsprak: `Dependency review`, `Node and Cloudflare`.
- Avkroken monorepo: `Dependency review`, `Portal`, `Skvallerbyttan`, `Krosa-Maja`, `Jobb`.

## GitHub Free och säkerhet

Betald GitHub Code Security/Secret Protection ska inte antas finnas.

Dependency Review är tillgängligt för publika repositories på GitHub.com och används som lokal PR-check där repositoryts dependency snapshots är kompletta och stabila. Bastion undantas tills dess blandade snapshot-topologi ger en komplett och jämförbar head-snapshot.

Code scanning/CodeQL används där GitHub exponerar stödet. För `Avkroken/Avkroken` är CodeQL ett separat `Require code scanning results`-krav i rulesetet, inte ett vanligt required status-check.

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

Portal, Skvallerbyttan, Krosa-Maja och Jobb ligger i `Avkroken/Avkroken` under `apps/`. Deras merge-gates produceras av monorepots repository-lokala CI. Cross-repository workflow reuse via `Avkroken/.github` används inte.
