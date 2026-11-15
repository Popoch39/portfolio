# 0012 · Établi : le hero et son assemblage, en CSS sur le compositeur

- Statut : acceptée
- Date : 2026-11-15
- Planche : « E2 · Établi — hero du site, nom à gauche, clavier à droite » (canvas « Clavier · arrivée », 9JHztDQ1m6t7y2JG3pfJP1)
- Remplace : ADR 0005 (Intro « Fuseaux »), et la nuit sur le hero de l'ADR 0008

## Contexte

Louis remplace l'animation d'entrée par la planche E2. Ce n'est pas qu'une animation : c'est un autre hero. À gauche Besançon et ses coordonnées, le nom, l'Accroche et les actions ; à droite un clavier mécanique isométrique qui s'assemble à l'arrivée. Le boîtier entre par l'axe u, le PCB par l'axe −u puis s'assoit, cinq vis tombent et tournent, la plaque descend, 61 switchs poussent, puis 61 touches volent depuis tout le hero (deux sur trois partent de la colonne de texte), tournent dans le plan du clavier, montent et se clipsent. h j k l s'allument dans le signal, et le texte suit le montage. Le tout dure 3,9 s.

Choix de Louis : le hero E2 complet (la carte Méridien disparaît), les règles de lecture de l'ancienne Intro (visite directe et F5, jamais en navigation interne, au retour, avec une ancre ni en mouvement réduit), le bouton « Rejouer » de la planche, et le Nuancier intact, le hero prenant le papier de la page. La coupe du Terminateur sur le hero est retirée.

La planche anime en CSS des `<g>` d'un SVG. Une transformation CSS sur un élément d'un SVG n'est pas compositée : tout le dessin serait repeint à chaque image, plusieurs centaines de chemins, ce qui ne tient pas 8,3 ms par image en CPU ×4.

## Décision

- **Géométrie calculée au build** (`src/hero/bench.ts`) : les faces des touches et des switchs de la planche, son générateur seedé (mulberry32, graine 39) pour les trajectoires, les délais et les angles, plus la boîte de chaque pièce dans le repère du dessin. La page reçoit des nombres.
- **Une boîte HTML par pièce mobile** (`Etabli.astro`). Le boîtier, le PCB et la plaque sont chacun un SVG plein cadre dans un wrapper animé. Chaque vis, chaque switch et chaque touche est un élément positionné sur sa boîte, qui contient un petit SVG au viewBox recadré (les tracés gardent les coordonnées de la planche). La rotation dans le plan iso garde la conjugaison de la planche, `matrix(iso) rotate(r) matrix(iso⁻¹)`, en une seule transformation dont seul l'angle est interpolé. Le tout est posé sur une scène de 820 × 614 px, mise à l'échelle de la colonne par `scale: tan(atan2(100cqi, 820px))` : les keyframes gardent les chiffres de la planche.
- **Une animation de transformation par élément.** Deux animations de `transform` sur une même cible ne sont pas compositées (Chrome, raison « animations incompatibles ») : la montée et le clip d'une touche sont sur deux boîtes imbriquées, et le clip se mesure depuis la touche montée (0 → 35,8 → 34 au lieu de −34 → 1,8 → 0).
- **Keyframes CSS, pas GSAP.** Les animations ne s'appliquent que sous `html.intro`, posée avant la première peinture par le script inline d'`IntroTrigger.astro`, ou sous `[data-assemble]` pour « Rejouer ». L'état au repos est celui de la page : sans JS, en mouvement réduit ou sans lecture, le clavier est monté. Plus de Voile : rien ne cache la page, rien ne passe l'Intro, la page défile pendant qu'elle joue.
- **Le module** (`src/hero/etabli.ts`) ne fait que dire au socle où en est l'ouverture. Il signale `idle` dès que polices et images sont en place, les scènes se construisant pendant le vol puisque le thread principal ne déplace rien. Il signale `end` quand la dernière animation du hero a fini (`getAnimations()`, `finished`), et c'est lui qui retire la classe. Le script inline la retire de toute façon à `END + 3 s` (`src/hero/etabli-timing.ts`), si le module ne tourne jamais.
- **« Rejouer »** relance le clavier seul, comme la planche (le texte ne remonte pas). Il pose `data-assemble` et le retire quand toutes les animations ont fini, ce qui rend le clavier au repos. Pressé en cours de route, il les annule et les relance dans la même tâche, sans image intermédiaire. Le bouton est caché sans JS et en mouvement réduit, mais réservé dès la première peinture pour ne rien déplacer (CLS).
- **Écarts à la planche.** Le point de rupture du hero passe de 760 à 860 px, celui du site. « Rejouer » est centré sous le clavier : collé à droite, il heurtait le tiroir du Nuancier, fixé dans ce coin. Les touches du screencast de l'Accroche pendent sous la colonne de texte.

## Conséquences

- Le globe, son Worker, le HUD, le Voile et la carte (graticule, échelle, repère) disparaissent, avec l'ébullition du grain pendant l'Intro.
- `paintSky` ne calcule plus que le thème et le lever et le coucher (ADR 0008, mise à jour du 2026-11-15).
- Le DOM du hero gagne environ 900 nœuds (61 touches de 6 boîtes et leurs SVG, 61 switchs), sans calcul au navigateur.
- Pendant l'assemblage, quelques centaines de calques compositeur vivent 4 s ; aucun `will-change` permanent.
- La vis qui tourne (`.slot`, dans son petit SVG) reste animée hors compositeur : 5 × 0,24 s sur un dessin de 12 px.
- Le texte monte depuis une opacité de 0,01, pas de 0 : à opacité nulle, l'Accroche (le plus grand texte, donc le LCP) n'était comptée qu'à sa montée, à 1,5 s. Le LCP passait à 2,8 s et la note Performance à 95.
- **Mesuré au banc** (2026-11-15, contre `main` au même moment). Lighthouse mobile sur l'accueil : 99 / 100 / 100 / 100, LCP 1,7 s, comme `main`. En souris (CPU ×1), la phase Intro a un p95 de 4,8 ms, une pire image de 15,2 ms et une CLS de 0,0003 (`main` : 3,4 ms, 80 ms et 0,0009). Au doigt (CPU ×4), son p95 monte à 21,7 ms (`main` : 12,9 ms), avec les mêmes longues tâches de chargement des deux côtés. **Cause** : Chrome recalcule sur le thread principal, à chaque image, le style de chaque animation en cours, même compositée. Le coût suit le nombre d'animations des touches : environ 4 ms par image au vol en CPU ×1, 1,5 ms sans touches, 0,3 ms sans Intro. Le mouvement reste sur le compositeur, donc un thread principal occupé ne retarde pas les images de l'assemblage. Le réduire demanderait de fusionner les cinq mouvements de chaque touche (trajet, décalage, rotation, montée, clip) en une seule animation, donc de s'écarter des courbes de la planche ; écarté pour l'instant.
- Le socle construit désormais les scènes dès que la page est posée quand l'ouverture signale `idle` trop tôt, au lieu de les remettre à sa fin.

## Options écartées

- **Porter la planche telle quelle** (SVG unique, `<g>` animés) : repeint complet à chaque image.
- **Une timeline GSAP** : mêmes éléments, mais le thread principal à chaque image, et du JS là où le CSS suffit.
- **Garder le Voile** au-dessus d'un hero déjà peint : il cacherait l'assemblage, qui est le hero lui-même.
