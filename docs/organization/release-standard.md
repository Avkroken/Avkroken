# Release- och versionsstandard — Avkroken/Avkroken

**Senast verifierad:** 2026-09-25

Det här dokumentet gäller **Avkroken/Avkroken-monorepot**. Fristående repositories äger sina egna motsvarande releasekontrakt och ska inte behandla den här filen som sin tekniska source of truth.

## Syfte

Repositoryts squash-mergehistorik ska vara maskinläsbar för SemVer, release notes och framtida releaseautomation utan att varje merge automatiskt blir en release.

GitHub Releases är den officiella releasehistoriken som Avkroken Portalens Changelog kan konsumera.

## PR-titlar och squash commits

Pull request-titlar ska följa Conventional Commits:

```text
<type>[optional scope][!]: <description>
```

Tillåtna typer:

- `feat` — ny funktion;
- `fix` — buggfix;
- `perf` — prestandaförändring;
- `refactor` — beteendebevarande omstrukturering;
- `docs` — dokumentation;
- `test` — tester;
- `build` — build-/paketeringssystem;
- `ci` — CI/CD;
- `chore` — underhåll utan produktfunktion;
- `revert` — återställning av tidigare förändring.

Scope är valfri och ska vara kort och tekniskt relevant, exempelvis `portal`, `jobb` eller `skvallerbyttan`.

`!` markerar en breaking change:

```text
feat(portal)!: replace public route contract
```

Workflow `.github/workflows/pr-title.yml` validerar detta på `pull_request`. Workflown använder inga secrets, checkar inte ut repositoryt och har `permissions: {}`.

## SemVer-kontrakt

När en versionerad release skapas gäller:

- breaking change (`!` eller motsvarande uttrycklig breaking release-not) → **major**;
- `feat` → normalt **minor**;
- `fix` → normalt **patch**;
- `docs`, `test`, `chore`, `ci` och `build` skapar normalt inte en release ensamma;
- `perf` och `refactor` bedöms utifrån faktisk releaseeffekt. De får inte automatiskt beskrivas som en feature enbart för att tvinga versionshöjning.

Versionsnummer är releasekontrakt, inte deployräknare. Produktionsdeployment och GitHub Release är separata operationer om repositoryts runtimeflöde kräver det.

## När en release ska ske

Release ska vara kuraterad, inte ske på varje merge.

En release är motiverad när minst ett av följande gäller:

- en användar- eller operatörsrelevant funktion är redo;
- en fix bör få en officiell versionspunkt;
- en breaking förändring behöver ett tydligt kompatibilitetsankare;
- flera färdiga förändringar ska samlas till en begriplig produkt-/repositoryrelease.

Dokumentations-, test- eller CI-underhåll behöver normalt ingen egen version om det inte finns en konkret konsumenteffekt som kräver en release.

## Release-PR-modell

Målflödet är:

```text
main changes
  -> Conventional Commit-historik
  -> release-PR
  -> CHANGELOG/version
  -> gröna relevanta checks
  -> merge av release-PR
  -> tag
  -> GitHub Release
```

Release-PR får inte mergeas för att "komma runt" CI, review eller repositoryregler. Ingen bypass används.

## Automation — verifierad current state

Automatisk release-PR är **inte aktiverad ännu**.

Release Please är tekniskt väl lämpat för målflödet och stödjer Conventional Commits, release-PR, CHANGELOG, SemVer-taggar och GitHub Releases. Men den normala GitHub Actions-integrationen med repositoryts `GITHUB_TOKEN` skapar PR:er/taggar som inte triggar efterföljande GitHub Actions-workflows.

Det strider mot repositoryts krav att release-PR ska kunna verifieras med normala CI-checks före merge.

Upstreamreferens: `https://github.com/googleapis/release-please-action#other-actions-on-release-please-prs`.

Följande lösningar är därför inte tillåtna som genväg:

- skapa en ny PAT utan separat godkänt credentialbeslut;
- återanvända eller utöka Skvallerbyttans/Gamnackens read-only GitHub App för release-write;
- lätta CI-/review-/branchskydd;
- mergea en botgenererad release-PR utan relevant verifiering.

Full releaseautomation är blockerad tills ett least-privilege write-identitetsflöde eller en annan CI-kompatibel automationsmodell är uttryckligen vald.

## Repositoryversion kontra appversion

Monorepot innehåller flera appar med egna runtimekontrakt. En framtida repositoryrelease får därför inte automatiskt skriva över apparnas package-/buildversioner.

Innan full automation aktiveras ska releasekonfigurationen uttryckligen ange om versionen gäller:

- hela repositoryt;
- en specifik app/komponent;
- eller flera manifestkomponenter.

Inför inte en generell `version.txt` som ny canonical version enbart för att ett releaseverktyg kräver det.

## Prereleases

Prereleases skapas endast när en konkret distributionsmodell kräver dem. Använd SemVer-suffix, exempelvis `-rc.1`, och dokumentera vilken publik/kanal som förväntas konsumera prereleasen.

Prerelease är inte default för vanlig main-release.

## Hotfix

Hotfix utgår normalt från aktuell `main` och använder `fix:` om ändringen är bakåtkompatibel.

Separat maintenance branch införs inte ad hoc. Om en äldre major/minor måste stödjas parallellt är det ett explicit release-/branchbeslut.

## Rollback och korrigering

Publicerade taggar och GitHub Releases ska inte skrivas om för att dölja ett fel.

Vid felaktig release:

1. återställ koden via vanlig PR om rollback behövs;
2. kör normal verifiering;
3. skapa en ny korrigerande patch/minor/major enligt ändringens SemVer-effekt;
4. dokumentera relationen till den felaktiga releasen i den nya release-noten.

Tag history rewrite och force-push används inte.

## Verifiering

Vid förändring av releasekontraktet ska minst följande verifieras:

- PR-title-workflowens regex och events;
- att workflown saknar secrets och write-permissions;
- att squash-merge ger en Conventional Commit-kompatibel commitrubrik;
- att releaseverktygets framtida credentialmodell inte försvagar CI eller repositoryregler;
- att GitHub Release fortsatt är canonical releasehistorik för Portalens Changelog.

## Kvarvarande blocker

Full releaseautomation kräver ett separat, verifierat beslut om write-identitet eller en alternativ modell som kan skapa release-PR **och** få normal CI att köras utan ny osäker credential eller bypass.
