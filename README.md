# Avkroken

Avkrokens samlade applikationsrepository.

## Applikationer

- `apps/portal` — avkroken.denied.se
- `apps/skvallerbyttan` — observationslager och dashboard
- `apps/jobb` — Jobb-applikationen

Organisationsgemensam teknisk dokumentation ligger under `docs/organization`.

Varje applikation behåller sin egen runtime-, migrations- och paketkonfiguration. Root-CI kör respektive applikations befintliga valideringskommando separat.
