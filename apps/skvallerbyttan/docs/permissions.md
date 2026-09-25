---
layout: default
title: Permissions
permalink: /permissions/
---

# Permissions

Den här matrisen beskriver minsta provider-permissions för observationslagret. **Runtime permission state är inte samma sak som required permission.** Efter deployment registrerar capability-registret om credentialen faktiskt fick läsa endpointen.

## GitHub

| Capability | Endpoint | Minsta permission | Nivå | Skvallerbyttan |
| --- | --- | --- | --- | --- |
| repositories | `GET /orgs/{org}/repos` | installation/repository metadata access | read | implementerad |
| pull requests / issues | `GET /repos/{owner}/{repo}/pulls` + `GET /repos/{owner}/{repo}/issues` | Pull requests + Issues | read | implementerad |
| repository Actions | `GET /repos/{owner}/{repo}/actions/*` | Actions | read | implementerad |
| organization Actions permissions | `GET /orgs/{org}/actions/permissions*` | Administration (organization) | read | implementerad |
| repository effective rulesets | `GET /repos/{owner}/{repo}/rulesets?includes_parents=true` | Metadata (repository) | read | implementerad |
| Custom Property definitions/assignments | `GET /orgs/{org}/properties/*` | Custom properties (organization) | read | implementerad |
| repository Custom Property values | `GET /repos/{owner}/{repo}/properties/values` | Metadata (repository) | read | implementerad |
| security configurations | `GET /orgs/{org}/code-security/configurations*` | Administration (organization) | read | implementerad |
| security alerts | organization/repository scanning alert endpoints | Code scanning alerts + Dependabot alerts + Secret scanning alerts | read | implementerad |



Gamnackens faktiska permission-state verifieras i runtime från Appens egen installationsmetadata och de kortlivade installation-tokenpermissionnivåerna. För endpoint-specifik evidens sparas även GitHubs `X-Accepted-GitHub-Permissions` när headern finns. Endast permissionnamn/nivåer exponeras; installation token, private key och credentialvärden exponeras aldrig.

Repository-scopeade PR/issues, Actions och effective rulesets registreras per repository och aggregeras med explicit scope coverage. Ett lyckat repoanrop får därför inte markera hela capabilityn som available om andra förväntade repositories är denied eller felar.

Dokumentet beskriver de GitHub App-permissions som observationskoden behöver. Faktiska installation-/tokenpermissions är extern GitHub-state och måste verifieras hos providern när driftstate spelar roll.

## Cloudflare

| Capability | Endpoint | Minsta token permission | Klass | Scope | Skvallerbyttan |
| --- | --- | --- | --- | --- | --- |
| account | `GET /accounts/{id}` | Account Settings Read | R2 | account | implementerad |
| zones | `GET /zones?account.id=...` | Zone Read | R1 | zones/account | implementerad |
| Workers | `GET /accounts/{id}/workers/scripts` | Workers Metadata Read-Only | R1 | account | implementerad |
| D1 inventory | `GET /accounts/{id}/d1/database` | D1 Read | R1 | account | implementerad |
| KV inventory | `GET /accounts/{id}/storage/kv/namespaces` | Workers KV Storage Read | R1 | account | implementerad |
| R2 inventory | `GET /accounts/{id}/r2/buckets` | Workers R2 Storage Read | R1 | account | implementerad |
| Access applications | `GET /accounts/{id}/access/apps` | Access: Apps and Policies Read | R3 | account | implementerad |
| Tunnels | `GET /accounts/{id}/cfd_tunnel` | Cloudflare One Connector: cloudflared Read | R3 | account | implementerad |
| Notifications | `GET /accounts/{id}/alerting/v3/*` | Notifications Read | R2 | account | implementerad |
| CASB/Zero Trust | CASB read API/webhook config | Zero Trust Read | R3 | account | implementerad |
| Audit Logs | `GET /accounts/{id}/logs/audit` | Account Settings Read | R2 | account | implementerad |
| read telemetry query | `POST /accounts/{id}/analytics_engine/sql` med SELECT | Account Analytics Read | R2 | account | implementerad |

Analytics Engine SQL använder POST som transport men operationen är read-only SELECT.

R1, R2 och R3 är separata credentialklasser. Högre klass är mer känslig men innehåller inte lägre klasser. Skvallerbyttan väljer credential per endpoint och får inte falla tillbaka till W1/O1 vid permission denied.

R1/R2/R3 bindas från Cloudflare Secrets Store och varje bundet secret ska ha `workers` i sin scope-lista. Det finns ingen generisk Cloudflare-tokenfallback i runtime. Capability state ska verifieras mot faktiska provideranrop innan äldre appunika credentials revokeras.
