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

`Avkroken/Avkroken` är privat. På den aktuella planen är repository-rulesets inte tillgängliga för detta privata repository; GitHubs live API svarar med krav på uppgradering eller publik visibility. Det tidigare `main`-rulesetet är därför inte en aktiv enforcement-yta så länge repositoryt är privat på Free.

Övriga publika fristående repositories kan fortsatt använda repository-rulesets enligt planens stöd.

Organisationens tidigare rulesets och cross-repository required/reusable workflows är inte längre CI-policykällan. I monorepot är PR + CI fortfarande den avsedda arbetsmodellen, men den upprätthålls processmässigt snarare än av branch/ruleset-enforcement på nuvarande plan.

Custom Properties kan behållas som metadata/inventering men binder inte CI-policy.

## Repository-lokal CI

Varje repository äger sina egna workflows under `.github/workflows/`.

Monorepots canonical CI triggar på `pull_request` mot `main` och `merge_group`. De fyra appcheckarna ska vara gröna före merge även när GitHub Free inte kan enforcea dem på det privata repositoryt.

Cross-repository `workflow_call` till `Avkroken/.github` används inte.

`Avkroken/Avkroken` och `docs/organization/` är central teknisk organisationskontext. `Avkroken/.github` är endast publik organisationsprofil/community health-yta.

## Canonical CI checks

- Docker-idempotent-update: `Dependency review`, `Python`, `Docker`.
- Produkter: `Dependency review`, `Node and Cloudflare`, `Python`, `Container security / app`, `Container security / scraper`.
- Pastebinit: `Dependency review`, `Python 3.10`, `Python 3.14`.
- Politiker: `Dependency review`, `Node and Cloudflare`, `Python`, `Docker`.
- Bastion: `Swift package (ubuntu-latest)`, `Swift package (macos-latest)`, `Apple applications`, `Rust`, `.NET tests`, `Windows application`, `Android Gradle`, `Generate dependency graph`.
- Klarsprak: `Dependency review`, `Node and Cloudflare`.
- Avkroken monorepo: `Portal`, `Skvallerbyttan`, `Krosa-Maja`, `Jobb` (processkrav på privat Free; inte ruleset-enforced).

## GitHub Free och säkerhet

Betald GitHub Code Security/Secret Protection ska inte antas finnas.

Dependency Review används på publika repositories där stödet finns och dependency snapshots är kompletta och stabila. I det privata `Avkroken/Avkroken` på GitHub Free är GitHubs Dependency Review inte tillgängligt; live-körningen returnerar att Dependency graph + GitHub Advanced Security krävs. Monorepot förlitar sig därför på respektive apps install-/lockfile-validering i CI.

Code scanning/CodeQL används där GitHub exponerar stödet. För det privata `Avkroken/Avkroken` på nuvarande Free-plan finns ingen aktiv ruleset-baserad CodeQL-enforcement. Tidigare CodeQL-resultat från den publika fasen är historik, inte aktuell merge-policy.

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

Portal, Skvallerbyttan, Krosa-Maja och Jobb ligger i det privata `Avkroken/Avkroken` under `apps/`. Monorepots repository-lokala CI producerar de fyra canonical appcheckarna. Cross-repository workflow reuse via `Avkroken/.github` används inte.
