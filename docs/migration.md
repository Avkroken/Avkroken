# Repository consolidation

Current-state import created 2026-09-24 from these source revisions:

- portal / organization docs: historisk organisationsdokumentation som nu ägs lokalt av detta repository
- Skvallerbyttan: `Avkroken/Skvallerbyttan@e8a88fd6d15024c566390765c1417981c0198753`
- Krosa-Maja: `Avkroken/Krosa-Maja@b7661ca69eead758de3cd1e4a0697c9cfd38fbd5`
- Jobb: `Avkroken/Jobb@627dfe380a953adc18a6bc6b31d9230166633afc`
- Dumpen: `Avkroken/Dumpen@0abccebdc148427a4c9d07a2d19a7348c8efcd6b` — sista fullständiga pre-retirement-snapshoten före source-repositoryts retirement-tombstone

The import preserves current files under app-specific prefixes. Source repository Git histories remain in the source repositories; they are not rewritten into this repository.

Dumpen importeras utan source-repositoryts `.github/`-kontrollplan; rooten i `Avkroken/Avkroken` äger CI, Dependabot och labeler. Källsnapshoten hade ingen `portal.public.json`, så migreringen skapar inte en ny publik Portal-identitet. Den deklarerade runtime-targeten (`dumpen`, `dumpen.denied.se`, `DUMPEN -> dumpen`) bevaras i kod. Post-merge live-verifiering 2026-09-29 fann ingen `dumpen` Worker i de läsbara Cloudflare-kontona och ingen DNS-resolution för domänen; R2-state i det deklarerade kontot kunde inte läsas på grund av permissions. Ingen providerprovisionering eller Workers Builds-source-cutover utfördes som del av repo-migreringen.

## Legacy OIDC contract retirement (2026-10-08)

The old Krösa-Maja authentication Worker is no longer part of the monorepo
runtime. Code search across currently available Avkroken repositories found
no production consumer of the exported legacy issuer and claim evaluator.
The unused shared `AUTH_ISSUER_V1`, `AuthClaimsV1`, `IdentityKindV1` and
`authClaimsAllow` exports have therefore been retired (breaking **source**
contract change). This does not revoke or modify any issued token.

Active interactive GitHub OAuth remains direct and independent in Skvallerbyttan,
Jobb and Dumpen. Their existing shared Secrets Store and OAuth credential
must be retained. Removal of Cloudflare Worker, D1 or DNS resources is a
distinct operational operation and is **not** implied by this source cleanup.
A code search cannot establish absence of an external consumer.
