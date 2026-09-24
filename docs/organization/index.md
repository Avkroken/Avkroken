# Avkrokens dokumentationsnav

Den här sidan är den centrala kartan över Avkrokens versionsstyrda organisations- och projektdokumentation.

## Gemensamma standarder

| Dokument | Användning |
| --- | --- |
| [Dokumentationsstandard](documentation-standard.md) | README, docs, Wiki och uppdateringskontrakt |
| [Repository-integration](repository-documentation.md) | hur centralt och repo-lokalt innehåll kopplas ihop |
| [Engineering context](engineering-context.md) | gemensam teknisk/CI-kontext |
| [Access inventory](access-inventory.md) | dokumenterad accessyta |
| [Access path standard](access-path-standard.md) | gemensamma accessvägar |
| [Cloudflare credential standard](cloudflare-credential-standard.md) | credentialmodell för berörda Cloudflare-flöden |

## Projektdokumentation

Varje projekt äger sin egen README och `docs/`. Gå via repositoryts README för aktuell projektkarta.

- [Bastion](https://github.com/Avkroken/Bastion)
- [Docker-idempotent-update](https://github.com/Avkroken/Docker-idempotent-update)
- [Jobb](../../apps/jobb/README.md)
- [Klarsprak](https://github.com/Avkroken/Klarsprak)
- [Pastebinit](https://github.com/Avkroken/Pastebinit)
- [Politiker](https://github.com/Avkroken/Politiker)
- [Produkter](https://github.com/Avkroken/Produkter)
- [Skvallerbyttan](../../apps/skvallerbyttan/README.md)
- [Avkroken portal](../../apps/portal/)

## Så hänger ytorna ihop

```text
Avkroken/Avkroken
  |
  +--> docs/organization     gemensamma standarder
  +--> apps/*                samlade applikationer
  +--> .github/workflows     repository-lokal CI
  |
  +--> fristående repository
         |
         +--> README.md       snabb ingång
         +--> docs/index.md   klickbar dokumentationskarta
         +--> docs/*.md       versionsstyrd teknisk källa
         +--> Wiki            lättnavigerad presentation

Avkroken/.github
  +--> publik organisationsprofil och community health-filer
```

## Grundregel

Central dokumentation ska hjälpa läsaren hitta rätt och förstå gemensamma regler. Den ska inte kopiera projektens tekniska manualer.

När ett projekt ändras uppdateras dess egna docs. När en organisationsgemensam modell ändras uppdateras `docs/organization/` i `Avkroken/Avkroken`.
