# Traîne de la Visite, par la piste décalée

Lancée d'un grand geste puis lâchée, la Visite de l'Atome (ADR 0011) s'arrêtait net avec le défilement : sa ligne de temps suit exactement la page, et le Glissé (ADR 0010) ne lisse que la molette, cran par cran ; au pavé tactile, et sous Linux où son élan est court, rien ne la prolonge (retour de Louis). Un module (`src/components/trail.ts`, la Traîne) fait rattraper le défilement à la scène au lieu de le suivre : il garde le défilement que la scène montre, qui rejoint le vrai avec une constante de temps de 160 ms (une demi-seconde environ pour le rejoindre, arrêté net), et décale la piste de la Visite (`.visit-track`, élément absolu à sa place dans le flux) de l'écart, en `margin-top`. Toute la Visite lit sa progression sur cette piste : elle montre le défilement d'il y a un instant, et le navigateur continue de jouer toutes les animations `visit-` sur le compositeur, sans qu'aucune ne soit réglée par le script. Le retard est borné à un tiers d'écran : une ancre ou la Lunette, qui sautent loin, ne font pas rejouer toute la Visite, et la piste décalée ne descend pas sous le bas de la page. Loin de la section (une demi-hauteur d'écran autour, `IntersectionObserver`), ou là où la Visite ne joue pas (la piste n'y est pas affichée), la piste reste à sa place et le module ne demande aucune image. Il est demandé par le module de l'accueil avec le Glissé, une image puis une tâche après le premier rendu (ADR 0007).

## Généralisation

Pour que la Frise du Parcours (spec #98) hérite de la même inertie sans dupliquer le module, la Traîne ne cible plus la Visite par sa classe : elle suit toute piste qui la déclare (`data-trail`), chacune avec son défilement montré, son observateur et ses images, et la piste de la Visite porte la déclaration. Le comportement ne change pas (τ 160 ms, retard plafonné à un tiers d'écran, sommeil loin de la section ou là où la scène ne joue pas) et le module garde son poids (647 octets bruts, 390 en brotli). Une scène tenue par une translation qui compense le défilement, comme Projets en Plongée, ne doit pas la déclarer (ci-dessous).

## Considered Options

- **Régler les animations depuis le script** (`currentTime` de chacune à chaque image, comme le repli de Firefox) : écarté. Les quelque 300 animations de l'Atome passeraient par le thread principal à chaque image.
- **Lisser le défilement lui-même** (étendre le Glissé au pavé tactile, ou un élan écrit par le script) : écarté. Le pavé tactile garde son défilement (ADR 0010), et la page continuerait de bouger après le geste, sur tout le site.
- **`view-timeline-inset`** plutôt que la marge : écarté, faute d'avoir pu vérifier que Chromium accepte un retrait négatif, nécessaire en remontant ; la marge d'un élément absolu ne déplace que lui.
- **Pas de Traîne pour la Plongée** : sa scène est tenue par une translation qui compense exactement le défilement (Projets) ; en retard, elle tremblerait, ce qui a fait écarter le lissage de sa progression (ADR 0010). La scène de la Visite, collée par la CSS, ne dépend pas de sa ligne de temps.

## Consequences

Le « sans script » de la Visite (ADR 0011) est révisé pour la Traîne : l'accueil télécharge un module de plus après son premier rendu (647 octets bruts, 390 en brotli), qui écoute le défilement (`scroll`, passif). Pendant qu'il rattrape, il modifie une marge à chaque image, ce qui relance la mise en page de l'accueil ; il ne le fait que près de la section.

## Mesures

Le 2026-10-28, sur le GPU (#89, détail dans l'ADR 0011) : avec la Traîne, la Visite tombe de 120 à environ 88 images par seconde à CPU ×1 (p95 16,7 ms au lieu de 8,4) et de 70 à 15 à CPU ×6, en 1280 × 800 comme en 390 × 844. Ce n'est pas la mise en page (0,5 ms par image à CPU ×6) : décaler la piste change la plage de sa ligne de temps, et Chrome recalcule le style de tous les éléments animés de la Visite à chaque image où elle rattrape (environ 36 ms par image à CPU ×6, contre 7 ms sans elle). Réécrire la Traîne sans toucher à cette plage, ou la retirer, reste à décider.
