# Cloudflare credential policy

> **Scope:** Detta dokument sammanfattar stabila credentialroller som används av berörda appar i `blixten85/Avkroken`-monorepot. Det är inte en organisationsövergripande credential authority och styr inte fristående repositories.


Det här dokumentet beskriver en **publik, repository-deklarerad least-privilege-modell**. Det är inte en inventering av faktiska Cloudflare-tokens, deras värden, resource scopes eller nuvarande account-state.

## Grundregler

- Credentials separeras efter läs-/skrivansvar och trust boundary.
- Runtimecredentials ska ha minsta behörighet som krävs av koden.
- Deploycredentials ska inte återanvändas som provider-read credentials i runtime.
- Tokenadministration är ett separat control plane.
- Ett publikt repository får beskriva bindningsnamn och logiska roller som finns i koden, men ska inte påstå att en viss token är skapad, aktiv eller har en viss aktuell permissionuppsättning.
- Faktisk providerstate verifieras i Cloudflare när en credential provisioneras eller felsöks.

## Logiska runtimeklasser

Skvallerbyttans publika konfiguration använder separata logiska read-bindings för olika providerområden. Namnen är ett kodkontrakt, inte bevis på att motsvarande token finns i ett visst konto.

- **R1** — plattforms-/resursläsning.
- **R2** — analytics-/operationsläsning.
- **R3** — security-/identityläsning.

Klasserna är separata least-privilege-roller. Exakta Cloudflare permission groups och resource scopes bestäms vid provisionering och ska verifieras mot aktuell Cloudflare-dokumentation/provider-UI, inte lagras här som live inventory.

## Skriv-/administrationsroller

Kod och workflows kan referera till en deploy-/write-roll och separata administrationsroller. Dokumentationen ska endast ange **vilken operation som behöver en skrivcredential**, inte påstå att en viss account-token finns eller vilka aktuella permissions den har.

Wrangler-deploy kan kräva rättigheter för de resurser som faktiskt deklareras i repositoryts Wrangler-konfiguration. Om Secrets Store-bindings används måste deploymiljön ha de rättigheter Cloudflare kräver för just den operationen.

## Secrets Store

När en Worker deklarerar Secrets Store-bindings är själva bindingnamnen publik repositorykonfiguration. Secretvärden, tokenvärden, token-ID:n, faktisk scope och provisioneringsstatus är extern providerstate och ska inte dokumenteras här.

## Verifiering vid provisionering

Vid skapande eller ändring av en credential:

1. utgå från operationerna som den publika koden faktiskt utför,
2. kontrollera aktuell Cloudflare-dokumentation och provider-UI,
3. välj minsta permission- och resource-scope som fungerar,
4. verifiera provider-sammanfattningen innan credentialen används,
5. dokumentera endast det stabila kodkontraktet i repositoryt — aldrig värde, ID eller faktisk live-inventory.

## Förbjudna genvägar

- använd inte en högre privilegierad credential som generell fallback,
- dela inte runtime-read och deploy-write av bekvämlighet,
- lägg inte tokenadministration i application runtime,
- committa aldrig credentialvärden eller exporter av provider-tokeninventering,
- behandla inte detta dokument som bevis på aktuell Cloudflare-account-state.
