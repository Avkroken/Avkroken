# Engineering context för blixten85/Avkroken

Det här dokumentet beskriver **repository-deklarerad** engineering-, CI- och dokumentationsstruktur för `blixten85/Avkroken`.

Det är inte en organisationsövergripande engineeringkälla för andra Avkroken-repositories.

Extern GitHub-/Cloudflare-state — exempelvis plan, aktiva rulesets, webhookkonfiguration, tokenpermissions eller deploymentintegrationer — verifieras hos respektive provider när sådan state spelar roll.

## Repositorystruktur

`blixten85/Avkroken` är ett publikt monorepository med applikationer under `apps/`.

Publikt versionsstyrda applikationsytor omfattar:

- Portal,
- Skvallerbyttan,
- Jobb.

Fristående publika Avkroken-repositories har sin egen kod, dokumentation, Wiki, Issues, Discussions och CI.

`blixten85/.github` är separat för organisationsprofil/community health och kan bära en genererad dokumentationsspegel.

## Repository-lokal CI

`.github/workflows/ci.yml` i monorepot deklarerar verifiering för monorepots appar. Att ett checknamn finns i workflowen betyder inte i sig att det är required i extern GitHub-governance.

## Deploy- och driftworkflows

Monorepot kan innehålla repository-lokala workflows för sina appar. Workflowfiler beskriver vad Actions kan göra när de körs; de är inte bevis på att extern providerstate är provisionerad.

## Säkerhetsmodell

- `pull_request_target` får inte användas för att exekvera opålitlig PR-head-kod.
- Secrets, tokens och privata nycklar får inte dokumenteras eller loggas.
- Provider-write ska inte införas i Skvallerbyttans observationsruntime.
- Extern enforcement verifieras i GitHub i stället för att antas från dokumentation.

## Dokumentation

- root-README är ingång till monorepot;
- `docs/organization/` innehåller endast monorepo-delad kontext;
- Jobb äger sin appdokumentation under `apps/jobb/docs/`;
- Skvallerbyttan äger sin appdokumentation under `apps/skvallerbyttan/docs/`.

Fristående repositories ska inte hänvisa hit för sin egen tekniska current-state.

## Operativ heartbeat

Repositorykoden deklarerar intern heartbeat mellan Skvallerbyttan och Portal via Cloudflare Service Binding. Kodens payloadformat, intervall och mottagarlogik kan dokumenteras här eller i berörd app. Faktisk deployment/providerstate verifieras live.

## Historik

Repositoryflyttar och konsolidering hör hemma i Git-historik/migrationsdokumentation och ska inte användas som källa för nuvarande extern governance-state.
