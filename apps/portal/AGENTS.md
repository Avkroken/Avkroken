# AGENTS.md

Gäller `apps/portal/**`.

## Före ändring

- Läs `apps/portal/docs/project-context.md`.
- Läs relevant arkitektur-/driftdokumentation under `apps/portal/docs/`.
- Verifiera current default branch och den aktuella feature branchens state.
- Verifiera provider/live-state innan en ändring förutsätter extern Cloudflare- eller GitHub-konfiguration.

## Arkitekturgränser

- Portal är presentations-, navigations- och aggregationslager; den får inte bli enda source of truth för repositoryägd information.
- README, docs, Wiki, Issues, Discussions, releases och teknisk current-state ägs i respektive repository/app.
- Operativ GitHub-/Cloudflare-state ska i första hand läsas från Skvallerbyttans normaliserade read-only modell när capability finns.
- Inför inte provider-write i Skvallerbyttan för Portalens skull.
- Skapa inte en parallell bred GitHub-/Cloudflare-providerklient i Portal utan ett dokumenterat behov som inte täcks av befintlig adapter eller Skvallerbyttan.

## Säkerhet

- Lägg aldrig secrets, tokens, certifikat, privata nycklar eller credentialvärden i klientbundle, dokumentation eller API-svar.
- Jobb är skyddat innehåll. Den publika Portalen får inte rendera, indexera eller cachea skyddad Jobb-payload.
- Auth/denied ska ske server-side före hämtning av skyddad data.
- BankID-/e-identitetsrelaterad state behandlas som säkerhetskänslig.
- Publik global sök får endast byggas från material som är tillåtet före indexering.
- Ingen ny credential ska införas när befintligt säkert credentialflöde räcker.

## Routing och rendering

- Stabil path-baserad URL är primär navigation.
- Kända Portal-dokumentroutes får SPA-fallback till `index.html`; API- och asset-routes får inte få samma fallback.
- Speglad dokumentation ska exponera canonical source via “Visa original”.
- Behåll graceful degradation vid GitHub-/adapterfel.
- Visa inte observerad data som komplett om täckningen inte är känd.

## Design

- Runtimeimplementationen i Git är source of truth.
- `public/tokens.css` är Portal-shellens aktuella runtime-tokenlager.
- Figma är designsystem-/referensverktyg.
- Avkroken-shell får inte homogenisera Politiker, Klarspråk eller Produkter visuellt.
- Använd inte avatarer, ansikten eller maskotporträtt som genomgående identitet.
- Keyboard navigation, tydliga focus states, kontrast, reduced motion och responsiv layout är krav.

## Verifiering

Minimikontroll för Portaländringar:

```bash
npm test
npx wrangler deploy --dry-run --config wrangler.jsonc
```

Kör dessutom relevanta branch/PR-checks. Production deployas endast från verifierad `main` enligt repositoryts deployworkflow.
