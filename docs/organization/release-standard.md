# Release- och versionsstandard — Avkroken/Avkroken

**Senast verifierad:** 2026-10-07

Det här dokumentet gäller **Avkroken/Avkroken-monorepot**. Fristående repositories äger sina egna releasekontrakt.

## Syfte

Repositoryts historik ska vara maskinläsbar för SemVer och GitHub Releases. GitHub Releases med immutable SemVer-taggar är den kanoniska versionerade releasehistoriken.

Releaseautomation är repo-lokal och får inte vara beroende av organisationsgemensamma workflows, organisationssecrets eller bypass.

## PR-titlar och merge queue

Pull request-titlar ska följa Conventional Commits:

```text
<type>[optional scope][!]: <description>
```

Tillåtna typer är `feat`, `fix`, `perf`, `refactor`, `docs`, `test`, `build`, `ci`, `chore` och `revert`.

Scope är valfri och ska vara tekniskt relevant, exempelvis `portal`, `jobb`, `skvallerbyttan`, `ingest`, `events` eller `dumpen`.

`!` eller en `BREAKING CHANGE:`-footer markerar breaking change.

`.github/workflows/pr-title.yml` validerar titeln på pull request-event. På `merge_group` gör workflown en pass-through eftersom titeln redan verifierats på pull requesten. Workflown använder inga secrets och har `permissions: {}`.

## SemVer-kontrakt

Vid automatisk versionsberäkning gäller:

- breaking change → **major**;
- `feat` → **minor**;
- `fix`, `perf` och `revert` → **patch**;
- `refactor`, `docs`, `test`, `build`, `ci` och `chore` skapar normalt ingen release ensamma;
- `Release-As: major|minor|patch|none` får användas för explicit klassificering men får aldrig sänka en breaking change under major.

Versionsnummer är releasekontrakt, inte deployräknare. Apparnas egna build-/packageversioner ändras inte automatiskt av repositoryreleasen.

## Automatiskt releaseflöde

`.github/workflows/release.yml` är den repo-lokala releaseprocessen.

Normal väg:

```text
PR
  -> Conventional Commit-kompatibel PR-titel
  -> ordinarie CI/review
  -> merge till main
  -> samma main-SHA verifieras av push-CI
  -> semantic release beräknar högsta nödvändiga SemVer-bump
  -> GitHub Release skapas som draft
  -> draften publiceras och låser immutable SemVer-taggen
```

En merge utan releasevärdig förändring skapar ingen release.

Releasejobbet:

- kör endast mot `refs/heads/main`;
- serialiserar releasekörningar så att samtidiga push- och manuella körningar inte kan skapa konkurrerande taggar;
- kräver de checks som listas i `.github/release-required-checks`;
- publicerar aldrig innan dessa checks observerats och passerat på release-target SHA;
- vägrar avancera från en SemVer-tagg som saknar motsvarande GitHub Release;
- använder full Git-historik och endast releaseankare som är nåbara från release-target;
- skapar alltid den nya GitHub Release som draft och publicerar först därefter, så att immutable release-låsningen sker atomiskt vid publicering;
- återanvänder aldrig ett taggnamn som GitHub markerar som permanent förbrukat av en tidigare immutable release. Om ett normalt patch/minor/major- eller RC-taggnamn är tombstonat avancerar releasern inom samma versionsklass och försöker nästa namn; promotion av en aktiv RC failar däremot stängt eftersom den inte får byta versionskärna.

För första release i ett repository utan tidigare SemVer-tagg används `.github/release-baseline` som explicit historikgräns.

## Required checks

För Avkroken/Avkroken kräver releaseprocessen push-verifiering av:

- Portal;
- Skvallerbyttan;
- Ingest;
- Events;
- Spam filter;
- Krosa-Maja retirement guard;
- Jobb;
- Dumpen.

Dependency review är en PR/merge-group-kontroll och körs inte på vanlig main-push.

Releaseprocessen får inte användas för att kringgå PR-checks, reviews, rulesets eller andra repositoryskydd.

## Prereleases

Manuell `workflow_dispatch` kan skapa release candidates i formen:

```text
vMAJOR.MINOR.PATCH-rc.N
```

RC-numret sorteras numeriskt. Om en starkare SemVer-förändring tillkommer efter en aktiv RC startas en ny RC-serie på den högre versionskärnan.

Promotion från RC till stable ska alltid tagga **samma commit som den aktiva RC-taggen**. Senare commits på `main` får inte smygas in i promotionen.

