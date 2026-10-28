# Frise : scène CSS sur plan incliné, tracé révélé par translation inverse

Sur l'accueil, la section Parcours (la Frise, spec #98) s'épingle le temps de quatre écrans de défilement (`400svh`, environ 30svh par Commit), et le git graph de la planche D · Maquette inclinée y glisse sous HEAD. La scène est un cadre bleu plein écran (`--accent`, la couleur de la planche) collé en haut (`position: sticky`), conteneur de requêtes. Dedans, la vue de la planche (1 280 × 720) : HEAD posé en (520, 430), une perspective de 1 100 px vue de (560, 240), le plan tourné une fois pour toutes (`rotateX(58deg) rotateZ(-22deg)`) et les étiquettes des Commits redressées de la rotation inverse. La vue est mise à l'échelle de la scène (`scale` en unités du conteneur, la hauteur comptant pour 720 px et la largeur pour 640 px, pour qu'un téléphone garde des étiquettes lisibles). Le rail du plan glisse en translation linéaire de 2018,25 à 2026,5 (de −110 à −3 740 px, à 440 px par an), et une fine barre de progression passe de l'échelle 0 à 1 sur la même ligne de temps. La géométrie (place des Commits, tracé de `main` et des trois Branches, translations) est tirée des Commits au build (`src/lib/frise.ts`), les Branches déduites des Commits.

Tout est en `@keyframes` `frise-`, pilotées par une `view-timeline` nommée `--frise` sur une piste posée en haut de la section, hors de l'épingle (ADR 0009), visible de toute la page (`timeline-scope` sur la racine : `body` porte déjà celle de la Plongée, et deux déclarations sur le même élément s'écraseraient). La CSS joue sous `@media (prefers-reduced-motion: no-preference)` et `@supports (animation-timeline: view()) and (animation-range: entry) and (timeline-scope: --frise)`, les conditions de la Plongée ; hors de ces conditions, le même HTML reste le git log vertical de #99, inchangé : la vue, le plan et le rail n'y sont que des boîtes sans style, le décor (grille, tracés, fondus, barre) est caché. La liste ordonnée des Commits est à la fois le contenu lu et indexé et les étiquettes posées sur le plan ; dans la scène, la Branche, le lieu et les missions sont masqués visuellement mais restent dans l'arbre d'accessibilité. Seules `transform`, `translate`, `scale` et `opacity` sont animées. Les règles de l'ADR 0009 s'appliquent : durée `auto` dans chaque raccourci, une seule animation par propriété et par élément.

La piste se déclare au repli des scènes (`data-timeline="--frise"`, `data-prefix="frise-"`), qui la joue dans Firefox. Elle ne déclare pas encore la Traîne (#103).

## Considered Options

- **La boucle `requestAnimationFrame` de la planche** (lecture automatique, molette capturée, curseur, lissage par image, `setState` qui réécrit largeur, hauteur et couleurs) : écartée. Tout passait par le thread principal à chaque image, la molette était détournée et le site veut le moins de JS possible ; la `view-timeline` laisse le défilement au navigateur et le mouvement au compositeur.
- **`clip-path` sur le tracé plein** (la planche anime la largeur d'un `clipPath`) : écarté, comme dans l'ADR 0008 et l'ADR 0009, `clip-path` n'est pas joué par le compositeur. Le tracé plein est révélé par **translation inverse** : une enveloppe masquante (`overflow: clip`), large de tout le tracé, avance de sorte que son bord droit reste sur HEAD, pendant que le tracé qu'elle contient recule d'autant et reste donc à sa place sur le rail. Les deux translations sont linéaires, sur la même plage que le rail : le tracé plein suit exactement HEAD. Le pointillé, dessous, ne bouge qu'avec le rail.
- **Plages calculées en `var()`** : écartées. Le repli des scènes lit les plages dans le style calculé, où il saurait substituer une variable, mais la spec veut des plages littérales, plus simples à relire et à tester : toutes sont en pourcentages écrits de la piste.
- **Le cadre de la planche mis à l'échelle tel quel** (1 280 × 720 en `scale` sur l'écran) : écarté, un téléphone de 390 px de large l'aurait réduit au tiers, ses étiquettes à 6 px. La largeur y compte pour 640 px ; la caméra adaptée au téléphone reste à faire (#102).
- **Le curseur de la planche** : remplacé par la barre de progression de la spec, en `scale` horizontal.

## Consequences

La section Parcours sort de la colonne de l'accueil pour que la scène couvre toute la largeur ; elle remet son contenu dans la colonne (`.container`). L'accueil compte trois scènes épinglées (Plongée 450svh, Frise 400svh, Visite 600svh). Le repli des scènes en joue deux. Aucun JS n'est ajouté.

Le plan est rendu en 3D par le compositeur : la grille (4 400 × 900 px du plan) et les deux tracés (4 000 × 400 px) sont de grandes couches, pixellisées une fois, à l'échelle de la vue ; le texte des étiquettes, redressé dans une scène en perspective, peut y être pixellisé à une autre échelle que celle de l'écran. À vérifier à l'œil et en trace.

La chorégraphie par Commit (point, poteau, étiquette, Commit actif en grand) est l'objet de #101 ; ici, les étiquettes sont posées sur le plan, toutes visibles, poteau à sa hauteur finale.

## Mesures

À compléter : poids de l'accueil, Lighthouse, trace de performance dans un Chromium fenêtré sur le GPU (pas de mise en page ni de peinture par image), captures en 390 × 844, 768 × 1024, 1280 × 720 et 1920 × 1080, émulation du mouvement réduit, recette de Louis (Firefox, Safari, téléphone).

- Poids de l'accueil (HTML, polices préchargées et module, Brotli qualité 4), mesuré au build : 81 979 → 83 424 octets en français, 81 690 → 82 967 en anglais (budget 90 000).
