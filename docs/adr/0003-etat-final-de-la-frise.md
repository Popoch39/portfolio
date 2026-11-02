# 0003 · État final de la Frise

- Statut : acceptée
- Date : 2026-11-02
- Spec : #9

## Contexte

La section Parcours devient la **Frise** (maquette D · Maquette inclinée) : un git graph posé sur un plan incliné vers l'arrière, sur un aplat accent pleine largeur. Dans la scène, le graphe file en diagonale à −22° et la caméra suit HEAD. L'ADR 0001 veut que le HTML et le CSS rendent l'**état final** et qu'une scène anime vers lui. Or une diagonale figée sort du cadre dès que le graphe dépasse la largeur de l'écran : sans JS ou en mouvement réduit, il faudrait défiler en deux dimensions pour la suivre.

## Décision

- À l'état final, le plan reste incliné vers l'arrière, mais le graphe est **droit**, de gauche à droite, entièrement construit : trait plein, piquets levés, toutes les étiquettes à pleine opacité.
- Le plan est posé dans une **bande à défilement horizontal natif**, focalisable et nommée comme région. La **perspective est portée par la bande** elle-même : son point de fuite reste fixe pendant que le contenu défile, si bien que la caméra ne bouge pas et que le graphe passe dessous.
- La scène ajoute la diagonale de −22°, coupe le défilement natif de la bande et fait avancer HEAD au défilement vertical. L'état final n'a donc pas le même cadrage que la scène : c'est un écart assumé avec la règle « la scène anime vers l'état final » de l'ADR 0001.
- Tout l'assemblage (commits, branches, positions, chemin SVG, aparté) est calculé au build par `careerGraph()` et le composant ; le navigateur ne reçoit que du HTML et du SVG.

## Options écartées

- **Garder la diagonale avec un défilement en deux dimensions** : la bande devrait défiler en x et en y à la fois, au doigt comme au clavier.
- **Poser le graphe à plat** : on perd le plan incliné, qui est la mise en scène retenue.
- **Remplacer la Frise par une liste** à l'état final : la page sans JS ou en mouvement réduit ne montrerait plus le graphe.

## Conséquences

- La liste ordonnée des commits est le contenu : le SVG du graphe et la grille sont en `aria-hidden`.
- Firefox ne peint pas un SVG non transformé dans un contexte 3D (`preserve-3d`) : le SVG du graphe porte un `translateZ(0)`.
- La bande couvre tout l'aplat, le titre posé dessus : la grille court jusqu'en haut de l'aplat, derrière le titre. L'œil (`perspective-origin`) est remonté au bord haut de l'aplat pour que l'horizon reste hors cadre et que la grille n'ait pas à être démesurément profonde ; sur les petits téléphones, debout ou couchés, il reste bas comme avant, la grille étant alors plus profonde par rapport à la fenêtre.
- La perspective agrandit ce qui est devant `main` et élargit d'autant le défilement de la bande : la grille ne déborde devant le trait que jusqu'au bord bas de l'aplat. Au bout du défilement, le coin haut droit reste sans grille : une grille assez large pour le couvrir élargirait encore le défilement.
- Grille et graphe sont posés sur deux copies du plan : la scène estompe les étiquettes lointaines sous le titre sans estomper la grille. À l'état final, sur un téléphone couché, les étiquettes des branches ne tiennent pas sous le titre : celui-ci les couvre, grille comprise.
- La mémoire graphique du plan (calques de la largeur du graphe) est à mesurer en DPR 3 ; la scène remplace la grille géante par un calque de la taille du cadre.