## Release notes

Varje commit placeras i exakt en release-note-kategori. Breaking changes behåller sin grundkategori, exempelvis Features eller Fixes, och markeras samtidigt som breaking i texten.

Detta bevarar Portalens changelog-filter utan att samma commit dupliceras i flera sektioner.

GitHub Releases är canonical. Inför inte en konkurrerande manuellt underhållen global changelog eller `version.txt` för repositoryversionen.

## Credentials och permissions

Normal release använder repositoryts GitHub Actions `GITHUB_TOKEN` med minsta permissions för releasejobbet:

- `contents: write` för tagg/GitHub Release;
- `actions: read`, `checks: read` och `statuses: read` för release-gaten.

Övriga jobb behåller read-only eller tomma permissions efter behov.

Canonical SemVer-/GitHub Release-publication använder ingen PAT, bypass eller utökad provider-writeidentitet. Det valfria rådgivande Copilot-jobbet är separat och använder endast den read-only `COPILOT_GITHUB_TOKEN` som beskrivs nedan.

## Deployment

GitHub Release och runtime-deployment är separata operationer. En repositoryrelease får inte implicit deploya Portal, Jobb, Skvallerbyttan, Ingest, Events, Dumpen eller annan runtime om inte respektive deployments kontrakt uttryckligen säger det.

## Hotfix och rollback

Hotfix utgår normalt från aktuell `main` och använder `fix:` när ändringen är bakåtkompatibel.

Publicerade taggar och GitHub Releases skrivs inte om. Vid felaktig release:

1. korrigera eller revert:a via vanlig PR;
2. kör normal verifiering;
3. mergea till `main`;
4. låt releaseprocessen skapa en ny korrigerande SemVer-version.

Force-push och tag history rewrite används inte.

## Verifiering

Vid förändring av releasekontraktet ska minst följande verifieras:

- PR-title-workflow på pull request och merge queue;
- release-scriptets SemVer-, RC- och breaking-logik;
- explicit first-release-baseline där SemVer-tagg saknas;
- push-CI för samtliga required checks;
- att release-target SHA är samma SHA som verifierats;
- att promotion pekar på aktiv RC-commit;
- att gammal misslyckad releasekörning inte blockerar en senare lyckad recovery;
- att GitHub Release fortsatt är repositoryts kanoniska versionshistorik.

## Copilot-sammanfattning

Efter en lyckad canonical `Release`-körning kan ett separat follow-up-workflow köra den SHA-pinnade `github/copilot-release-notes`-actionen. `Release` lämnar endast över den exakta release-rangen (`base_ref` och `target_sha`) i ett kortlivat, icke-hemligt Actions-artifact med en dags retention. Follow-up-workflowet har endast `actions: read`, `contents: read` och `pull-requests: read` och deltar därför inte i `release.yml`-körningens serialiseringslås. Det inbyggda `GITHUB_TOKEN` används med dessa read-only-rättigheter för Actions-artifact, repository- och PR-metadata; det separata `COPILOT_GITHUB_TOKEN` används endast för Copilot-anrop. Follow-up-körningen checkar endast ut den konstanta, betrodda `main`-grenen med full historik; dynamiska refs från `workflow_run` eller artifactet används aldrig som checkout-target. Den exakta release-rangen från artifactet skickas enbart som base/head-data till den pinnade actionen.

Copilot CLI förinstalleras i exakt version `1.0.90` innan `COPILOT_GITHUB_TOKEN` exponeras, så actionen använder den redan installerade binären i stället för att hämta en flytande CLI-version. `COPILOT_GITHUB_TOKEN` ska vara en least-privilege fine-grained PAT med `Copilot Requests: Read` och en tokenägare med aktiv Copilot-licens. Workflown skapar eller roterar ingen credential. Om artifactet eller secreten saknas, installationen misslyckas eller Copilot-genereringen fallerar påverkas inte den redan färdigställda canonical releasen.

Copilot-resultatet publiceras endast i follow-up-körningens GitHub Actions run summary som rådgivande text. Det skrivs inte in i den kanoniska GitHub Release-body:n. SemVer, release-target, required checks och release notes i GitHub Release fortsätter därför att komma enbart från `semantic_release.py`; osäkra eller ofullständiga AI-resultat kan aldrig ändra canonical changelog. Upstream v1.0.3 kan dessutom missa rebase-mergade PR:er; Copilot-resultatet får därför inte användas som bevis på full release-täckning.
