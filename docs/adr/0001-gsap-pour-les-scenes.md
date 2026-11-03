# 0001 · GSAP pour les scènes

- Statut : acceptée
- Date : 2026-11-02
- Spec : #1

## Contexte

Le portfolio va porter beaucoup de **scènes** (épinglages, scrub, séquences, révélations) et un **défilement lissé**. Les maquettes sont en CSS pur (`animation-timeline`, `sticky`, `@property`), mais Firefox stable n'a toujours pas les scroll-driven animations (encore derrière un flag en juin 2026), et le lissage, l'épinglage et le séquencement se réécrivent à la main pour chaque scène. Le projet vise par ailleurs « zéro JS client par défaut », 100 au Lighthouse mobile, 60 fps et une page complète sans JS.

## Décision

**GSAP + ScrollTrigger + ScrollSmoother** (paquet `gsap`, plugins gratuits depuis le rachat par Webflow) forment le socle d'animation de toutes les pages.

- Toute animation qui dépend du défilement (une scène, révélations comprises) et le défilement lissé passent par GSAP. Les animations d'interface restent en CSS. Une timeline GSAP hors défilement n'est admise que si la séquence dépend d'un état JS.
- Un module unique, `src/animation/base.ts`, chargé par le layout sur chaque page, est le seul point d'entrée de GSAP : il enregistre les plugins, ouvre un contexte `gsap.matchMedia()` sur `(prefers-reduced-motion: no-preference)` et y crée le smoother (`smooth: 1`, `smoothTouch: false`). Les scènes s'enregistrent dans ce même contexte.
- Le HTML/CSS rend toujours l'**état final** ; une scène anime vers lui (`from()` / `fromTo()`).

## Options écartées

- **CSS scroll-driven seul** : pas de `animation-timeline` dans Firefox stable ; épinglage et séquences à réécrire à la main.
- **Motion** : pas de défilement lissé ni d'épinglage équivalents à ScrollSmoother / `pin`.
- **Moteur maison** : coût de maintenance d'un lissage, d'un épinglage et de replis fiables sur tous les navigateurs.
- **Lenis** : lissage seul, il faudrait encore un moteur de scènes à côté ; deux libs au lieu d'une.

## Conséquences

- **Structure enveloppe/contenu** : le layout pose `#smooth-wrapper > #smooth-content` autour de chaque page. Les éléments fixes (statusline, barres) sortent de cette structure, sinon la transformation du contenu les entraîne.
- **`pin` au lieu de `sticky`** : le smoother transforme le contenu, donc `position: sticky` est proscrit à l'intérieur ; tout épinglage passe par l'option `pin` de ScrollTrigger. Les maquettes en `sticky` (Atome) devront être portées.
- **`transform` et `opacity` seulement** dans une scène, pour tenir les 60 fps sur le thread principal.
- **Plus de `height: 100%` sur `html, body`** : incompatible avec le smoother, qui fixe lui-même la hauteur du body.
- **Positionnés par rapport au contenu, jamais à la fenêtre** : le smoother fixe l'enveloppe et transforme le contenu, qui deviennent le bloc conteneur des éléments `absolute` / `fixed` placés dedans. Un tel élément prend un ancêtre positionné dans le contenu, sinon il saute au démarrage du lissage (décalage de mise en page).
- **Barres fixes et ancres** : la zone que couvre chaque barre fixe est déclarée une fois en CSS, par `scroll-padding-*` sur `:root`. Depuis la maquette D · Éditorial, le header défile avec la page et seule la statusline est fixe, en bas (`--statusline-height`, reprise par `scroll-padding-bottom`). Le navigateur s'en sert seul en mouvement réduit et sans JS ; sous lissage, le socle la relit pour amener ancres (`hashchange`, clic vers l'ancre courante, ancre d'arrivée une fois polices et images en place) et focus hors des barres.
- **Navigation cross-document** : view transitions natives déclarées en CSS, pas de `<ClientRouter />`. Chaque page est un vrai chargement, sans cycle de vie de smoother ni de triggers à gérer entre pages. La transition est une animation d'interface : elle est coupée sous `prefers-reduced-motion: reduce` (écart assumé avec le ticket #4, qui la voulait partout, au nom de la règle d'accessibilité).
- **Écart assumé avec le « zéro JS par défaut »** : environ 48 Ko gzip de JS (125 Ko bruts, GSAP 3.15 mesuré au build) sur chaque page, servis depuis un seul chunk mis en cache entre les pages. ScrollSmoother fait passer le défilement à la molette par le thread principal. Si les 60 fps ou le Lighthouse 100 mobile ne tiennent pas, la cause se signale ; on ne retire pas le smoother en silence.
- **Replis gratuits** : sans JS, sous `prefers-reduced-motion: reduce` ou au doigt, aucune transformation n'est posée et la page défile nativement à son état final.
- **Épinglage `fixed` au doigt** (2026-11-03) : le smoother fait de son enveloppe le défileur de ScrollTrigger, qui épingle alors par `transform`, réécrit à chaque image. Sans lissage (au doigt), c'est le navigateur qui fait défiler la page, hors du thread principal sur un téléphone. Sur iPhone, la transformation arrive plusieurs images en retard : la section épinglée dépasse sa place, puis revient d'un coup. Le socle épingle donc en `fixed` quand le smoother ne lisse pas (`ScrollTrigger.defaults({ pinType })`), et le navigateur tient lui-même la section. `normalizeScroll` a été écarté : le contournement iOS de GSAP décale le contenu une image sur deux et fait sauter les sections épinglées de 25 à 50 px. Il supprime aussi l'inertie du système et le tirer-pour-actualiser. Un cadre épinglé en `100svh` est moins haut que la fenêtre une fois les barres repliées : le `pin-spacer`, qui reste derrière lui pendant tout l'épinglage, porte son fond jusqu'en bas.
