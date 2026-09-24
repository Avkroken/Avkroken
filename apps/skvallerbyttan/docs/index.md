---
layout: default
title: Skvallerbyttan
permalink: /
---

# Skvallerbyttan

Skvallerbyttan är ett read-only observationslager för GitHub och Cloudflare. Dashboard och maskinklienter använder samma normaliserade underlag.

## Dokumentationskatalog

| Område | Innehåll |
| --- | --- |
| [Arkitektur]({{ '/architecture/' | relative_url }}) | Provider-adapters, canonical state, cache, D1, Analytics Engine och reconciliation. |
| [API]({{ '/api/' | relative_url }}) | Versionerat normaliserat API, auth, schema och routes. |
| [Permissions]({{ '/permissions/' | relative_url }}) | GitHub- och Cloudflare-permissionmatriser och read-only-gräns. |
| [Drift]({{ '/operations/' | relative_url }}) | Migrationer, retention, metrics, reconciliation och verifiering. |
| [Säkerhet]({{ '/security/' | relative_url }}) | Auth, machine access, raw-data-policy och webhookintegritet. |
| [Projektkontext]({{ '/project-context/' | relative_url }}) | Repository- och arkitekturkontext som ska hållas i synk med implementationen. |

## Läs efter uppgift

- **Ny i systemet:** börja med Arkitektur och Projektkontext.
- **Bygger klient:** läs API och Permissions.
- **Felsöker drift:** läs Drift och därefter relevant provideravsnitt.
- **Ändrar auth/webhook/dataexponering:** läs Säkerhet före implementation.

## Dashboard

Dashboarden är indelad i:

- **Översikt**
- **GitHub**
- **Cloudflare**
- **Aktivitet**
- **Insyn**

Observerad provideraktivitet och Skvallerbyttans egna reads är separata metrics.

## Epistemisk modell

Systemet skiljer mellan live, cached och derived state och använder explicita statusar för bland annat stale, not observed, permission denied, providerbegränsning och unknown. Frånvaro av observation får inte presenteras som verifierad live-state.

## Wiki

GitHub Wiki är aktiverad för repositoryt och är avsedd som en mer klickbar presentationsyta för samma ämnesindelning. Versionsstyrda filer under `docs/` är underlaget; Wiki ska inte innehålla unik teknisk current-state.
