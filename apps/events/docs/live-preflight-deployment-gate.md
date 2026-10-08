# Live staging preflight deployment gate

**Status:** planned and machine-validated; no Worker is deployed by this contract.

This gate defines the smallest temporary Cloudflare topology allowed for the
first live staging-inventory preflight.

## Topology

```text
local operator
  -> remote Service Binding
  -> events-staging-inventory-proxy
  -> Cloudflare API GET only
```

The operator remains local. The only remote compute allowed by this plan is the
narrow inventory proxy that already exposes named read-only RPC methods.

## Canonical plan

`../live-preflight-deployment.v1.json` is the machine-readable contract.
`../control-plane/live-preflight-deployment-gate.ts` validates it fail-closed.

The plan requires:

- Worker name `events-staging-inventory-proxy`;
- `workers_dev=false`;
- `preview_urls=false`;
- no routes;
- the existing account ID already declared by the repository;
- `CLOUDFLARE_API_TOKEN_W1` bound from the existing Secrets Store;
- provider HTTP method allowlist containing only `GET`;
- no D1, Queue, KV, R2 or Service Bindings on the proxy;
- local operator access through a remote Service Binding to
  `CloudflareStagingInventoryProxyEntrypoint`;
- no provider-destination mutation;
- mandatory teardown and verification after the run.

No credential value is represented by the plan.

## Why the operator stays local

Cloudflare remote bindings allow local Worker development to connect to an
already deployed Service Binding target. The preflight runner therefore does
not need a second public or persistent operator Worker.

The proxy itself remains necessary because W1 must stay server-side in Secrets
Store and the local operator must never receive its value.

## Deployment stop conditions

Do not deploy the proxy if any of the following is true:

- the machine plan validator returns a reason;
- current `main` no longer matches the reviewed gate;
- the configured Secrets Store binding or account identity cannot be verified;
- the deploy identity cannot bind the existing Secrets Store secret safely;
- deployment would enable a public URL, route, preview URL or additional binding;
- provider permissions needed by the read-only inventory calls are unknown;
- provider destinations or production resources would be changed.

A successful proxy deployment is still not authorization to create Events/Ingest
staging resources.

## Live preflight sequence

Once the provider-write deployment step is explicitly approved:

1. deploy only the temporary proxy using the exact validated plan;
2. verify no public route / workers.dev / preview URL is enabled;
3. run the local operator against the proxy through the named remote Service Binding;
4. record only the sanitized `StagingPreflightOperatorReportV1`;
5. remove the temporary proxy;
6. verify that no route or residual binding remains;
7. refresh live inventory again before any subsequent create operation.

The sanitized report is evidence for the separate staging provisioning decision.
It is not a write authorization.

## Not included

This gate does not:

- deploy the proxy;
- create D1, Queue, DLQ or staging Workers;
- apply migrations;
- configure Queue consumers;
- create or rotate credentials;
- change GitHub or Cloudflare provider destinations;
- move canonical ownership away from Skvallerbyttan.
