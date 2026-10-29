# Tri : scène CSS, cases tassées par semaine

Premier jet (#109) : la scène jusqu'au tassement, en paysage. `main` (#110), la scène couchée en portrait (#111), le repli (#112) et les mesures complètes (#113) le compléteront.

Sur l'accueil, la section Activité (le Tri, spec #107) s'épingle le temps de trois écrans de défilement (`300svh`). La scène est collée en haut (`position: sticky`, haute d'un écran) : l'en-tête de section, le compteur et la commande restent dans la colonne de la page ; dessous, toute la place jusqu'à la barre d'état est un conteneur de requêtes, où la vue de la planche H2 (le calendrier, ses mois, son échelle et ses notes, 1 280 × 360 px de la planche) est centrée et mise à l'échelle (`scale` en unités du conteneur, comme la Frise). À 1 280 × 800, elle est à la taille de la planche. La section sort de la colonne de l'accueil pour que la vue ait toute la largeur, et remet son contenu dans la colonne (`.container`).

Deux temps, aux bornes de la planche :

- **Une seule couleur (6–22 %)** : le calendrier à cinq niveaux, ses 232 Jours actifs en cases colorées selon la heatmap GitHub, est un calque immobile posé sur un calque d'une seule couleur ; il s'efface (`opacity`). La commande gagne ` --format=%ad`, une note dit qu'un Jour actif compte autant qu'un autre.
- **Tassement (28–56 %)** : chaque case glisse (`translate`) de son rang d'origine à son rang tassé, les Jours actifs en bas dans l'ordre des dates, les jours vides au-dessus. Chaque semaine a sa plage, sur 5/8 du temps, la première partant à 28 %, la suivante 28 × 3/8 / 53 % plus tard (la vague de la planche), en entrée et sortie cubiques. Les mois s'effacent (28–36,4 %), les jours vides s'estompent à moitié (un seul fondu sur leur calque), l'échelle « 7 j / 4 j / 1 j » apparaît (42–56 %) et s'efface avant `main` (62–70,8 %), la commande gagne ` | group-by semaine`, une note donne la moyenne de Jours actifs par Semaine active.

Le rang d'origine et le rang tassé de chaque jour sont calculés au build (`tri()` dans `src/lib/activity.ts`) et posés en classes (`r0`…`r6`, `k0`…`k6`, qui donnent `--r` et `--k`) ; une seule `@keyframes tri-pack` translate de `(--k − --r) × 20 px`. La plage de chaque semaine et la place des mois sont générées dans `src/lib/tri.ts`, en pourcentages littéraux (ADR 0014). Les règles de l'ADR 0009 s'appliquent : `@keyframes` `tri-` sur `transform`, `translate`, `scale` et `opacity` seulement, durée `auto`, une animation par propriété et par élément, toute la CSS de scène sous `prefers-reduced-motion: no-preference` et le `@supports` des scènes. Hors de ces conditions, le socle (#108) s'affiche inchangé : la piste, le compteur du départ et la vue y sont cachés.

La ligne de temps `--tri` est visible de la section (`timeline-scope` sur `.activity`, comme la Visite sur `.stack`), et non de toute la page comme le demandait la spec : `html` porte déjà celle de la Frise, et deux déclarations sur le même élément s'écraseraient. Seules la piste et la scène, sœurs dans la section, en ont besoin.

`main` et la phrase (#110) :

- **`main` (62–84 %)**, en vague comme le tassement (chaque semaine sur 5/8 du temps) : la figure du socle (`main` et la phrase) est posée dans la vue, sous le calendrier (une colonne de 20 px par semaine, le centre de chaque nœud à l'aplomb des cases de sa semaine), et non plus hors de la scène ; la planche décorative (mois, échelle, cases, notes) est sa sœur, cachée aux lecteurs d'écran. La colonne des Jours actifs de chaque semaine rétrécit (`scale`, origine au centre du nœud) jusqu'à rien, les jours vides s'effacent par colonne, le nœud grandit (`scale`) jusqu'à sa taille du socle, l'étiquette de pause apparaît. La commande gagne ` | uniq` (62–66,4 %), le compteur passe en fondu à « 51 semaines actives sur 53 » (73–79 %).
- **Phrase (88–97 %)** : un fondu.
- **Le trait sans `clip-path`** : un `scale: 0 1 → 1` par segment, depuis le nœud précédent (`::before` de chaque semaine). Chaque segment se trace dans le pas de la vague qui le sépare du précédent, à mi-plage de sa semaine (`tri-draw`, générée dans `src/lib/tri.ts`) : les segments se suivent bout à bout et le trait avance d'un seul tenant. L'enveloppe translatée de la Frise est écartée : elle couperait aussi les nœuds au front de la vague.

Toutes ces animations finissent sur l'état du socle (rien n'a d'étape `to` sauf ce qui disparaît) : la fin de la scène est la figure du socle, à la taille de la vue.

## Considered Options

- **La boucle `requestAnimationFrame` de la planche** (lecture automatique, molette capturée, curseur, SVG réécrit à chaque image) : écartée, comme pour la Frise. Le défilement reste natif et le mouvement est joué par le compositeur.
- **Le SVG animé** (les tracés de la planche, un par niveau) : écarté. Les attributs d'un SVG (`d`, `fill`, `opacity` d'un tracé réécrit) ne sont pas composés ; un tracé immobile ne pourrait pas tasser ses cases une à une.
- **L'animation par colonne** (une animation par semaine, la colonne tassée apparaissant à la place de l'originale) : pas prise d'avance, la spec voulant de vraies cases qui glissent. C'est le compromis si la mesure de l'animation par case ne tient pas (voir plus bas).
- **Une animation pour chacune des 365 cases** : réduite aux cases qui changent de rang. Une case qui garde le sien (le samedi d'une semaine pleine, toute une pause…) n'a pas d'animation : 243 cases animées sur 365, sans rien changer à l'image. Chaque animation coûte au thread principal et au compositeur à chaque image (mesures).
- **`clip-path`** et les **plages en `var()`** : écartés pour les raisons de l'ADR 0014.

## Consequences

L'accueil compte quatre scènes épinglées (Plongée 450svh, Frise 400svh, Tri 300svh, Visite 600svh). Aucun JS n'est ajouté. La scène tient 251 animations `tri-` (243 cases, et les calques, mois, échelle, notes et morceaux de commande), beaucoup plus que la Frise (79) : la Traîne, qui fait recalculer le style de tous les éléments animés d'une scène à chaque image de rattrapage (ADR 0012), n'y est donc pas branchée (voir les mesures).

En portrait, la vue paysage est encore réduite à la largeur de l'écran (environ 0,3 sur un téléphone de 390 px) : la scène couchée est le ticket #111.

## Mesures

- Poids de l'accueil (HTML, polices préchargées et module, Brotli qualité 4) : 83 777 → 86 474 octets en français, 83 463 → 86 038 en anglais (budget 90 000).
- Trace, 2026-10-28 : Chromium 155 fenêtré sous Wayland sur le GPU (ANGLE, Intel), 1 280 × 800, écran à 120 Hz, protocole de l'ADR 0013 (un cran de molette toutes les 100 ms sous le pointeur, 3 s vers le bas depuis le haut de la scène puis 3 s vers le haut, le Glissé faisant le reste). Seules les images où la page bouge pendant que la scène est épinglée sont comptées. Pour isoler le coût des cases, la même trace est refaite en coupant leurs animations (`animation: none` injecté), ce qui approche le coût d'une animation par colonne.
  - **Composition** : les 251 animations `tri-` sont composées (aucun `compositeFailed`). Pas de mise en page ni de peinture par image dues au Tri : les mises en page et peintures relevées (environ 50 et 190 sur 400 images à CPU ×4) sont les mêmes sans les animations des cases, et sans la vue.
  - **CPU ×1** : image médiane 8,3 ms, aucune image au-delà de 20 ms ; pendant tout le tassement, aucune au-delà de 10 ms. Les images en retard (environ 7 % des images) tombent dans les 20 derniers pourcents de la scène, où la section suivante arrive, et presque autant sans les cases (5 %).
  - **CPU ×4** : **régression pendant le tassement**. Entre 30 et 50 % de la scène, l'image médiane passe de 8,3 ms sans les animations des cases à 16,7 ms avec (120 → 60 images par seconde, pire image 25 ms), 57 images sur 67 au-delà de 10 ms contre aucune. Sur toute la scène : p95 41,7 ms dans les deux cas, 52 à 59 images au-delà de 20 ms sur environ 400 contre 43. Le surcoût par image : environ 1 ms de recalcul de style et 1,2 ms de commit du thread principal, pour les 243 cases animées. Avant de ne garder que les cases qui bougent (365 animées), le surcoût de commit était d'environ 1,6 ms par image.
  - **Décision de Louis (2026-10-28)** : il garde les cases réelles, qui glissent une à une, au prix de 60 images par seconde à CPU ×4 le temps du tassement (fluide à CPU ×1). Le mouvement par colonne reste le compromis de repli.
- **Sans Traîne (décision de Louis, 2026-10-28)** : la piste du Tri ne porte pas `data-trail`. Avec la Traîne, l'image médiane passe de 8,3 à 16,6 ms à CPU ×1, et de 8,4 à 50–58 ms à CPU ×4 : chaque image de rattrapage recalcule le style des 251 animations de la scène (ADR 0012). Le suivi est l'issue #115.
- **`main` (#110)**, même protocole, 2 passes à CPU ×4 entrelacées avec #109, 1 à CPU ×1 ; 468 animations `tri-`, toutes composées. Poids : 87 469 o (fr), 87 093 o (en).
  - **CPU ×1** : image médiane 8,3 ms partout, aucune au-delà de 20 ms ; 1 à 8 images en retard par dixième de la scène contre aucune.
  - **CPU ×4** : **régression**. Entre 60 et 90 % de la scène, l'image médiane passe de 8,3 ms à 16,7, 25 puis 33 ms ; 97 images au-delà de 20 ms contre 50–54, et le tassement lui-même ralentit (8,3 → 16,6 ms entre 10 et 20 %), chaque animation ajoutée coûtant au commit de chaque image (2,6 → 5 ms par image). Pas de mise en page par image ; les peintures (environ 950 contre 195) sont la première peinture de chaque élément animé quand il prend sa couche, deux fois par élément sur l'aller-retour, pas une peinture par image.
  - Sans les jours vides par colonne ni les traits (363 animations) : 16,7 ms entre 60 et 90 %, comme le tassement. Sans les animations des cases (mouvement par colonne, 225 animations) : 8,3 ms entre 60 et 70 %, 16,7 ms ensuite.
  - **À trancher par Louis.**
- À compléter (#113) : CPU ×1 et ×4 en 390 × 844, avant/après sur `main`, Lighthouse, captures aux cinq tailles.
