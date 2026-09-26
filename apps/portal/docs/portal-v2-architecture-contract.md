# Portal v2 — Del 1: verifierad arkitekturbas

**Status:** pågående; repository-/GitHub-state och current GitHub owner-modell är verifierade och implementerade på arbetsgrenarna, men Del 1 är ännu inte Definition of Done eftersom Cloudflare live-state, Figma-liveinspektion och full release/tag-liveinventering inte kunde verifieras från tillgängliga verktyg.

**Verifieringsdatum:** 2026-09-26

**Verifierad Git-bas:** `blixten85/Avkroken@86fd260d156a88357614d7ddb0329736d4128e0b` på `main`.

Det här dokumentet är Del 1-leveransen för Portal v2 och ska läsas tillsammans med Portalens övriga appdokumentation. Det beskriver verifierad current state, identifierade gap och beslutad arkitekturriktning. Extern provider-state som inte har kunnat läsas verifierbart markeras som blockerad eller okänd; den ersätts inte med antaganden från äldre dokument.

## 1. Verifieringsresultat och auktoritet

Verifieringen följer principen att aktuell provider-state och aktuell default branch väger högre än äldre dokumentation.

GitHub-connectorn visar följande åtkomliga repositories:

| Repository | Visibility | Default branch | Roll i Portal v2 |
| --- | --- | --- | --- |
| `blixten85/Avkroken` | public | `main` | monorepo för Portal, Skvallerbyttan och Jobb |
| `blixten85/.github` | public | `main` | GitHub-profil/community health och genererad dokumentationsspegel |
| `blixten85/Bastion` | public | `main` | fristående projekt |
| `blixten85/Produkter` | public | `main` | självständig publik produkt |
| `blixten85/Klarsprak` | public | `main` | självständig publik produkt |
| `blixten85/Politiker` | public | `main` | självständig publik produkt |
| `blixten85/Pastebinit` | public | `main` | fristående repository |
| `blixten85/Docker-idempotent-update` | public | `main` | fristående repository |
| `blixten85/bastion-certificates` | private | `main` | privat stödrepository; ska inte in i publik Portal-katalog |

Inget av de repositories som connectorn returnerade var arkiverat.

### 1.1 GitHub owner/account-modell — beslutad och implementerad

Projektbeslut 2026-09-26:

- aktuell canonical GitHub owner är användarkontot `blixten85`;
- account type är **User**, inte GitHub Organization;
- kontots login planeras bytas från `blixten85` till `Avkroken` omkring 6–7 oktober 2026;
- namnbytet är en separat senare migrering och ska inte förhandsimplementeras som om `Avkroken` redan vore current owner.

Live-resolveringen av tidigare `Avkroken/*`-URL:er till samma repository-ID:n under `blixten85/*` bekräftade current repository ownership. Den tidigare runtimekoden var däremot fortfarande organization-scoped.

User-owner-modellen är därför implementerad på Del 1-arbetet:

- Portal har en central current-owner-konstant `blixten85` och listar publika repositories via user-owner-scope;
- canonical repository-, docs-, Issues-, Releases-, Builds- och Activity-validering använder samma ownerkontrakt;
- Portalens projektcache har versionshöjts så äldre `Avkroken/*`-state inte överlever en deployment;
- Skvallerbyttan använder GitHub App-installationens `GET /installation/repositories` för repository inventory i stället för organization repository listing;
- GitHub App-installationen valideras genom current canonical repository `blixten85/Avkroken`;
- `SKVALLERBYTTAN_GITHUB_OWNER=blixten85` är current config, med legacy `SKVALLERBYTTAN_ORG` endast som kompatibilitetsfallback;
- organization-only Actions policies, Custom Properties och organization security configuration markeras explicit `not_supported` när GitHub App-installationens account type är User, i stället för att 404 behandlas som okänd providerstate;
- motsvarande Pages/Wiki-spegeländring är mergad i `blixten85/.github` via PR #89.

