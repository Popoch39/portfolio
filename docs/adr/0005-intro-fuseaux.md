# 0005 · Intro « Fuseaux » : canvas et GSAP, hero sous le Voile

- Statut : acceptée
- Date : 2026-11-03
- Spec : #23

## Contexte

L'accueil s'ouvre sur une **Intro** (maquette 04a · Fuseaux) : un globe découpé en 12 fuseaux qui se déroulent, se redressent en colonnes et rendent la main à la page. La maquette redessine sa géométrie à chaque frame (projection orthographique, demi-largeur des fuseaux le long des parallèles, arrêt sur le limbe) et anime en CSS des chemins SVG. Trois exigences pèsent sur le portage : le LCP mesuré dès la première peinture (Lighthouse 100 en mobile), 60 fps sur téléphone, et une page complète et immédiate sans JS, en mouvement réduit ou en navigation interne.

## Décision

- **Une timeline GSAP, enregistrée auprès du socle** (`registerOpening`, dans `src/intro/scene.ts`), pilote toute l'Intro : le dessin du globe et les tweens DOM du header, du hero et de la statusline. Elle ne dépend pas du défilement, mais de l'état JS (décision de jouer, geste qui la passe, préférence de mouvement) : c'est le cas d'exception que prévoit l'ADR 0001. Toutes les durées sont des constantes nommées (`src/intro/timing.ts`), au tempo « Réelle » de la maquette.
- **Le globe est dessiné dans un `<canvas>` 2D**, au DPR, sur la progression de la timeline. C'est une dérogation assumée à « une scène n'anime que `transform` et `opacity` » : la géométrie se recalcule à chaque frame et ne se décrit pas en transformations. Le texte (HUD, étiquette) reste en DOM, déplacé en `transform` et `opacity` ; seuls les chiffres du HUD réécrivent leur texte (une mise en page de quelques lignes), au rythme du grain (environ 14 fois par seconde) et seulement quand leur valeur change.
- **Le hero est peint à l'état final sous le Voile.** Le Voile, une couche papier opaque et fixe, couvre la fenêtre ; le hero n'est jamais masqué en CSS (ni `opacity: 0`, ni translation de départ). Le LCP est donc mesuré dès la première peinture. Quand le Voile s'efface, en une frame, les révélations posent leur état de départ à cet instant précis, jamais avant.
- **Un mini-script inline dans le `<head>` de l'accueil décide**, avant la première peinture, et pose la classe `intro` sur `<html>`. Sans cette classe, le Voile n'existe pas : sans JS, la page est à l'état final, sans flash. L'Intro ne se joue pas :
  - au retour par l'historique (bfcache ou non) ;
  - depuis une autre page du site (referrer de même origine), sauf sur un rechargement ;
  - avec une ancre dans l'URL ;
  - sous `prefers-reduced-motion: reduce`.
- **Un geste la passe** : la première touche ou le premier clic (le doigt passe par le tap) amènent la page à l'état final et le Voile s'efface en un fondu de 300 ms. Tab met en plus le focus sur le premier lien. Le défilement est suspendu pendant l'Intro (smoother en pause) et rendu à sa fin. Tenter de défiler (molette, swipe, touches de défilement) ne la passe pas : l'Intro continue, la page ne bouge pas. Le clic est écouté plutôt que `pointerdown`, qu'un swipe déclenche aussi.

## Options écartées

- **Le hero masqué en CSS puis révélé** : le LCP attendrait la fin de l'Intro, vers 7 s.
- **Garder le SVG de la maquette** : animer les attributs `d` à chaque frame recalcule la mise en page du SVG sur le thread principal ; le canvas ne coûte qu'un dessin.
- **Décider dans le module de scène** : il s'exécute après la première peinture ; la page apparaîtrait un instant avant le Voile.
- **CustomEase pour la courbe des révélations** : environ 4 Ko gzip de plus sur l'accueil pour une seule courbe ; `cubic-bezier(.16,1,.3,1)` est résolue en quelques lignes.

## Conséquences

