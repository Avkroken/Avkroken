# Avkroken

Avkrokens privata samlade applikationsrepository.

## Applikationer

- `apps/portal` — avkroken.denied.se
- `apps/skvallerbyttan` — observationslager och dashboard
- `apps/krosa-maja` — autentisering/OAuth
- `apps/jobb` — Jobb-applikationen

Organisationsgemensam intern dokumentation ligger under `docs/organization`.

Varje applikation behåller sin egen runtime-, migrations- och paketkonfiguration. Root-CI kör respektive applikations befintliga valideringskommando separat.