Det planerade username-bytet omkring 6–7 oktober ändrar inte account type. Om kontot fortsatt är ett GitHub User-konto ska organization-only capabilities därför fortsatt vara `not_supported` efter namnbytet. Oktoberjobbet ska huvudsakligen uppdatera current owner-värden/canonical länkar och därefter verifiera GitHub App-installation, repository discovery, webhooks, Pages/Wiki och Portalens publiceringsflöden.

### 1.2 Branch- och PR-state

`blixten85/Avkroken` hade inga öppna pull requests vid verifieringen.

Portal v2 har däremot redan implementerats i betydande omfattning på `main` genom tidigare mergade PR:er, bland annat shell/routing, project source, app-discovery, dokumentation, Wiki, global sök, Drift & insyn, Changelog, Releases, Issues, Builds/CI, Activity, accessibility och design-tokenkontrakt.

Tre äldre Portal-grenar finns kvar:

- `chatgpt/portal-home-dashboard/2026-09-25/21-44-home` — `ahead_by=0`, endast bakom `main`;
- `chatgpt/portal-project-adapter/2026-09-25/15-25-projects` — divergerad och kopplad till stängd, ej mergad PR #21; senare project-source/app-discovery-arbete är redan mergat på `main`;
- `chatgpt/portal-project-detail/2026-09-25/15-36-detail` — divergerad; senare projektdetalj implementerades och mergades via PR #24.

De ska därför inte användas som bas för Del 1. Återanvändning av en gammal gren är korrekt endast när den fortfarande representerar samma ej landade arbete; här skulle de återinföra äldre överlappande implementation ovanpå en nyare `main`.

## 2. A — Aktuell arkitektur

### 2.1 Avkroken-monorepot

`Avkroken` är ett publikt monorepo med tre aktiva appytor:

- `apps/portal`;
- `apps/skvallerbyttan`;
- `apps/jobb`.

Apparna äger sina egna tekniska kontrakt och dokumentation. `docs/organization/` innehåller endast monorepo-delad kontext och är inte source of truth för fristående repositories.

Krösa-Maja finns inte längre som app på current `main`; root-CI verifierar uttryckligen dess retirement. Namnet Gamnacken finns kvar som credential-/GitHub App-bindingsnamn i Skvallerbyttan, men något separat Gamnacken-repository eller en separat current runtime kunde inte verifieras i den installerade GitHub-repositorylistan.

### 2.2 Portal

Portal kör enligt current `main` som Cloudflare Worker `avkroken` med statiska assets och path-baserad routing.

Worker-kontraktet omfattar bland annat:

- publik project/source-adapter;
- explicit opt-in för monorepo-appar via appägd `portal.public.json`;
- README/docs-katalog och exakt allowlistad innehållshämtning;
- server-side shell fallback för kända dokumentroutes;
- access-aware server-side sök;
- Changelog och projektspecifika Releases från GitHub Releases;
- projektspecifika Issues;
- Builds/CI och observerad Activity från Skvallerbyttans sanerade interna RPC;
- Drift & insyn från samma read-only observationsgräns;
- intern docs-cacheinvalidering;
- operativ heartbeat/watchdog.

Portalens kända top-level-routes är:

```text
/
/projekt
/dokumentation
/tjanster
/auth
/drift
/changelog
/aktivitet
/om
/sok
```

Projektvyer ligger under `/projekt/:slug` och omfattar där källan stöder dem dokumentation, Wiki, Issues, Releases, Builds/CI och Activity.

`/auth/jobb[/...]` är inte en SPA-säkerhetsgräns. Worker-routingen gör server-side redirect till Jobbs separata skyddade origin innan Portal-shell renderas.

### 2.3 Repository- och dokumentationsdata

Portalens avsedda modell är:

```text
GitHub repository data
  -> project/documentation adapters
  -> publicerings- och accesspolicy
  -> cache
  -> Portal-rendering
  -> canonical "Visa original"
```

