---
layout: default
title: API
permalink: /api/
---

# API

## Kontrakt

Canonical observations-API ligger under `/api/v1`. Schema-version är **2** och returneras även i header `X-Skvallerbyttan-Schema-Version`.

Capability keys, statusvokabulär, provenance och effective-state representation betraktas som maskinkonsumerade kontrakt och skyddas av tester.

## Auth

Alla API-routes är privata, GET-only och ligger under `/api/v1/*`. Samma canonical routes används av dashboard-sessioner och machine bearer-auth.

Godkänd auth:

1. aktiv Skvallerbyttan-dashboard-session → consumer `dashboard`
2. `Authorization: Bearer <SKVALLERBYTTAN_READ_API_TOKEN>` → consumer `chatgpt`

Bearer-token ger inte interaktiv asset/session-access.

## Core routes

### Dashboardens canonical data

- `GET /api/v1/overview`
- `GET /api/v1/security-activity?days=30&repo=:repo`
- `GET /api/v1/repos/:repo`
- `GET /api/v1/repos/:repo/insights`

Dashboarden och machine-read clients använder samma versionerade routes. Äldre dashboard-routes under `/api/*` utan `/v1/` är borttagna.

### Capabilities och health

- `GET /api/v1/capabilities`
- `GET /api/v1/provider-health`
- `GET /api/v1/reads?days=30`

Capability rows exponerar även `acceptedPermissions` när GitHub returnerar `X-Accepted-GitHub-Permissions`. Repository-scopeade capabilities exponerar `scopeCoverage` med `expected`, `observed`, `available`, `permissionDenied` och `error`.

GitHub-delen av provider health exponerar endast sanerad App-installationsmetadata: installation-id, repository selection samt permissionnivåer från installation/token. Själva installation tokenen, private key och andra credentialvärden returneras aldrig.

För en autentiserad dashboard-session kan `GET /api/v1/capabilities?refresh=1` forcera den globala read-only capability-reconciliationen för både GitHub och Cloudflare. Den omfattar även Cloudflare Notifications (history/policies/webhooks) och CASB/Zero Trust-webhooks. Machine consumer `chatgpt` får inte forcera provider-refresh.

### GitHub

- `GET /api/v1/github/org/state`
- `GET /api/v1/github/repos/:repo/effective-policy`

Organization-state-endpointen innehåller read-only Actions permissions, Custom Properties och security configurations när providerns account type stödjer organization-scope. För current GitHub User-owner returneras dessa organization-only ytor explicit som `not_supported`. GitHub-ytor som kräver provider-write ingår inte i observations-API:t.

Repository effective policy innehåller:

- effective/direct/inherited rulesets
- repository Actions permissions
- Custom Property values
- effective security configuration när provider/API/permission tillåter det
- provenance och explicit unknown/not-exposed relationer
- `bypassActorsState`, så provider-utlämnad bypassdata skiljs från en verifierat tom lista

### Cloudflare

- `GET /api/v1/cloudflare/account`
- `GET /api/v1/cloudflare/zones`
- `GET /api/v1/cloudflare/workers`
- `GET /api/v1/cloudflare/storage/d1`
- `GET /api/v1/cloudflare/storage/kv`
- `GET /api/v1/cloudflare/storage/r2`
- `GET /api/v1/cloudflare/zero-trust/access`
- `GET /api/v1/cloudflare/zero-trust/tunnels`
- `GET /api/v1/cloudflare/audit?days=7`

Storage-routes returnerar inventory/metadata, inte database rows, KV values eller R2 objects.

Audit returnerar minimerad actor/action/resource-metadata och explicit coverage.

### Activity

`GET /api/v1/activity`

Filter:

- `days`
- `provider`
- `capability`
- `repository`
- `resource`

Responsen skiljer mellan grouped observed counts, coverage och recent event stream.

## Status

Gemensam statusvokabulär:

- `available`
- `unavailable`
- `permission_denied`
- `not_configured`
- `not_supported`
- `not_exposed_by_provider`
- `unknown`
- `not_observed`
- `stale`
- `error`

## Freshness

Cache-backed routes returnerar cacheheaders. Capability-registret exponerar `lastAttemptAt`, `lastSuccessAt`, `freshness`, last HTTP status, sanerad last error, provider-accepterade GitHub-permissions där de finns samt scope coverage för repository-scopeade capabilities.

## Raw data

Det finns inget generellt raw/debug provider-endpoint. Providerdata reduceras innan API-respons. Secrets och credentialvärden får aldrig returneras.
