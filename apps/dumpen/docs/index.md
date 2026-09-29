# Dokumentation

Det här är navigationssidan för Dumpens versionsstyrda dokumentation.

## Läs efter behov

| Om du vill… | Läs |
| --- | --- |
| förstå vad tjänsten ansvarar för och vilken runtime som gäller | [Projektkontext](project-context.md) |
| förstå requestflöde, routing och state ownership | [Arkitektur](architecture.md) |
| köra, verifiera, förstå CI/Workers Builds, deploya eller felsöka tjänsten | [Drift](operations.md) |
| rapportera en sårbarhet | [Säkerhet](../SECURITY.md) |

## Systemet i korthet

```text
Internet
  |
  v
dumpen.denied.se
  |
  v
src/access.js
  |  publik root / robots / admin-policy / response-policy
  v
src/index.js
  |
  +--> R2: DUMPEN
```

`src/access.js` är den externa gränsen. `src/index.js` äger applikationslogiken och använder R2-bindingen `DUMPEN`.

## Ändringskarta

När du ändrar:

- **routing, robots, redirects eller response headers** — uppdatera [architecture.md](architecture.md) och verifiera checklistan i [operations.md](operations.md);
- **R2-användning eller objektmodell** — uppdatera projektkontext och arkitektur;
- **Wrangler bindings, domain eller observability** — uppdatera [project-context.md](project-context.md);
- **scripts, tests eller deploykommandon** — uppdatera [operations.md](operations.md);
- **GitHub Actions/root-CI eller Workers Builds-kontrakt** — uppdatera [operations.md](operations.md) och relevant root-workflow.