Godtyckliga GitHub-paths accepteras inte av docs-content-endpointen. En path måste först finnas i den publicerade docs-katalogen.

Monorepo-appar publiceras inte automatiskt. Endast appar med giltig `portal.public.json` får en publik appidentitet och appdokumentation. Skvallerbyttan är current opt-in-app. Portal och Jobb saknar publikt appmanifest.

### 2.4 Cache och freshness

Verifierad repositorykonfiguration:

- projektkatalog: Workers Cache API, fem minuters TTL;
- dokumentation: sex timmars cache med cache tags och intern invalidering;
- sökindex: ingen persistent Cache API-lagring; byggs server-side från redan publicerade källor och har bounded/partial coverage;
- Changelog/Releases/Issues/Builds/Activity: publicerings- och endpointkontrakt använder `no-store` där current implementation anger det;
- Builds/CI läser Skvallerbyttans canonical `overview` source cache och startar inte en GitHub Actions-read från Portal-sidvisning;
- stale eller ej observerad state ska visas explicit och får inte översättas till healthy.

### 2.5 Skvallerbyttan

Skvallerbyttan är det centrala read-only observationslagret och eventnavet för GitHub och Cloudflare.

Current repositorymodell innehåller:

- GitHub App-baserade read-only providerläsningar;
- GitHub/Cloudflare webhook-ingress;
- D1 för cache, observationer, events och historik;
- Workers Analytics Engine för read telemetry;
- canonical `/api/v1` för autentiserad dashboard/maskinläsning;
- named Worker RPC `PortalObservationsService` som separat public-safe downstream-gräns;
- `getPublicOperationsSummary()`;
- `getPublicRepositoryCi(repoName)`;
- `getPublicActivity(repositoryNames, days)`;
- intern signalering till Portal för docs-invalidering och operativ heartbeat.

Portal använder inte Skvallerbyttans privata bearer-token och proxar inte det skyddade HTTP-API:t.

Skvallerbyttans providerarkitektur ska fortsatt vara strikt read-only. Portalbehov ger inget skäl att införa provider-write.

### 2.6 Jobb/Auth

Jobb är en separat Cloudflare Worker med egen D1/R2/Workflow/Browser Run-arkitektur och eget autentiserat kontrollplan.

Verifierad app-local authmodell:

- GitHub Authorization Code + PKCE S256 för dashboardlogin;
- numerisk GitHub-ID-allowlist;
- provider-token används endast för identity lookup och persisteras inte som applikationssession;
- lokal signerad session;
- server-side auth före skyddad payload;
- same-origin-kontroller för skyddade mutationer;
- Turnstile för manuell körning;
- BankID/e-identifikation är användarstyrd och automatiseras inte som signering.

Portal ska därför bara vara Auth-ingång/navigationsyta. Skyddad Jobb-state ska aldrig gå via Portalens publika HTML, cache, sök eller API.

### 2.7 Wiki och Pages

Repository-Wiki är presentation/navigation, inte canonical teknisk source of truth.

Verifierad `wiki-sync.yml` finns i current repositories för bland annat monorepot, Bastion, Produkter och Klarspråk. Ytterligare fristående repositories har också repo-lokala Wiki-flöden.

`blixten85/.github` innehåller den automatiska dokumentationsspegeln och Pages-workflowen. Den spegeln:

- läser publik repositorydokumentation/Wikis;
- publicerar en genererad läsvy;
- är inte canonical;
- exkluderar monorepots generiska `apps/**`-innehåll;
- exkluderar `blixten85/Avkroken` från den generiska sökindexvägen eftersom monorepot innehåller både publika och skyddade appytor.

Detta bevarar Jobb/Auth-gränsen. Portalens app-publicering ska fortsatt ske genom uttrycklig app-policy, inte genom en generell Pages-indexerare.

## 3. B — Gap mot målbild

