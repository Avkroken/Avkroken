# Dokumentation

Navigationssida för Krösa-Maja.

## Hitta rätt

| Behov | Dokument |
| --- | --- |
| förstå runtime, protokoll och state | [Projektkontext](project-context.md) |
| förstå OAuth/OIDC-flöden och trust boundaries | [Arkitektur](architecture.md) |
| förstå provisioning, migration och deploy | [Deployment](deployment.md) |
| testa och felsöka tjänsten | [Drift](operations.md) |

## Systemkarta

```text
GitHub identity
      |
      v
 Krösa-Maja
 OAuth/OIDC authority
      |
      +--> D1 auth state
      +--> signing/JWKS
      +--> registered clients
      +--> optional linked provider tokens
      |
      v
downstream clients
```

## Protokollytor

Discovery annonseras från well-known endpoints. Protokollimplementationen ligger under Worker/authlagret och ska verifieras genom kontraktstester och en riktig testklient vid större ändringar.

## Ändringskarta

- auth/protokoll → architecture + tests
- schema → migration + deployment
- Worker bindings/routes → project-context + deployment
- signing/client registration → architecture + operations
- linked provider → architecture + securityverifiering

## Wiki

GitHub Wiki är aktiverad och är lämplig som navigerbar protokoll- och drifthandbok. Versionsstyrd Markdown här ska vara underlaget; Wiki ska inte innehålla unik känslig eller driftkritisk state.
