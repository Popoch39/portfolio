# 0009 · Nuancier : quatre papiers dans un éventail

- Statut : acceptée
- Date : 2026-11-12
- Planche : « 03 · Nuancier — un éventail de papiers », version téléphone (canvas 4G4SyuZgZ4GiFvoTRsxZ47)

## Contexte

`:set bg=auto|light|dark` (ADR 0008) choisissait le jour ou la nuit dans la statusline. Louis veut quatre papiers, dont un nouveau, le **Cyanotype** (tirage bleu), choisis dans un nuancier d'imprimeur riveté dans le coin de la fenêtre : la bande choisie s'envole, le nouveau papier gagne la page en cercle depuis elle, cerclé du signal, puis l'éventail se referme et se rouvre avec cette bande devant. Le tout fluide au téléphone.

## Décision

- **L'éventail remplace `:set bg=`.** Fixé en bas à droite au-dessus de la statusline, sur toutes les pages (`Nuancier.astro`, dans le `Layout`). La statusline n'affiche plus que le papier en cours (`papier EN-04 · auto · nuit`, le nom seul sous 861 px), lu sur la racine en CSS.
- **Quatre radios natives** (`name="bg"`, groupe nommé « Papier du site ») : flèches, nom, état sans script. Chaque bande est imprimée dans son propre papier, pareille sur tous les thèmes. Cachées sans JS ; cochées, et la bande choisie mise devant, par un script inline avant la première peinture. Le choix reste dans `localStorage` (`bg`), comme avant.
- **Le Cyanotype est un thème à part entière** (`data-theme='cyan'`, jetons dans `global.css`), forcé seulement : le soleil n'y mène jamais. La carte du hero passe au bleu avec la page et ne porte pas de nuit (comme le jour forcé). La statusline prend le bleu nuit du tirage. `paintSky` pose aussi `data-sun` (`up`/`down`), que la bande Auto lit pour annoncer le prochain lever ou coucher.
- **La révélation est une view transition.** L'ancienne page est un instantané, la nouvelle est vivante sous un `clip-path: circle()` animé sur `::view-transition-new(root)` depuis le centre de la bande, jusqu'au coin le plus éloigné. La page se restyle une fois, dans la mise à jour de la transition, jamais pendant. L'anneau est un élément de la page mis à l'échelle avec le cercle : il court juste à l'intérieur du nouveau papier. L'éventail a son propre groupe (`view-transition-name`, posé seulement pendant la bascule) : ses bandes bougent en direct au-dessus. Les taps traversent la transition (`pointer-events: none`) : un nouveau choix saute l'animation en cours et repart de là.
- **Les bandes ne bougent qu'en `rotate` et `transform`.** La chorégraphie (envol, fermeture, réouverture) tient en deux minuteries ponctuelles, effacées à chaque choix.
- **Cibles de 24 px (WCAG 2.5.8).** Les bandes de la planche (34×100 px à −30/−20/−10/+2°) ne laissaient dépasser que 13 à 15 px : au téléphone, elles passent à 40×124 px, à −47/−28/−13/0°. Au bureau, l'éventail ouvert passe à −45/−25/−10/+4°. Sous la souris, il reste presque fermé au repos et s'ouvre au survol ; une fois survolé, tout l'éventail tient le pointeur, sinon l'ouverture déroberait la bande et le refermerait. Le clavier l'ouvre aussi ; un tap ou un clic, non.
- **Mouvement réduit, ou pas de view transitions** : le papier change d'un coup, la bande passe devant sans bouger.

## Conséquences

- Mesuré en CPU ×4 (Pixel 7) : une image de 33 à 50 ms au tap (capture et restyle de la page, avant le départ du cercle), puis toutes à la cadence. Lighthouse mobile 100 partout.
- L'éventail couvre en permanence environ 150 × 160 px du coin bas droit au téléphone (220 × 220 au bureau), hors des bandes cliquable à travers.
- L'étiquette de la nuit sur le hero dit `nuit · papier EN-02` au lieu de `nuit · :set bg=dark`.

## Options écartées

- **Deux couches de page, comme la planche**, l'une coupée en cercle : il faudrait dupliquer tout le DOM.
- **Garder `:set bg=` avec l'éventail** : deux sélecteurs à tenir synchronisés.
- **L'éventail dans le hero seulement** : rien de masqué en lisant, mais un second sélecteur pour le reste de la page et la 404.
- **Les angles de la planche** : 97 en accessibilité, des cibles de 13 px au doigt.

## Révision : huit papiers, deux livrets (2026-11-12)

Louis ajoute quatre papiers, forcés seulement comme le Cyanotype, chacun avec sa seule encre et l'accent gardé : **Kraft** (`kraft`, EN-05), **Calque** (`tracing`, EN-06), **Sanguine** (`sanguine`, EN-07) et **Phosphore** (`phosphor`, EN-08). Leurs jetons sont dans `global.css`, contrastes AA vérifiés ; sur les papiers clairs, `--color-accent-display` fonce pour garder 3:1. La carte du hero prend le papier sans nuit, la statusline prend l'encre la plus profonde du papier.

- **Deux livrets rivetés côte à côte**, quatre bandes chacun, avec la géométrie ci-dessus : les clairs à gauche (Kraft, Sanguine, Calque, Jour), les sombres et Auto dans le coin (Phosphore, Cyanotype, Nuit, Auto). Un seul groupe de radios : les flèches passent d'un livret à l'autre. Un choix ne ferme et ne rouvre que le livret de sa bande ; un choix dans l'autre livret pendant la bascule met tout de suite devant la bande du choix précédent.
- **Écarté : un seul éventail de huit bandes en quart de cercle** (−90° à 0°, 13° entre bandes). L'audit `target-size` de Lighthouse raisonne sur les boîtes englobantes des bandes pivotées, qui s'y recouvrent presque entièrement : 97 sur l'accueil, 95 sur la 404. Au doigt, ce qui dépasse des bandes du fond se réduit à un coin d'environ 14 px de large, et l'ajustement tactile de Chromium donne le tap à la bande voisine. Aucun réglage d'angle ni de longueur n'y remédie dans un quart de cercle.
- **Conséquence** : l'emprise permanente passe à environ 280 × 160 px au téléphone (360 × 220 au bureau). Lighthouse mobile reste à 100 en accessibilité.
