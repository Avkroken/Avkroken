# Engineering context

## Runtime

- Produktionsissuer: `https://auth.denied.se`
- Cloudflare Workers
- Node compatibility flag krävs för Better Auth runtime-integration.
- D1 binding: `AUTH_DB`.

## Auth paths

UI:

- `/sign-in`
- `/consent`
- `/admin`

Discovery:

- `/.well-known/openid-configuration`
- `/.well-known/oauth-authorization-server`

Better Auth base path:

- `/api/auth/*`

## Provider policy

GitHub:

- root identity
- `read:user` + `user:email` via Better Auth GitHub-provider
- verified email required
- numeric GitHub ID allowlist required
- tokens scrubbed before persistence

Cloudflare:

- linked provider only (`disableSignUp`)
- baseline delegated scopes: built-in `user-details.read` + `offline_access`
- additional scopes supplied only through explicit configuration
- OAuth tokens encrypted at rest

## Downstream client policy

- Authorization Code only for human clients
- refresh tokens supported
- PKCE required
- web/confidential -> `client_secret_basic`
- native/public -> `none`
- dynamic registration disabled
- first-party consent skipping is server-controlled only
