# 0004 · L’Atome en 3D DOM

- Statut : acceptée
- Date : 2026-11-02
- Spec : #15

## Contexte

La section Stack devient l’**Atome** (maquette 35 · Atome → tour) : des **bagues**, une par catégorie de la stack, passent de la cible au gyroscope puis à l’atome, et finissent empilées en **tour**, avec des **pastilles** de logos qui tournent sur chaque bague en restant face à l’écran. La maquette est écrite en CSS scroll-driven, avec `position: sticky` et un rayon `--r` animé (un layout à chaque frame), pour un seul écran de 1280 × 800, et ses pastilles, redressées dans le plan incliné de leur bague, sont à moitié coupées par la bande. Le portage doit tenir 60 fps, l’état final sans JS et le 100 Lighthouse mobile.

## Décision

- **3D en DOM** : le dessin est un contexte `preserve-3d` de `div`, `span` et SVG, en projection orthographique (aucune `perspective` : la profondeur trie les calques sans changer leur taille). La scène le pilote par GSAP (ADR 0001) et n’anime que `transform` et `opacity`.
- **Calculé au build** : rayons, hauteurs de la tour, rotation finale de chaque bague et angles des pastilles sont dérivés des données de profil (`stack`, dans l’ordre du profil de la base au sommet ; la bague SIG est désignée par la clé `accent`). Le HTML porte des transformations figées : c’est l’état final, sans JS comme en mouvement réduit. La table d’angles de la maquette (sept lignes) est indexée par le rang de la bague et parcourue en boucle au-delà.
- **Le rayon par `scale`** : chaque bague a un SVG de taille fixe, à son rayon de tour ; ses variations pendant la scène passent par `scale` sur ce SVG, jamais par une variable qui touche la mise en page.
- **Rotations Z · X · Z sur deux éléments** : GSAP n’écrit qu’une rotation Z avant la rotation X. L’enchaînement de la maquette est donc réparti entre la bague (translation, rotation Z, rotation X) et son plan (rotation Z). La pastille fait l’inverse sur deux éléments : le redressement (rotation Z inverse puis rotation X inverse), puis la pastille elle-même (rotation Z inverse). La course des pastilles autour de leur bague, liée au défilement, est portée par un troisième élément, la piste, dans le plan de la bague, défait par une rotation inverse sur l’emplacement de chaque pastille : GSAP ne sait pas additionner deux tweens sur une même rotation.
- **Pastilles soulevées** : face à l’écran, une pastille coupe le plan incliné de sa bague ; elle est donc avancée vers l’écran, dans la 3D, d’au moins son rayon (24 px pour une pastille de 12 px de rayon : à 60°, la bande qu’elle recouvre descend jusqu’à 12 × tan 60° ≈ 21 px de profondeur). Restée dans la 3D, elle est encore cachée par les bagues de devant. Pendant la scène, le soulèvement suit l’inclinaison (12 × tan de l’inclinaison + 3 px, jusqu’à 71 px pour une bague à 80°) ; la courbe est convexe, donc interpolée avec la même courbe d’accélération que l’inclinaison, elle n’est jamais en dessous du nécessaire.
- **Chorégraphie calculée au build** : chaque bague porte ses six poses (cible, gyroscope, atome, dérive, à plat, tour) et ses bornes dans un attribut `data-choreography` ; le script de la scène ne fait que les enchaîner dans une seule timeline épinglée. Les pastilles finissent leur course avec leur bague, posée dans la tour ; le calque accent arrive en dernier, à 90 % de la scène, et le dernier dixième est un temps d’arrêt sur la tour finie, où plus rien ne bouge. Les courbes `cubic-bezier` de la maquette sont reprises telles quelles par une petite fonction du script, plutôt que par CustomEase, que le socle ne charge pas.
- **Tranche allégée** : l’épaisseur d’une bague est un seul calque latéral sous la bande (deux calques par bague au lieu de cinq). Les SVG des bagues ne tournent pas dans leur plan : la bande est un cercle et ses graduations tombent tous les 5°, la rotation ne se voit que sur les pastilles, et la boîte carrée du SVG, tournée, déborderait de la colonne.
- **Accent en calque** : la bague SIG porte un calque accent superposé (bande et tranche), que la scène fait apparaître en `opacity` ; ses pastilles restent en encre comme les autres (la spec : « seule la bague SIG passe en accent ») ; jamais d’animation de `stroke` ni de couleur.
- **Logos en sprite** : SVG monochromes de simple-icons (CC0, provenance dans `src/assets/logos/README.md`), assemblés au build en un sprite de symboles inline, en `currentColor`. Pas de `mask-image`, qui donne des logos flous en 3D.

## Options écartées

- **CSS scroll-driven de la maquette** : pas d’`animation-timeline` dans Firefox stable (ADR 0001), et `sticky` est proscrit sous le défilement lissé.
- **Canvas 2D** : dessin et repli sans JS à réécrire, texte et netteté à gérer à la main.
- **three.js ou WebGL** : poids, rendu du texte, aucun repli sans JS.
- **Calque plat de pastilles projetées en 2D** : il casse la profondeur (plus de bague de devant pour cacher une pastille) et demande du JS à chaque frame.
- **Pastilles plus petites restées sur la bague** : le clipping diminue sans disparaître.

- **Recadrage** : en portrait (ou sous 640 px de large), la tour se centre en haut et les étiquettes s’empilent en liste dessous ; sinon elles restent à droite. Le CSS fixe l’échelle qui fait tenir la tour dans la largeur (0,82 sur téléphone, soit environ 300 px, 0,78 sous 360 px). La scène la réduit au besoin pour que le cadre épinglé tienne dans la hauteur au-dessus de la statusline, en mesurant à la mise en place et à chaque `refreshInit` de ScrollTrigger, jamais à chaque frame. Si garder le titre de section dans le cadre coûtait plus d’un quart de la tour (téléphone en portrait ou en paysage, fenêtre basse), l’épinglage commence sous le titre, qui sort par le haut. Le texte des étiquettes n’est jamais mis à l’échelle ; il se resserre par media query (14 px, 13 px sous 360 px), jamais sous 12 px.

## Conséquences

- **Sans opacité sur les conteneurs 3D** : une `opacity` inférieure à 1 sur une bague ou son plan aplatit le contexte 3D. Seuls les calques feuilles (calques accent, faces de pastille, noyau, étiquettes) passent par `opacity`.
- **Éléments de taille nulle** : l’axe de la tour et la chaîne des pastilles sont des boîtes de 0 × 0 en `preserve-3d`. La pastille, élément plat dans le contexte 3D, a la taille de sa face : Chromium rogne un tel élément à sa propre boîte.
- **Dessin décoratif** : tout le dessin est en `aria-hidden`, en `span`, `div` et SVG seulement ; la liste de définitions de la stack sert d’étiquettes et reste la seule lecture pour les lecteurs d’écran.
- **Calques promus pendant la scène** : sous le défilement lissé, l’épinglage déplace la section par une transformation 2D ; laissée dans le calque de la page avec le dessin qui change dedans, elle était repeinte et re-rastérisée à chaque frame. La scène passe donc la section et la boîte de la tour en `will-change: transform` (retiré avec elle en mouvement réduit), et les logos des pastilles portent `contain: paint`, sans quoi Chromium repeint chaque pastille à chaque frame.
- **Poids** : le sprite (28 logos) est inline dans le HTML de l’accueil, environ 44 Ko bruts avant compression (l’accueil passe à 29 Ko gzip).
