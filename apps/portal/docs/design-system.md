# Designsystem — Avkroken Portal

## Source of truth

Runtimeimplementationen i Git är source of truth.

Portalens tokens finns i:

- `public/tokens.css`

Portalens shell-/komponentstyling finns huvudsakligen i:

- `public/portal-v2.css`
- befintliga `public/styles.css` och `public/mobile.css` där legacy primitives fortfarande återanvänds.

Figma används som designsystem- och referensverktyg:

<https://www.figma.com/design/AuxqvEggmZa2DW5OgizhCj>

## Visuell princip

Avkroken-shell abstraherar miljö snarare än figurer:

- mörk svensk avkrok;
- skog och dis;
- gammalt trä och metall;
- dämpad belysning;
- analog arkiv-/myndighetskänsla;
- modern teknisk kontrollpanel.

Ansikten, avatarer och maskotporträtt används inte som genomgående identitet.

Stämning får inte försämra läsbarhet eller navigering.

## Två designnivåer

### Avkroken Shell

Används för:

- Portal;
- dokumentation;
- project views;
- Drift & insyn;
- Auth-ingång;
- Changelog;
- Aktivitet;
- generiska repositoryytor.

### Independent Products

Följande behåller sina befintliga produktidentiteter:

- Politiker;
- Klarspråk;
- Produkter.

Portal kan länka till och presentera dem som produkter men ska inte ersätta deras egna runtime-teman.

## Color tokens

Primitive palette i foundationen:

- ink — mörka ytor;
- mist — sekundär text och neutrala element;
- paper — primär text;
- moss — positiv status;
- brass — primär accent, fokus och warning;
- ember — danger/error;
- sky — informationsstatus.

Semantiska tokens separerar användning från primitive färg:

- `surface/*`
- `border/*`
- `text/*`
- `accent/*`
- `focus/ring`
- `status/*`

## Spacing och form

Spacing följer en 4 px-baserad skala:

`0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80`.

Radii:

- 4 px;
- 8 px;
- 12 px;
- 16 px;
- pill.

Ytor använder lågmälda borders och begränsade shadows. Accentglow ska vara sekundärt till informationshierarkin.

## Typografi

Figma-referensen använder Inter för shell och informationsytor.

Runtimekontraktet finns i `public/tokens.css`:

- `--ak-font-sans` — Inter med systemfontfallback;
- `--ak-font-mono` — monospace för käll-/teknikmetadata;
- `--ak-type-display-size`;
- `--ak-type-heading-1-size`;
- `--ak-type-heading-2-size`;
- `--ak-type-body-size`;
- `--ak-type-small-size`;
- `--ak-type-label-size`;
- weight- och line-height-tokens.

Nivåerna är fortsatt:

- Display;
- Heading 1;
- Heading 2;
- Heading 3;
- Body;
- Body Small;
- Label.

`public/styles.css` använder den gemensamma sans-serif-tokenen och Portal v2 använder den gemensamma monospace-tokenen där tekniska värden presenteras.

## Motion

Motion ska vara lågmäld och funktionell.

Runtimekontraktet definierar:

- `--ak-motion-duration-fast` — kort Portal-interaktion;
- `--ak-motion-duration-standard` — delade legacy-/foundationövergångar;
- `--ak-motion-duration-reduced` — minimal duration under reduced motion;
- `--ak-motion-ease-standard`;
- `--ak-motion-ease-out`.

`prefers-reduced-motion: reduce` ska fortsatt stänga av panelanimation och minimera transition/animation duration.

## Interaktiva semantiska tokens

Komponenter ska uttrycka interaktionsavsikt semantiskt i stället för genom primitive färgnamn.

Alias i runtime:

- `--ak-interactive-surface`;
- `--ak-interactive-border`;
- `--ak-interactive-text`;
- `--ak-interactive-accent`.

De pekar på befintliga surface/border/text/accent-semantiker och kan därför förändras utan att komponenter behöver känna till primitive palette.

## Komponenter i Figma

Referensbiblioteket innehåller bland annat:

- primary/secondary button;
- status badges;
- navigation item;
- breadcrumb;
- search input;
- project card;
- changelog card;
- activity row;
- empty/error/denied states;
- skeleton;
- mobile navigation drawer.

## Referensskärmar

Figma-filen innehåller referenser för:

- Avkroken start;
- Projektöversikt;
- Projektdetalj;
- Dokumentationsvy;
- Global sök;
- Drift & insyn;
- Changelog;
- Auth/Denied;
- mobilversion.

Dessa är designreferenser, inte runtimeimplementation.

## Accessibility

Shell-kontrakt:

- tydlig `:focus-visible`;
- keyboard navigation;
- skip link till programmässigt fokuserbar `#portal-content`;
- semantisk huvudnavigation;
- `aria-current` för aktiv route;
- SPA-routebyte flyttar fokus till aktiv sidrubrik utan att göra rubriker permanenta tabb-stopp;
- mobilmeny med `aria-expanded`;
- Escape stänger mobil navigation och återför fokus till menyknappen;
- `prefers-reduced-motion` respekteras;
- kontrast prioriteras framför textur/stämning;
- layout ska fungera på liten skärm utan horisontell dokumentoverflow eller hover-only information.

Verifiering:

- Node-kontrakttest låser fokus-/keyboardbeteendet i markup och shell;
- headless Chrome + ChromeDriver kör faktiska klientskript;
- `axe-core` kör WCAG A/AA-regler på alla top-level-vyer i desktopläge;
- representativa mobilvyer kör både axe och overflowkontroll;
- browsergaten använder endast syntetiska publika API-fixtures och kräver inga credentials.

Kommande komponenter ska använda samma principer och omfattas av samma browsergate.
