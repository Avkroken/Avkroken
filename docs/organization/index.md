# Avkrokens dokumentationsnav

Den här sidan är den centrala kartan över Avkrokens publika, versionsstyrda dokumentation.

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
- [Dumpen](https://github.com/Avkroken/Dumpen)
- [Jobb](https://github.com/Avkroken/Jobb)
- [Klarsprak](https://github.com/Avkroken/Klarsprak)
- [Krosa-Maja](https://github.com/Avkroken/Krosa-Maja)
- [Pastebinit](https://github.com/Avkroken/Pastebinit)
- [Politiker](https://github.com/Avkroken/Politiker)
- [Produkter](https://github.com/Avkroken/Produkter)
- [Skvallerbyttan](https://github.com/Avkroken/Skvallerbyttan)

## Så hänger ytorna ihop

```text
Avkroken/.github
  |
  +--> gemensamma standarder
  +--> central navigation
  +--> reusable workflows/community health
  |
  +--> Repository
         |
         +--> README.md       snabb ingång
         +--> docs/index.md   klickbar dokumentationskarta
         +--> docs/*.md       versionsstyrd teknisk källa
         +--> Wiki            lättnavigerad presentation
```

## Grundregel

Central dokumentation ska hjälpa läsaren hitta rätt och förstå gemensamma regler. Den ska inte kopiera projektens tekniska manualer.

När ett projekt ändras uppdateras dess egna docs. När en organisationsgemensam modell ändras uppdateras `.github`.
