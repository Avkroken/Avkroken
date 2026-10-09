# Delad dokumentation för Avkroken/Avkroken

> **Scope:** Den här katalogen gäller endast `Avkroken/Avkroken` och apparna i detta monorepo. Den är inte source of truth för fristående Avkroken-repositories.

## Delade monorepodokument

| Dokument | Användning |
| --- | --- |
| [Dokumentationsmodell](documentation-standard.md) | README, app-docs och Wiki inom monorepot |
| [Repository-integration](repository-documentation.md) | hur root och `apps/*` delar dokumentation |
| [Engineering context](engineering-context.md) | gemensam teknisk/CI-kontext för monorepot |
| [Observability-programmet](observability-program.md) | program- och arbetsissues samt appägda kontrakt för observationsarkitekturen |
| [Access inventory](access-inventory.md) | publik klassificeringsmodell för monorepots webbappar |
| [Access path standard](access-path-standard.md) | accessprinciper för monorepots webbappar |
| [Cloudflare credential model](cloudflare-credential-standard.md) | stabil kod-/credentialmodell som används av monorepots berörda appar |
| [Stateful Preview-standard](preview-state-standard.md) | isolerade Preview-resurser, migrationsordning och fail-closed providergräns |
| [Temastandard](theme-standard.md) | gemensam temafamilj och presentationspersistens utan visuell homogenisering |

## Appdokumentation

- [Jobb](../../apps/jobb/README.md)
- [Skvallerbyttan](../../apps/skvallerbyttan/README.md)
- [Ingest](../../apps/ingest/README.md)
- [Events](../../apps/events/README.md)
- Portal: `apps/portal/`
- [Dumpen](../../apps/dumpen/README.md)

## Fristående repositories

Bastion, Docker-idempotent-update, Klarsprak, Pastebinit, Politiker och Produkter äger själva sin dokumentation, Wiki, Issues och Discussions. Denna katalog ska inte duplicera eller styra deras tekniska current-state.

Ingen central dokumentationsspegel används. Fristående repositories äger sina egna canonical dokument och instruktioner.

## Grundregel

Ändra information där den ägs:

- app-/repoimplementation → appens eller repositoryts egna docs;
- monorepo-gemensam implementation → denna katalog;
- GitHub/Cloudflare live-state → verifieras hos providern;
- samlad organisationsvy → genereras, inte handunderhålls som source of truth.
