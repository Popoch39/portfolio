# Notes de la figure : mise en page au build, bascule et mouvement en CSS

Sur la fiche, chaque pièce a sa note posée autour de la figure et reliée à elle par un trait, lisible en clair ou en code (maquette B4 · Bloc curseur, qui remplace le repère). Où chaque note se pose, par quel chemin passe son trait et où se referme son viseur est calculé au build, d'après les ancrages des pièces relevés une fois dans Chromium (`pnpm ancres`) ; la page reçoit ces valeurs en propriétés personnalisées, dans une feuille `<style>` générée, et la CSS en tire les positions à la taille réelle de la carte (unités de conteneur, `min()`/`max()`). La bascule entre les deux lectures est un groupe de boutons radio lu par `:has()`, et chaque mouvement une transition de `translate`, `scale` ou `opacity`. Aucun script ne mesure, ne place ni n'anime les notes : seule la mise en avant des pièces (`highlight.ts`, déjà là) pose `data-on`.

## Considered Options

- **Placement au script, comme le repère** (mesurer la pièce visée, suivre la carte avec un `ResizeObserver`) : écarté. Du JavaScript sur le chemin du survol, des lectures de mise en page sur une figure de deux mille éléments, et des notes qui n'existent qu'une fois le script chargé.
- **Positionnement d'ancrage CSS** (`anchor()`) entre la note et la pièce : écarté. Pas encore disponible partout, et les traits sont l'essentiel de la maquette ; les ancrages relevés au build donnent le même résultat dans tous les navigateurs.
- **Animations `@keyframes` déclenchées par une classe** (la maquette) : écartées. Elles demandent un script pour poser la direction de la bascule et rejoueraient au chargement ; des transitions à délais, que seul un changement d'état déclenche, font la même chorégraphie sans script.

## Consequences

La règle « jamais de `transition` » de D1 et de l'ADR 0001 est révisée pour les notes seulement : `transition` n'apparaît que sous `.annot`, la portée des notes, et uniquement dans `@media (prefers-reduced-motion: no-preference)` ; `:hover` reste absent et l'attribut `style` reste interdit hors des SVG de figure. Une figure modifiée doit être remesurée (`pnpm build && pnpm ancres`) : le relevé porte l'empreinte de la figure mesurée et le build échoue tant qu'il ne correspond plus.
