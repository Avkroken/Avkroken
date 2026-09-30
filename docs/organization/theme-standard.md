# Temastandard — Avkroken/Avkroken

Det här dokumentet beskriver det gemensamma temakontraktet för webbappar i `Avkroken/Avkroken`. Det standardiserar färgfamilj och preferenspersistens, inte komponentutseende eller produktidentitet.

## Temafamilj

Gemensamma val är, i visningsordning:

1. `legacy` — det faktiska pre-v2 Avkroken-uttrycket från Portalens äldre runtime: mörk bas, cyan/blå/violett/magenta ljusaccenter, mjuka radial-glows och diskret 42 px-rutnät. Det är fallback för användare utan sparat val och ska inte reduceras till Skvallerbyttans tidigare blå dashboardpalett.
2. `forest` — Avkrokens skogs-/mässingspalett, visad som **Avkroken** i användargränssnittet.
3. `blackout` — neutral, mycket mörk palett.

Apparna får och bör behålla egna accenter, typografi, densitet, komponentformer och informationsarkitektur. Legacy återanvänder färg-/ljusspråket, inte Portalens gamla layout. Temat ska ge en sammanhängande grund, inte göra apparna identiska.

## Persistens

Klienter som erbjuder temaväljare använder:

- `localStorage["avkroken.theme"]` för origin-lokal persistens;
- cookien `avkroken_theme` med endast värdena `legacy|forest|blackout`;
- `Path=/`, `SameSite=Lax`, ett års Max-Age och `Domain=.denied.se` när sidan körs på denied.se eller en underdomän;
- `Secure` när sidan körs över HTTPS.

Cookien är **endast presentationsdata**. Den får aldrig användas för autentisering, auktorisation, sessionsvalidering, CSRF-skydd, provideråtkomst eller annan säkerhetslogik.

Portal läser även den äldre nyckeln `avkroken.portal.theme` som migrationskälla men skriver endast det gemensamma kontraktet.

## Rendering

Server-renderad fallback är `legacy`. Klientkod får därefter applicera ett giltigt sparat val och uppdatera dokumentrotens `data-theme`.

Teman ska i första hand override:a primitive eller app-lokala färgtokens. Semantiska komponentroller, fokusbeteende, kontrastkrav, keyboardnavigation, reduced motion och produktens funktionella state ska vara oförändrade mellan teman.

Publika och privata ytor får dela samma presentationspreferens. Att en klient kan skriva eller läsa temacookien innebär ingen tillit och får inte påverka någon accessgräns.

## Scope

Detta kontrakt gäller Portal, Dumpen, Skvallerbyttan och Jobb i monorepot. Fristående Avkroken-repositories äger sina egna runtime-teman och kan frivilligt implementera samma preferenskontrakt utan att deras produktidentitet ersätts.
