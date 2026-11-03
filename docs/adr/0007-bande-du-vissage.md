# 0007 · Vissage en bande d'images, calques recadrés

- Statut : acceptée
- Date : 2026-11-03
- Spec : #31 (ticket #34)

## Contexte

Dans le **Montage** (planche M1), le collecteur se pose sur le pas de vis puis fait un tour complet dans le sens horaire au défilement. Le générateur de la moka (`scripts/moka/build.mjs`) sait dessiner le collecteur à n'importe quel angle, ombrage recalculé : 37 vues, une tous les 10°, de la vue de départ à la pièce vissée. La maquette les empile en 37 SVG pleine taille (600 × 1000) et allume chacun dans sa tranche du défilement.

Sur le site, c'est intenable. Chaque vue compte environ 210 tracés : la rastériser coûte, et 36 changements de vue pendant le tour, c'est 36 rastérisations sur le thread principal. Empilées en pleine taille, les vues pèsent chacune 600 × 1000 pixels de calque, soit, en DPR 3, des centaines de Mo de décodage pour des images presque vides. Le tour doit pourtant rester net et ne jamais saccader, même sur téléphone (60 fps, CLAUDE.md).

## Décision

- **Une bande d'images.** Un script d'atelier, `scripts/moka/strip.mjs` (sur le modèle de `scripts/og.mjs` : Playwright et ImageMagick, aucune dépendance ajoutée), relance le générateur, rastérise les 37 vues dans Chromium et les colle de haut en bas en une seule image WebP, commitée : `src/assets/moka/screw.webp`. Une commande la régénère : `node scripts/moka/strip.mjs`.
- **Densité : 2× la figure desktop.** La figure de la planche fait 444 px pour un cadre de 600 : 0,74 px par pixel du cadre, 1,48 en 2×. Arrondie à 1,5, chaque vue tombe sur un nombre entier de pixels (480 × 381), la bande fait 480 × 14 097 px, sous la limite de 16 383 px du WebP, pour environ 360 Ko. À 2× de la taille zoomée (la caméra finale, × 1,56), elle dépasserait 21 000 px ; le tour se joue avant le zoom, la taille non zoomée suffit.
- **Les traits fins comme ceux du calque.** Les traits du dessin gardent leur épaisseur en pixels CSS de la boîte de l'image. Le script dispose donc chaque vue comme sur la page (à la taille du gros plan, que la caméra réduit) avant de la mettre à l'échelle de la bande : au relais, les traits de la bande et ceux du calque SVG ont la même épaisseur.
- **Couleurs en WebP avec perte, alpha sans perte.** Le collecteur passe devant le joint et le filtre : ses bords restent nets sur les calques du dessous.
- **Une fenêtre à la boîte des vues.** Le générateur recadre les 37 vues sur leur boîte commune et l'écrit dans `moka.json` (`screw`, en % du cadre). Sur la page, une fenêtre à cette boîte, `overflow: clip`, se place comme un calque et descend avec le collecteur. Dedans, la bande avance par vues entières : un tween `yPercent` en `steps(36)`, jamais une position intermédiaire, donc jamais deux vues mêlées ni une vue floue. Chaque vue est bordée de vide (la marge du recadrage) : un arrondi de pixel au bord de la fenêtre ne montre rien de la vue voisine. Le pas est repeint, pas promu en couche : une couche haute comme la bande pour 36 déplacements coûterait plus que 36 petites peintures.
- **Le relais.** Avant et après le tour, le collecteur affiché est le calque SVG. Comme sur la planche, la première vue, éclairée (ses arêtes au signal), monte en fondu par-dessus le calque pendant la descente : c'est la lueur du collecteur. Le calque s'éteint au premier cran et se rallume au dernier, une seule bascule de chaque côté ; la vue vissée s'efface ensuite par-dessus lui.
- **Décodée d'avance.** La bande attend dans un `<template>` et la fenêtre reste `hidden` tant que la scène ne les met pas en place : sans JS (où un navigateur charge une image `lazy` d'emblée) comme sous mouvement réduit, la bande n'est jamais téléchargée. Un `IntersectionObserver` passe l'image en chargement immédiat et appelle `decode()` à un écran de la section, bien avant le tour : un défilement rapide ne trouve aucun trou. Si le décodage échoue, le tour revient au calque, qui reste allumé.

## Calques recadrés

Les calques du dessin (`src/assets/moka/*.svg`) sont recadrés chacun sur sa boîte, et `moka.json` donne leur place en % du cadre. Pleine taille, chacun coûterait une surface de 600 × 1000 au DPR à rastériser, à décoder et à composer, pour quelques pièces souvent minuscules (le bouton du réchaud tient en 8 × 9 pixels). La boîte vient de la géométrie, pas d'un rastériseur : une relance du générateur redonne les mêmes fichiers sur n'importe quelle machine. La bande suit la même règle : ses vues sont recadrées sur leur boîte commune avant d'être rastérisées.

## Options écartées

- **36 SVG pleine taille empilés, allumés tour à tour** (la maquette) : des centaines de Mo de décodage en DPR 3 et environ 210 tracés à rastériser à chaque cran.
- **Les SVG recadrés, un par vue** : 37 requêtes et 37 décodages, chacun pouvant manquer à son cran au premier passage.
- **Une rotation CSS du calque** : le collecteur tourne autour d'un axe vertical vu en isométrie ; une rotation 2D ne redessine ni l'anse qui passe derrière, ni l'ombrage, ni l'inscription de la jupe.
- **`object-position` ou `clip-path` pour choisir la vue** : propriétés de peinture, hors de la règle « `transform` et `opacity` » des scènes.
- **Un `ScrollTrigger` pour lancer le décodage** : un déclencheur de plus sur la section épinglée laissait, au `revert()` du socle, les pièces levées. L'observer, hors de GSAP, se déconnecte dans le nettoyage de la scène.

## Conséquences

- La bande se régénère quand la moka change : `node scripts/moka/strip.mjs` relance aussi le générateur. Elle sort octet pour octet identique d'une relance à l'autre sur la même machine.
- Sans JavaScript, les navigateurs chargent les images différées comme les autres : la bande est téléchargée sans servir. Sous mouvement réduit, elle ne l'est pas.
- La densité est calée sur la figure desktop. Sur une figure plus grande ou plus petite, les traits de la bande et du calque divergent légèrement au relais.
