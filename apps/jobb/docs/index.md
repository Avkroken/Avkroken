# Dokumentation

Navigationssida för Jobb.

## Hitta rätt

| Område | Dokument |
| --- | --- |
| runtime och current-state | [Projektkontext](project-context.md) |
| komponenter, state och trust boundaries | [Arkitektur](architecture.md) |
| dashboardauth/OIDC | [Authentication](authentication.md) |
| automation, quota och körningsmodell | [Automation](automation.md) |
| providerintegrationer | [Providers](providers.md) |
| discovery/sökning | [Discovery](discovery.md) |
| verifiering, deployment och incidenter | [Drift](operations.md) |

## Systemöversikt

```text
Dashboard / scheduler
        |
        v
Cloudflare Worker
  |      |       |
  |      |       +--> Browser Run
  |      +----------> Workflows
  +-----------------> D1 canonical state
  +-----------------> R2 evidence
  +-----------------> Email / provider integrations
```

## Vanliga läsvägar

### Ändra automationslogik

Läs Automation, Project context och Operations. Säkerställ att quota/fail-closed-regler fortsatt håller.

### Ändra provider

Läs Providers och Architecture. Separera providerfel från workflow/statefel.

### Ändra dashboardauth

Läs Authentication och Architecture innan routes/session/OIDC-konfiguration ändras.

### Ändra Browser Run

Läs Architecture, Providers och Operations. Browser Run är en tydlig integrationsgräns och ska inte spridas in i domänlogiken.

## Data ownership

- D1: canonical run/application state.
- R2: evidence/stöddata.
- Workflow: exekveringsorkestrering.
- Browser Run: browserbaserad providerinteraktion.
- Dashboard: presentation/operativ kontroll, inte alternativ source of truth.

## Wiki

GitHub Wiki är aktiverad och lämpar sig för en klickbar guide genom automation, providers, auth och drift. Versionsstyrda dokument här är underlaget; Wiki ska inte bära unik current-state.
