# Avkroken

Avkrokens samlade applikationsrepository.

## Applikationer

- `apps/portal` — avkroken.denied.se
- `apps/skvallerbyttan` — observationslager och dashboard
- `apps/jobb` — Jobb-applikationen

## Dokumentation

Börja i **[dokumentationsöversikten](docs/index.md)**.

- varje app äger sin egen dokumentation under respektive `apps/<app>/docs/`;
- repositorygemensam dokumentation för **detta monorepo** ligger under `docs/organization/`;
- externa Avkroken-repositories äger själva sin README, `docs/`, Wiki, Issues och Discussions.

`docs/organization/` är alltså inte en organisationsövergripande source of truth för andra repositories.

Varje applikation behåller sin egen runtime-, migrations- och paketkonfiguration. Root-CI kör respektive applikations befintliga valideringskommando separat.
