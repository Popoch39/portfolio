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
- **Un geste la passe** : la première touche, le premier clic ou la molette (le doigt passe par le clic) amènent la page à l'état final et le Voile s'efface en un fondu de 300 ms. Tab met en plus le focus sur le premier lien. Le défilement est suspendu pendant l'Intro (smoother en pause) et rendu à sa fin.

## Options écartées

- **Le hero masqué en CSS puis révélé** : le LCP attendrait la fin de l'Intro, vers 7 s.
- **Garder le SVG de la maquette** : animer les attributs `d` à chaque frame recalcule la mise en page du SVG sur le thread principal ; le canvas ne coûte qu'un dessin.
- **Décider dans le module de scène** : il s'exécute après la première peinture ; la page apparaîtrait un instant avant le Voile.
- **CustomEase pour la courbe des révélations** : environ 4 Ko gzip de plus sur l'accueil pour une seule courbe ; `cubic-bezier(.16,1,.3,1)` est résolue en quelques lignes.

## Conséquences

- La décision lit `performance.getEntriesByType('navigation')`, que l'horloge simulée de Playwright vide : le test du retour par l'historique tourne sur l'horloge réelle.
- Les specs qui ne testent pas l'Intro arrivent « depuis le site » (`tests/e2e/fixtures.ts`, referrer de même origine) ; seule la spec `intro` visite l'accueil en direct.
- Le grain papier n'appartient plus à l'Intro (révision du 2026-11-03) : c'est une couche fixe sur toutes les pages, immobile, en CSS seul (`Grain.astro`), au-dessus de tout mais sans capter le pointeur. L'Intro le fait seulement bouillir pendant qu'elle se joue.
- Le trait du header est un pseudo-élément : l'Intro le trace par la propriété `--rule-scale` du header.
- L'Intro est l'**ouverture** du socle (2026-11-03, #47) : construite tout de suite, elle garde le thread principal pour elle. Les autres scènes, Accroche comprise, ne sont construites qu'à sa fin, qu'elle soit jouée jusqu'au bout, passée ou défaite par la préférence de mouvement (voir l'ADR 0001).
- Tout ce que crée l'Intro est défait par le `revert()` du socle, et par elle-même à sa fin : rien ne lui survit, ni styles en ligne, ni écouteurs.