- La décision lit `performance.getEntriesByType('navigation')`, que l'horloge simulée de Playwright vide : le test du retour par l'historique tourne sur l'horloge réelle.
- Les specs qui ne testent pas l'Intro arrivent « depuis le site » (`tests/e2e/fixtures.ts`, referrer de même origine) ; seule la spec `intro` visite l'accueil en direct.
- Le grain papier n'appartient plus à l'Intro (révision du 2026-11-03) : c'est une couche fixe sur toutes les pages, immobile, en CSS seul (`Grain.astro`), au-dessus de tout mais sans capter le pointeur. L'Intro le fait seulement bouillir pendant qu'elle se joue.
- Le trait du header est un élément à part (`.rule`) : l'Intro le trace par un `scaleX` sur lui seul, sans recalculer le style du header à chaque image (#72).
- Le dessin du globe (`src/intro/canvas.ts`, `src/intro/globe.ts`) n'utilise aucune API du DOM (#72) : il reçoit le contexte 2D, la palette, la mise en page, le ratio de pixels, le grain décodé en `ImageBitmap` (`src/intro/inputs.ts`, côté page) et de quoi créer ses sous-canvas, pour pouvoir tourner tel quel dans un Worker. Son ratio est plafonné à `min(devicePixelRatio, 2)`, sous-canvas compris ; une image identique à la précédente n'est pas redessinée, et la géométrie réutilise ses tableaux d'une image à l'autre.
- **Le globe est dessiné dans un Worker** (#76, `src/intro/globe.worker.ts`), sur le canvas transféré (`transferControlToOffscreen`). Le thread principal ne garde que les tweens du DOM, l'étiquette et le HUD : le clic qui passe l'Intro n'attend plus le dessin, et un thread principal chargé ne fait plus saccader le globe.
  - **Messages.** La page envoie `init` (canvas, palette, mise en page, ratio), `layout` (redimensionnement, `fonts.ready`), `grain` (le bruit décodé, copié : la page le garde pour le repli) et `time` (le temps de la timeline, et s'il continue de courir). Le Worker ne renvoie rien : seule son erreur remonte.
  - **Horloge.** Le Worker dessine à sa propre cadence le dernier temps reçu, prolongé du temps écoulé depuis, au plus 100 ms (deux fois la plus longue tâche que tolère le budget de fluidité) : sous le seuil de lissage de GSAP (500 ms), la timeline rattrape le temps réel à son tick suivant, et le globe reste synchrone avec les tweens DOM. Il n'est jamais ramené en arrière : s'il a pris de l'avance, il attend la timeline. Un onglet masqué et le geste qui passe l'Intro le figent (`running: false`) ; la reprise suit le lissage de GSAP.
  - **Repli.** Sans `transferControlToOffscreen` ni `Worker`, ou dès que le Worker émet une erreur (chunk non chargé, exception), le même module dessine sur le thread principal, sur un canvas neuf qui remplace celui transféré. Ce chemin ne dépend pas d'`OffscreenCanvas` : sans lui, les sous-canvas sont des canvas de page. Un Worker en échec n'est pas un échec de l'Intro.
  - **Fin.** Finie, passée ou défaite, l'Intro termine le Worker et remplace le canvas transféré par un canvas vide : rien ne survit, ni thread ni bitmap.
  - **Tests.** Une fois transféré, le canvas ne se lit plus depuis la page : le test des lignes peintes lit une capture d'écran, et ceux qui comptent les dessins ou mesurent le bitmap tournent sur le repli (chunk du Worker bloqué). Le Worker, servi depuis le site, passe la CSP sans l'élargir ; il ne contient pas GSAP.
- **Filet du Voile** (#40). Le script inline du `<head>` ne doit rien aux modules de la scène, qui peuvent ne jamais s'exécuter (réseau qui lâche, bloqueur, navigateur trop ancien, exception au démarrage) : sans filet, le Voile resterait et la page serait blanche.
  - **Signal de démarrage.** La scène pose `data-intro-started` sur `<html>` à la toute fin de son démarrage, et le retire à sa fin.
  - **Délai.** Sans signal 5 s après le script inline, la classe `intro` tombe. Sur le profil mobile de Lighthouse tel que DevTools l'applique (562,5 ms, 1,47 Mbit/s, CPU ×4), la scène démarre vers 2 à 2,5 s.
  - **Module en échec.** Sans signal, la classe tombe dès l'erreur de chargement d'un `<script type="module">` de la page (événement `error` écouté en capture sur le document).
  - **Ceinture.** Passé 5 s + la durée de l'Intro (9,84 s) + 5 s de marge, soit 19,84 s de page visible, la classe tombe quoi qu'il arrive. Le temps d'un onglet masqué ne compte pas : la timeline n'y reçoit pas d'images et attend aussi.
  - **Après le filet.** Une scène arrivée en retard trouve une page sans classe et ne joue pas ; le socle, qui lit la même classe, construit les scènes. Une Intro démarrée mais arrêtée en route (téléphone affamé) observe la classe : quand la ceinture la retire, elle rend la page comme à sa fin.
  - **Défilement.** La scène ne suspend le défilement qu'avec le signal, en dernier : un démarrage qui lève une exception laisse une page qui défile.
  - **Ouverture.** Une scène qui lève une exception au démarrage, ou dont seul le chunk manque, ne termine pas l'ouverture elle-même : le socle observe aussi la classe, et quand elle tombe sans que l'Intro ait fini, il termine l'ouverture et construit les scènes (#77).
  - **CSP.** Le script inline est autorisé par son hash (`Astro.csp.insertScriptHash`), comme celui de la Pause : il ne dépend plus de sa place avant la balise `<meta>` de la politique.
  - **Worker.** Un Worker en échec n'est pas un échec de l'Intro : son repli intervient après le signal, le filet le laisse faire.
  - **Tests.** Chunk du socle bloqué ou suspendu, exception au démarrage, Intro figée (ceinture), onglet masqué, et le profil mobile lent en Chromium, sur l'horloge réelle : le filet ne coupe jamais une Intro normale.
- L'Intro est l'**ouverture** du socle (2026-11-03, #47) : construite tout de suite, elle garde le thread principal pour elle. Les autres scènes, Accroche comprise, ne sont construites qu'à sa fin, qu'elle soit jouée jusqu'au bout, passée ou défaite par la préférence de mouvement (voir l'ADR 0001). Depuis #77, elles le sont dans son temps mort (`DEAD_TIME`, 7,95 s), quand elle y arrive : voir l'ADR 0001.
- Tout ce que crée l'Intro est défait par le `revert()` du socle, et par elle-même à sa fin : rien ne lui survit, ni styles en ligne, ni écouteurs.
- Hero « Méridien » (révision du 2026-11-04) : le nom n'a plus de curseur ni le header de coordonnées. Le point de Besançon atterrit sur le repère de la carte du hero (`.hero-point`) et son étiquette sur celle du repère (`.hero-place`), au même texte, téléphone compris ; les deux apparaissent au passage de relais. Les lignes du nom montent hors de la parallèle sur laquelle il se tient.