| Gap | Current state | Önskat state | Påverkat område | Risk | Fas |
| --- | --- | --- | --- | --- | --- |
| GitHub owner/login | Current owner är verifierat User-kontot `blixten85`; user-owner-stöd är implementerat på PR #43 och `.github`-spegeln är mergad via PR #89 | Behåll `blixten85` som canonical owner tills det planerade username-bytet omkring 6–7 oktober; migrera därefter owner-värden och verifiera providerflöden på nytt | Portal + Skvallerbyttan + `.github` | medel vid namnbyte; canonical URLs/discovery/webhooks måste verifieras efter rename | planerad oktober-migrering |
| Cloudflare live deployment | Repository-konfiguration är läst och GitHub CI/dry-run är grön, men Cloudflare Workers Builds preview fallerar på samma PR-head för `avkroken`, `skvallerbyttan` och `jobb`; buildlogg/account/Worker/routes/Access/service bindings/D1 jurisdiction kan inte läsas live från tillgängliga verktyg | Verifiera Cloudflare buildlogg och live-state före merge/driftändring | Portal + Skvallerbyttan + Jobb | hög; gemensamt provider-/previewlager är misstänkt men rotorsak är inte verifierad | Del 1/3 blocker |
| Figma live reference | Runtime-designsystem och repo-dokumentation är läst; Figma MCP stoppades av verktygets plan/rate limit | Figma-referensens aktuella pages/components/tokens verifierade när connectorn åter är tillgänglig | Portal design | låg för runtime, eftersom Git är runtime source of truth; medel för design-reference drift | Del 2 |
| Del 1 efter implementation | Betydande Del 2/3-lik implementation är redan mergad på `main` | Fortsatt arbete utgår från verifierad current implementation, inte från briefens ursprungliga clean-slate-ordning | Portal | regressionsrisk om gammal plan återimplementeras | Del 1 |
| Releaseautomation | Conventional Commit-/SemVer-kontrakt finns, men full release-PR-automation är avsiktligt ej aktiverad | CI-kompatibel least-privilege releaseidentitet eller annan verifierad modell | monorepo + valda repos | write-permission/CI-bypass-risk | Del 3 |
| Releasekontrakt skiljer mellan repos | Bastion/Politiker/Pastebinit/Docker-idempotent-update har verifierade release-/PR-title-kontrakt; Produkter/Klarspråk har release notes config/Wiki men saknar motsvarande verifierat release-standard/pr-title-kontrakt | Endast faktiskt versionsbara repos får ett konsekvent, repoägt releasekontrakt | fristående repos | inkonsekventa releases | Del 3 |
| Faktisk tag/releasehistorik | Konfiguration och Portalens releaseadapter är verifierade; komplett aktuell tag/GitHub Release-historik per repo kunde inte inventeras via den nuvarande connectorns exponerade actions | Provider-verifierad releaseinventering före automation | valda versionsbara repos | fel verktygs-/versionsbeslut | Del 3 |
| Gamnacken som fristående komponent | Namnet används i Skvallerbyttans GitHub App-bindings, men något fristående current repo/app syns inte i den installerade repositorylistan | Dokumentera endast den faktiska kvarvarande rollen efter live-verifiering av GitHub App/providerstate | Skvallerbyttan | stale arkitekturbild | Del 1/3 |

## 4. C — Beslutad informationsarkitektur

Current implementation och målbild är kompatibla. Följande IA ska därför behållas som Portal v2-kontrakt:

1. **Avkroken** — kontrollpanel/startsida, inte repositorylista.
2. **Projekt** — normaliserad projektkatalog och projektdetaljer.
3. **Dokumentation** — samlad läs- och sökyta över uttryckligen publicerade källor.
4. **Tjänster** — publika produkter/tjänster; självständiga produkter behåller egen identitet.
5. **Auth** — ingång till skyddade ytor; Jobb ligger här och inte under publika Tjänster.
6. **Drift & insyn** — public-safe observerad state från Skvallerbyttan.
7. **Changelog** — kuraterad releasehistorik från officiella GitHub Releases.
8. **Aktivitet** — observerade events; separat från Changelog.
9. **Om Avkroken** — produkt-/ownershipkontext.
10. **Sök** — global access-aware utility-yta.

