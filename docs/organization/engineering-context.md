# Avkroken engineering context

Det här dokumentet är Avkrokens versionsstyrda tekniska kontext för repository-regler och CI.

**Senast verifierad:** 2026-09-24

## Auktoritet

Vid konflikt gäller:

1. GitHubs aktiva repository-inställningar och repository-rulesets.
2. Filer på aktuell `main` i berört repository.
3. Det här dokumentet.
4. Äldre historik.

## Repositorymodell

`Avkroken/Avkroken` är den samlade interna repositoryytan för:

- `apps/portal`
- `apps/skvallerbyttan`
- `apps/krosa-maja`
- `apps/jobb`
- `docs/organization`

`Avkroken/.github` ska endast bära GitHub-organisationsprofil och gemensamma publika community-filer. Det är inte längre runtime-, CI- eller intern dokumentationskälla.

Övriga fristående projekt behåller repository-lokal CI och egna branch-rulesets.

## Monorepots ruleset

Default branch skyddas av repository-rulesetet `main` utan bypass actors.

Required checks:

- `Dependency review`
- `Portal`
- `Skvallerbyttan`
- `Krosa-Maja`
- `Jobb`

CodeQL hanteras separat genom ruleset-regeln **Require code scanning results** med GitHubs default setup.

## CI

Root-workflowen under `.github/workflows/ci.yml` äger monorepots merge gates. Varje app valideras från sin egen katalog och behåller sin runtimekonfiguration där.

Cross-repository `workflow_call` till `Avkroken/.github` används inte.

`pull_request_target` får endast användas för metadataautomation och får inte checka ut eller exekvera PR-head-kod.

## Drift

Produktionsdeploy och andra driftmutationer är separata åtgärder och sker inte som bieffekt av vanlig PR-CI.

Skvallerbyttans observationsarkitektur är read-only mot providers.

## Dokumentation

Intern applikations- och driftkontext för monorepot hör hemma i `Avkroken/Avkroken`, inte i det publika `.github`-förrådet.

Arbetsgrenar följer `{agent}/{feature}/{YYYY-MM-DD}/{HH-mm}-{id}`.
