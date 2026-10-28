# Notes de la figure : mise en page au build, bascule et mouvement en CSS

Sur la fiche, chaque pièce a sa note posée autour de la figure et reliée à elle par un trait, lisible en clair ou en code (maquette B4 · Bloc curseur, qui remplace le repère). Où chaque note se pose, par quel chemin passe son trait et où se referme son viseur est calculé au build, d'après les ancrages des pièces relevés une fois dans Chromium (`pnpm ancres`) ; la page reçoit ces valeurs en propriétés personnalisées, dans une feuille `<style>` générée, et la CSS en tire les positions à la taille réelle de la carte (unités de conteneur, `min()`/`max()`). La bascule entre les deux lectures est un groupe de boutons radio lu par `:has()`, et chaque mouvement une transition de `translate`, `scale` ou `opacity`. Aucun script ne mesure, ne place ni n'anime les notes : seule la mise en avant des pièces (`highlight.ts`, déjà là) pose `data-on`.

## Considered Options

- **Placement au script, comme le repère** (mesurer la pièce visée, suivre la carte avec un `ResizeObserver`) : écarté. Du JavaScript sur le chemin du survol, des lectures de mise en page sur une figure de deux mille éléments, et des notes qui n'existent qu'une fois le script chargé.
- **Positionnement d'ancrage CSS** (`anchor()`) entre la note et la pièce : écarté. Pas encore disponible partout, et les traits sont l'essentiel de la maquette ; les ancrages relevés au build donnent le même résultat dans tous les navigateurs.
- **Animations `@keyframes` déclenchées par une classe** (la maquette) : écartées. Elles demandent un script pour poser la direction de la bascule et rejoueraient au chargement ; des transitions à délais, que seul un changement d'état déclenche, font la même chorégraphie sans script.

## Consequences

La règle « jamais de `transition` » de D1 et de l'ADR 0001 est révisée pour les notes seulement : `transition` n'apparaît que sous `.annot`, la portée des notes, et uniquement dans `@media (prefers-reduced-motion: no-preference)` ; `:hover` reste absent et l'attribut `style` reste interdit hors des SVG de figure. Une figure modifiée doit être remesurée (`pnpm build && pnpm ancres`) : le relevé porte l'empreinte de la figure mesurée et le build échoue tant qu'il ne correspond plus.

## Mesures

Saccades des fiches (#90, spec #88), mesurées le 2026-10-28 sur la pointe de la spec (`fd31141`). Trace sur le GPU (Chromium 155 fenêtré, écran à 120 Hz, 16 px par image sur toute la fiche, aller et retour ; trois passes à 1 280 × 800, une à 390 × 844), p95 des intervalles d'image :

| Fiche | 1 280 × 800, CPU ×1 | 1 280 × 800, CPU ×6 | 390 × 844, CPU ×1 | 390 × 844, CPU ×6 |
|---|---|---|---|---|
| typomaniac | 8,4 ms | 67 ms | 8,4 ms | 58 ms |
| claude-tmux-notify | 8,4–16,7 ms | 67–83 ms | 8,4 ms | 42 ms |
| claude-status-line | 8,4 ms | 8,4 ms | 8,4 ms | 8,4 ms |
| pointcloud-viewer | 16,7 ms | 25 ms | 8,4 ms | 42 ms |
| trekker | 8,5–16,7 ms | 25 ms | 8,4 ms | 25 ms |
| ma-parcelle | 16,7 ms | 33–42 ms | 16,7 ms | 42 ms |

Seule claude-status-line, dont la figure est immobile au repos, tient la cible (p95 ≤ 8,4 ms à CPU ×1, ≤ 16,7 ms à CPU ×6). Ailleurs, les images perdues sont celles du mouvement de la figure, qui travaille à chaque image qu'on défile ou non ; trois causes, reproduites chacune dans une trace :

- **La bascule par `:has()`.** Les règles `.annot:has(input[value=…]:checked) …` font restyler et remettre en page une partie de la carte à chaque image où la figure s'écrit. Remplacées, pour l'expérience, par un sélecteur d'attribut équivalent (sans tête, CPU ×1, figure à l'écran, même phase du tour) : style de 5,7 à 1,2 ms par image et mise en page de 1,6 à 0,6 ms sur typomaniac ; style de 3,9 à 0,4 ms et mise en page de 2,2 à 0,4 ms sur claude-tmux-notify ; mise en page de 5,5 à 0,6 ms sur pointcloud-viewer ; rien sur trekker ni ma-parcelle. Sur le GPU à CPU ×6, typomaniac passe de p95 67–75 à 42 ms ; à CPU ×1, les images de plus de 10 ms de claude-tmux-notify passent de 47–53 à 10–17. Ni une portée plus étroite (`:has(> .cmd > …)`), ni une ancre qui ne contient pas la figure (`.statusline`, `.cmd`), ni une garde `:not([data-…])` devant le `:has()` n'y changent rien : seule l'absence de ces règles supprime le coût. Le retirer demande de revoir la bascule elle-même (un script qui recopie l'état des boutons radio sur la carte, contraire à cet ADR, ou des boutons radio placés avant les notes dans le document, qui changent l'ordre de tabulation et de lecture) : décision laissée à Louis.
- **Les sous-arbres réécrits à chaque image.** Les mouvements de typomaniac (tambour, bras), claude-tmux-notify (volets, cordon, guides, trous) et pointcloud-viewer (fantôme) réécrivent des groupes entiers par `innerHTML` : à CPU ×6, environ 800 éléments restylés par image sur typomaniac.
- **Le tramage de la figure.** Sur ma-parcelle et trekker, le thread principal reste sous 7 ms par image à CPU ×1, mais le GPU trame la figure redessinée en 20 à 25 ms par image (`RasterDecoderImpl::DoEndRasterCHROMIUM`). Ni le flou du halo (`filter: none`), ni le grain remplacé par un aplat, ni une couche propre pour la scène (`will-change: transform`, qui de plus change le lissage de la figure au repos de quelques pour cent) n'y changent quelque chose au-delà du bruit.

Aucune de ces causes n'est corrigée par #90 : les deux dernières tiennent au mouvement propre de chaque figure.