Top-level-navigationen ska inte organiseras efter GitHub-begrepp.

### 4.1 URL-kontrakt

Behåll stabil path-baserad routing:

```text
/
/projekt
/projekt/:slug
/projekt/:slug/dokumentation/...
/projekt/:slug/wiki/...
/projekt/:slug/issues
/projekt/:slug/releases
/projekt/:slug/builds
/projekt/:slug/aktivitet

/dokumentation/...
/tjanster

/auth
/auth/jobb/...

/drift/...
/changelog
/aktivitet
/sok
/om
```

Public och protected data ska fortsatt ha strukturellt separerade servervägar. Klientrouting eller URL-fragment får inte användas som säkerhetsgräns.

## 5. D — Designsystemplan

### 5.1 Source of truth

Runtimeimplementationen i Git är source of truth.

- tokens: `apps/portal/public/tokens.css`;
- Portal-shell/komponentstyling: primärt `portal-v2.css`, med befintliga legacy primitives där de fortfarande används;
- Figma är referens-/designsystemverktyg och får inte övertrumfa runtime när de divergerar.

### 5.2 Visuell modell

Avkroken Shell ska abstrahera miljön, inte figurer:

- mörk svensk avkrok;
- skog/dis;
- gammalt trä/metall;
- dämpad belysning;
- analog arkiv-/myndighetskänsla;
- modern teknisk kontrollpanel;
- lågmälda texturer;
- tydlig informationshierarki.

Ansikten, avatarer och maskotporträtt används inte som genomgående identitet.

Politiker, Klarspråk och Produkter är självständiga produkter och ska inte Avkroken-skinnas i sina egna runtimeytor.

### 5.3 Token-/komponentkontrakt

Current design-dokumentation definierar redan:

- primitive färger: ink, mist, paper, moss, brass, ember, sky;
- semantiska surface/border/text/accent/focus/status-tokens;
- 4 px-baserad spacing;
- radii 4/8/12/16/pill;
- Inter/systemfallback för shell;
- buttons;
- badges;
- navigation;
- breadcrumbs;
- search input;
- project cards;
- changelog cards;
- activity rows;
- loading/skeleton;
- empty/error/denied;
- mobile navigation.

Fortsatt Del 2-arbete ska därför vara **audit och komplettering av befintligt system**, inte en ny parallell designfoundation.

### 5.4 Referensskärmar

Designreferensen ska täcka:

- Avkroken start;
- Projektöversikt;
- Projektdetalj;
- Dokumentation;
- Global sök;
- Drift & insyn;
- Changelog;
- Auth/Denied;
- mobil.

Figma-filen är identifierad i repositorydokumentationen men kunde inte live-inspekteras i denna körning eftersom Figma MCP nådde planens anropsgräns. Ingen Figma-state kallas därför verifierad här.

## 6. E — Säkerhets- och authkontrakt

### Public

Publik Portal får endast rendera/indexera/cachea data som har passerat server-side publiceringspolicy.

Tillåtna generella kategorier:

- explicit publicerade projektmetadata;
- README/docs/Wiki-presentation från publicerade källor;
- sanerade GitHub Releases och Issues för publicerade repositoryprojekt;
- sanerad Drift/CI/Activity från Skvallerbyttans dedicated public-safe RPC;
- canonical source links.

### Protected

Skyddad state ska separeras före rendering, indexering och cache.

För Jobb gäller:

- ingen protected payload i publik HTML eller prerender;
- inget Jobb-innehåll i publikt search index;
- inget privat cacheobjekt under publik cache key;
- auth/redirect före datafetch;
- BankID-/eID-state och credentials får inte nå browser bundle;
- Portal får inte proxy:a Jobbs skyddade API som en publik bekvämlighetsväg.

