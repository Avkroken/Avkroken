# Authentication and credentials

## Dashboard / GitHub OAuth

Dashboarden använder GitHub OAuth direkt. Authorization Code-flödet använder `state` och PKCE S256 med exakt callback `https://jobb.denied.se/auth/callback`.

Efter token exchange används access-tokenen endast för `GET /user`. Numeriskt GitHub-ID kontrolleras mot `JOBB_ALLOWED_GITHUB_IDS`; tokenen persisteras aldrig och revokeras best-effort efter identitetsuppslaget.

Jobb skapar därefter en lokal 12-timmars signerad `__Host-jobb_session`. Login-state ligger i en signerad, kortlivad `__Host-jobb_oauth`-cookie. Sessionen revalideras mot aktuell allowlist vid varje request, så borttagen åtkomst slår igenom utan att vänta på sessionens expiry.

Runtimekontrakt:

- `GITHUB_OAUTH_CLIENT_ID` — icke-hemligt client ID.
- `GITHUB_OAUTH_CLIENT_SECRET` — Secrets Store-binding eller ignorerad lokal dev-konfiguration.
- `JOBB_ALLOWED_GITHUB_IDS` — numeriska GitHub-ID:n som får använda dashboarden.

GitHub OAuth-klienthemligheten får inte loggas, returneras eller committas. Basic Auth och parallell OIDC-fallback ska inte införas.

## StudentConsulting

StudentConsulting credentials are runtime secrets, never repository configuration.

Runtime names:

- `STUDENTCONSULTING_EMAIL`
- `STUDENTCONSULTING_PASSWORD`

Production supports two sources. Explicit Cloudflare runtime values are authoritative. When those values are absent, an authenticated user may save the credentials in System; the managed configuration is AES-GCM encrypted before it is persisted in D1. Local development may use `.dev.vars`, which must remain gitignored.

The application code receives effective credentials through an adapter-level `CredentialsProvider`. Plaintext credentials must never be logged, written to R2/evidence, returned through API responses, or included in screenshots. The only permitted D1 persistence is the encrypted `runtime_configuration` ciphertext; its key is HKDF-derived from the existing GitHub OAuth client secret with a separate context.

Rotating the GitHub OAuth client secret invalidates the old managed ciphertext. The System configuration must then be entered and saved again. External CI/CD credentials are not part of the application auth contract.

## Arbetsförmedlingen / e-identification

E-identification is user-controlled. The application may initiate an authentication session and wait for the user to complete the BankID/e-identification step. It must not store BankID credentials, attempt to automate signing, or treat an authentication request as completed until the remote service confirms the authenticated session.

After successful user authentication, an ephemeral authenticated browser/session may continue the permitted workflow. The protected dashboard exposes the ephemeral Live View link only while user action is required. Session material must be treated as sensitive and must not be written to logs or the public repository.

## Public-repository rule

Only secret *names*, interfaces, examples with dummy values, and setup instructions belong in Git. Real credentials never do.
