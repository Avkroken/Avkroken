# Arkitektur

## Ansvar

Krösa-Maja är authorization server och OpenID Provider för Avkroken. GitHub är upstream identity proof; downstream-klienter känner bara Krösa-Maja.

```text
GitHub OAuth App
      |
      | upstream identity
      v
 Krösa-Maja --------------------> Cloudflare OAuth
 OAuth 2.1 / OIDC                  linked delegated API access
      |
      +----> Cloudflare Zero Trust / Dashboard SSO
      +----> Skvallerbyttan
      +----> Politiker
      +----> framtida webb-/native-klienter
```

## Trust boundaries

### GitHub -> Krösa-Maja

GitHub-profil och verifierad e-post läses med en kortlivad OAuth-kontext. Numeric GitHub ID måste finnas i allowlisten. GitHub-token rensas i databas-hooken och är inte en långlivad API-behörighet.

### Krösa-Maja -> klienter

Klienterna använder Authorization Code. PKCE krävs även för konfidentiella förstapartsklienter. Native/public clients använder `token_endpoint_auth_method=none`; server-side clients använder `client_secret_basic`.

### Krösa-Maja -> Cloudflare

Cloudflare är en explicit länkad social/OAuth-provider. Better Auths Cloudflare-provider kan inte få ett separat `email_verified`-claim från Cloudflare, därför markeras Cloudflare som trusted provider **endast för explicit account linking**. Implicit linking är samtidigt avstängt och e-postadressen måste matcha den befintliga GitHub-grundade användaren. Baslinjen begär `user-details.read` (provider-standard) och `offline_access`; ytterligare Cloudflare-scopes läggs endast till efter ett konkret funktionsbehov. Token krypteras i D1.

## Signing

OIDC ID tokens signeras med RS256. Skälet är interoperabilitet med Cloudflare Generic OIDC, som accepterar RS256. Private JWKS material lagras via Better Auths databasmodell; JWKS publiceras via provider-endpointen.

## Client registration

RFC 7591 Dynamic Client Registration är avstängt. Förstapartsklienter skapas från `/admin` genom server-only Better Auth admin-API efter separat adminverifiering mot GitHub numeric ID.

## Rate limiting

Better Auths globala rate limiter är explicit aktiverad och använder D1-lagring. På Cloudflare Worker läses klient-IP från `cf-connecting-ip`; Worker-originen ska inte exponeras utanför Cloudflare. OAuth-provider-pluginens stramare endpoint-specifika standardgränser ligger kvar.

## Failure model

- felaktig/missing runtime config -> 503
- fel Host/origin -> 421
- otillgänglig D1 -> stateful auth-operationer failar stängt; ingen separat readiness-endpoint exponeras
- okänd GitHub-identitet -> ingen lokal session
- Cloudflare saknar klientkonfiguration -> länkning 503, OIDC-provider fortsätter fungera