### Skvallerbyttan

- providerintegrationen förblir read-only;
- Portal använder endast namngivna, sanerade RPC-metoder;
- ingen ny bearer-token för Portal;
- ingen provider-writepermission införs;
- Activity ska uttryckligen beskrivas som observerad när coverage inte är komplett.

### Credentials

- återanvänd befintliga verifierade credentialflöden där de är rätt scope:ade;
- skapa inte ny token som workaround;
- exponera aldrig credentialvärden i docs, API, logg eller klient;
- permissions ska ändras endast som en separat, förankrad arkitektur-/driftåtgärd.

## 7. F — Release- och Changelogplan

### 7.1 Monorepot

Current monorepo har ett dokumenterat releasekontrakt:

- PR-titlar/squash commits följer Conventional Commits;
- SemVer används när en versionerad release faktiskt skapas;
- `feat` ger normalt minor, `fix` patch och breaking change major;
- `docs/test/chore/ci/build` skapar normalt inte release ensamma;
- release ska vara kuraterad och inte ske på varje merge;
- GitHub Releases är canonical releasehistorik som Portalens Changelog konsumerar;
- release-PR ska passera normal CI/review/rules innan merge;
- tag/release-history rewrite och force push används inte.

Automatisk release-PR är inte aktiverad.

Release Please är dokumenterat som tekniskt lämpligt men nuvarande normala GitHub Actions/`GITHUB_TOKEN`-modell uppfyller inte kravet att dess skapade PR ska trigga normal efterföljande CI. Följande ska därför inte användas som workaround:

- ny PAT utan separat godkänt credentialbeslut;
- utökad write-access för Skvallerbyttans/Gamnackens read-only identitet;
- lättade checks/rules;
- merge utan relevant verifiering.

Del 3 får välja automation först när write-identitet/CI-modell är verifierad.

### 7.2 Fristående repositorykontrakt

Verifierad filinventering:

| Repository | Release-standard | PR-title gate | GitHub release-notes config | Wiki sync | CHANGELOG |
| --- | --- | --- | --- | --- | --- |
| Bastion | ja | ja | ja | ja | nej |
| Politiker | ja | ja | ja | ja | nej |
| Pastebinit | ja | ja | ja | ja | nej |
| Docker-idempotent-update | ja | ja | ja | ja | nej |
| Produkter | ej verifierad | ej verifierad | ja | ja | nej |
| Klarsprak | ej verifierad | ej verifierad | ja | ja | nej |
| bastion-certificates | nej | nej | nej | nej | ja |
| .github | nej | nej | nej | nej | nej |

Detta är en **fil-/konfigurationsinventering**, inte bevis på aktuell GitHub Release-/taghistorik.

Innan releaseautomation införs ska varje repository klassificeras som:

- versionsbar produkt/bibliotek;
- deploybar app där GitHub Release är meningsfull;
- stöd-/infrarepo som inte ska versionsreleasas.

Produkter/Klarspråk ska inte få releaseautomation bara för att `.github/release.yml` finns. Deras eget releasekontrakt måste först definieras i respektive repo om de ska vara versionsbara.

## 8. G — Konkret implementationsordning

Eftersom bred Portal v2-implementation redan ligger på `main` ska fortsatt arbete inte följa briefen som om systemet vore oimplementerat. Ordningen ska vara:

### 0. Slutför Del 1-blockers

1. GitHub owner/topologi: **löst** — `blixten85` är current User-owner och user-owner-modellen är implementerad/verifierad i CI.
2. Verifiera Cloudflare live-state och de aktuella failed Workers Builds-previewkörningarna för `avkroken`, `skvallerbyttan` och `jobb`: buildkommando, previewkommando, root directory/watch paths, Worker deployments, custom domains/routes, Service Bindings, preview-bindings, Access-gränser, D1 jurisdiction/migrationsstate och relevanta credentials/permissions utan att skriva ut hemligheter.
3. Verifiera Figma-referensen när connectorn åter tillåter reads.
4. Komplettera live release/tag-inventering för de repos som faktiskt ska vara versionsbara.
5. Omkring 6–7 oktober: utför separat GitHub username-migrering från `blixten85` till `Avkroken`, uppdatera current owner-värden och verifiera GitHub App/repository/webhook/Pages/Portal-flöden efter rename.

