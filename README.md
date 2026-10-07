# Avkroken

Avkrokens samlade applikationsrepository.

## Applikationer

- `apps/portal` — avkroken.denied.se
- `apps/skvallerbyttan` — nuvarande observationslager och dashboard
- `apps/ingest` — deploy-neutral provider-ingress-seam under extraction
- `apps/events` — deploy-neutral canonical event-ledger-seam under extraction
- `apps/spam-filter` — inkommande e-postfilter för denied.se
- `apps/jobb` — Jobb-applikationen
- `apps/dumpen` — Dumpen Worker och R2-baserad lagring

## Dokumentation

Börja i **[dokumentationsöversikten](docs/index.md)**.

- varje app äger sin egen dokumentation under respektive `apps/<app>/docs/`;
- repositorygemensam dokumentation för **detta monorepo** ligger under `docs/organization/`;
- externa Avkroken-repositories äger själva sin README, `docs/`, Wiki, Issues och Discussions.

`docs/organization/` är alltså inte en organisationsövergripande source of truth för andra repositories.

Varje applikation behåller sin egen runtime-, migrations- och paketkonfiguration. Root-CI kör respektive applikations befintliga valideringskommando separat.
