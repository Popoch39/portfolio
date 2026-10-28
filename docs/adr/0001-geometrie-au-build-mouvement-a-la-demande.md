# Géométrie des figures au build, mouvement chargé à la demande

Les figures des anatomies sont dessinées au build avec le kit vanilla du skill `anatomy` (TypeScript qui écrit du SVG) : chaque fiche livre sa figure au repos déjà dessinée dans le HTML, et un SVG autonome par projet sert l'aperçu et l'image de partage. Seul le mouvement passe par JavaScript : un module par figure, chargé à la demande dans un morceau séparé, monté sur la scène par un chargeur commun. On garde ainsi un premier rendu sans script, un accueil mobile aussi léger qu'avant, et une géométrie que l'audit du kit vérifie sous Node.

## Considered Options

- **Îlots React** (le chemin React/Next du skill) : écartés. Nouvelles dépendances, et environ 60 Ko de runtime sur chaque page qui affiche une figure, pour un dessin qui ne change pas de forme.
- **Iframes de pages autonomes** (les pages HTML que produit le kit) : écartées. Accessibilité dégradée (un document par figure, focus et lecteur d'écran à travers un cadre), responsive fragile (hauteur fixe d'un cadre) et thème dupliqué hors de la CSS du site.

## Consequences

Les règles « zéro JavaScript, zéro animation » de D1 sont révisées pour les figures seulement : scripts limités au JSON-LD et au chargeur ; attribut `style` toujours interdit sauf à l'intérieur des SVG de figure (le kit en émet) ; `animation` et `@keyframes` seulement dans la CSS des figures (celle du kit, et la palette des figures pour le grain), sous des sélecteurs `.iso` et des noms `iso-` ; `transition` et `:hover` toujours absents, les états survolés passant par des attributs posés par le script.

## Mesures

Saccades des fiches (#90, spec #88), mesurées le 2026-10-28 sur la pointe de la spec (`fd31141`), tableau et méthode dans l'ADR 0003. Le mouvement des figures travaille à chaque image, qu'on défile ou non ; deux de ses causes tiennent au mouvement propre de chaque figure, la troisième (la bascule des notes par `:has()`) est dans l'ADR 0003 :

- **Les sous-arbres réécrits à chaque image.** Les mouvements de typomaniac (tambour, bras), claude-tmux-notify (volets, cordon, guides, trous) et pointcloud-viewer (fantôme) réécrivent des groupes entiers par `innerHTML` : à CPU ×6, environ 800 éléments restylés par image sur typomaniac.
- **Le tramage de la figure.** Sur ma-parcelle et trekker, le thread principal reste sous 7 ms par image à CPU ×1, mais le GPU trame la figure redessinée en 20 à 25 ms par image (`RasterDecoderImpl::DoEndRasterCHROMIUM`). Ni le flou du halo (`filter: none`), ni le grain remplacé par un aplat, ni une couche propre pour la scène (`will-change: transform`, qui de plus change le lissage de la figure au repos de quelques pour cent) n'y changent quelque chose au-delà du bruit.

Ni l'une ni l'autre n'est corrigée par #90 : il faudrait revoir le mouvement de chaque figure.