### 1. Del 2 — Shell/design/docs som audit

1. Jämför befintliga runtimevyer mot beslutad IA och designkontrakt.
2. Åtgärda endast verifierade gaps; bygg inte om redan fungerande routing/adapters.
3. Kontrollera referensskärmar, responsivitet, keyboard/focus och WCAG-gaten.
4. Kontrollera docs/Wiki/canonical links och access-aware search end-to-end.
5. Låt Politiker/Klarspråk/Produkter behålla egen produktidentitet.

Varje separat implementationjobb använder egen branch/PR, men ett redan påbörjat ej supersederat jobb fortsätter på sin befintliga branch/PR.

### 2. Del 3 — Operations/Auth/Release

1. Verifiera produktionens Cloudflare-topologi före ändring.
2. End-to-end-verifiera Portal ↔ Skvallerbyttan RPC och heartbeat.
3. End-to-end-verifiera `/auth/jobb` och att skyddad Jobb-data inte når Portal/cache/search.
4. Slutför repo-för-repo releaseklassificering.
5. Inför endast den releaseautomation vars credential- och CI-modell är explicit verifierad.
6. Kör produktionens acceptance checks och uppdatera app-local current-state-dokumentation med faktisk slutstate.

## 9. Del 1 Definition of Done — status

| Krav | Status | Evidens/kommentar |
| --- | --- | --- |
| relevant GitHub live-state | verifierad för current owner-modell | repos/default branches/PRs/branches, current User-owner `blixten85`, resolvering och account-type-konsekvens verifierade; runtime user-owner-stöd är CI-verifierat på arbetsgren |
| current default branch läst | verifierad | `main` och relevanta appdocs/config lästa |
| öppna relevanta PRs/branches inventerade | verifierad | inga öppna PRs; stale/supersederade Portal-grenar identifierade |
| Portal current architecture | verifierad i repository | runtime/routes/adapters/cache/docs lästa |
| Skvallerbyttan portalrelevanta API/state | verifierad i repository | named RPC/read-only kontrakt och storage/reconciliation dokumenterade |
| Jobb/Auth-boundary | verifierad i repository | server-side Portal-redirect + Jobbs authmodell |
| Pages/Wiki-flöden | verifierad i repository | repo-local Wiki sync + .github Pages mirror/accessgräns |
| repo-/appinventering | verifierad för connector-visible repos | 9 repositories + tre aktiva monorepo-appar |
| IA | beslutad | behåll current Portal v2 IA ovan |
| URL-modell | beslutad | behåll current path-baserade kontrakt |
| adapter/cachemodell | beslutad | adapters för repo/docs, Skvallerbyttan för operations, separat Jobb backend |
| public/protected-kontrakt | beslutad | fail-closed före index/cache/datafetch |
| designsystemplan | verifierad i repo, Figma live blockerad | runtime Git är source of truth |
| releaseinventering | delvis verifierad | kontrakt/config inventerade; full provider tag/releasehistorik kvar |
| Del 2/3-ordning | beslutad | audit/completion ovan |
| blockers dokumenterade | verifierad | Cloudflare live/Workers Builds preview, Figma live och full release/tag-liveinventering återstår; GitHub owner/scope är löst |
| out-of-scope governance ändrad | nej | inga rulesets/branch protections/planändringar gjorda |

Del 1 får **inte** markeras klar förrän de blockerande live-state-punkterna ovan är verifierade eller uttryckligen lösta genom ett förankrat arkitekturbeslut.
