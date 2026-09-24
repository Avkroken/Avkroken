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

Avkroken kör GitHub Free och de aktuella repositories är publika.

Varje repository använder ett eget branch-ruleset för default branch. Organisationens tidigare rulesets och cross-repository required/reusable workflows är inte längre CI-policykällan.

Repository-rulesetet ska skydda default branch och kräva de faktiska status checks som repositoryts lokala workflows producerar. Separata rulesets per språk, runtime eller plattform används inte.

Custom Properties kan behållas som metadata/inventering men binder inte CI-policy.

## Repository-lokal CI

Varje repository äger sina egna workflows under `.github/workflows/`.

CI som ska blockera merge triggar på `pull_request` mot `main` och, där merge queue stöds, `merge_group`.

Cross-repository `workflow_call` till `Avkroken/.github` används inte.

`Avkroken/.github` är fortsatt central dokumentations- och organisationskontext, men är inte runtime-provider för andra repositories.

## Required checks per repository

- Docker-idempotent-update: `Dependency review`, `Python`, `Docker`.
- Produkter: `Dependency review`, `Node and Cloudflare`, `Python`, `Container security / app`, `Container security / scraper`.
- Pastebinit: `Dependency review`, `Python 3.10`, `Python 3.14`.
- Politiker: `Dependency review`, `Node and Cloudflare`, `Python`, `Docker`.
- Bastion: `Swift package (ubuntu-latest)`, `Swift package (macos-latest)`, `Apple applications`, `Rust`, `.NET tests`, `Windows application`, `Android Gradle`, `Generate dependency graph`.
- Klarsprak: `Dependency review`, `Node and Cloudflare`.
- Dumpen: `Dependency review`, `Node and Cloudflare`.
- Skvallerbyttan: `Dependency review`, `Node and Cloudflare`.
- .github: `Dependency review`, `Portal`.
- Jobb: `Dependency review`, `Node and Cloudflare`.
- Krosa-Maja: `Dependency review`, `Node and Cloudflare`.

## GitHub Free och säkerhet

Betald GitHub Code Security/Secret Protection ska inte antas finnas.

Dependency Review är tillgängligt för publika repositories på GitHub.com och används som lokal PR-check där repositoryts dependency snapshots är kompletta och stabila. Bastion undantas tills dess blandade snapshot-topologi ger en komplett och jämförbar head-snapshot.

Code scanning/CodeQL och secret scanning kan användas där de är tillgängliga för publika repositories, men de är inte separata required ruleset-regler i den här baslinjen.

## Auto-assignment och pull_request_target

Auto-assignment är repository-lokal och använder repositoryts eget `GITHUB_TOKEN`.

`pull_request_target` används endast för metadataautomation. Sådana workflows får inte checka ut eller exekvera PR-head-kod.

## Publik dokumentation

`README.md` är kort ingång och `docs/` är canonical source för utförlig publik dokumentation.

Skvallerbyttans GitHub Pages-workflow är repository-lokal. `Avkroken/.github` tillhandahåller inte längre ett centralt Pages-workflow.

Portalens dokumentationsnav, provider-webhooks och Cloudflare Service Bindings påverkas inte av CI-decentraliseringen.

## Operativ heartbeat och watchdog

Skvallerbyttan skickar heartbeat via Cloudflare Service Binding till live Worker-tjänsten `avkroken`, entrypoint `OperationalHeartbeatService`.

Portalen lagrar heartbeat-state i Durable Object `OperationalWatchdog`. Watchdog-cron kör var 10:e minut, heartbeat förväntas var 15:e minut och betraktas som utebliven efter 35 minuter.

Heartbeat innehåller endast tjänstenamn, tidsstämpel, ready-värde och booleska readiness-resultat. Credentials och hemligheter skickas inte.

Cloudflare Email Service-bindingen heter `OPS_EMAIL`. Mottagare och avsändare är icke-hemliga Worker-vars `OPS_NOTIFY_TO` och `OPS_NOTIFY_FROM`.

## Migreringsordning

Den här cleanup-PR:n i `Avkroken/.github` ska mergas sist, efter att repository-lokala workflow-PR:er är mergade och deras required checks har lagts till i respektive `main-protection`.

När det är gjort finns inga executable callers kvar till `Avkroken/.github/.github/workflows/...`.
