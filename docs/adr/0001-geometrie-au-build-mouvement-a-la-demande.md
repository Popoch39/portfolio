# Géométrie des figures au build, mouvement chargé à la demande

Les figures des anatomies sont dessinées au build avec le kit vanilla du skill `anatomy` (TypeScript qui écrit du SVG) : chaque fiche livre sa figure au repos déjà dessinée dans le HTML, et un SVG autonome par projet sert l'aperçu et l'image de partage. Seul le mouvement passe par JavaScript : un module par figure, chargé à la demande dans un morceau séparé, monté sur la scène par un chargeur commun. On garde ainsi un premier rendu sans script, un accueil mobile aussi léger qu'avant, et une géométrie que l'audit du kit vérifie sous Node.

## Considered Options

- **Îlots React** (le chemin React/Next du skill) : écartés. Nouvelles dépendances, et environ 60 Ko de runtime sur chaque page qui affiche une figure, pour un dessin qui ne change pas de forme.
- **Iframes de pages autonomes** (les pages HTML que produit le kit) : écartées. Accessibilité dégradée (un document par figure, focus et lecteur d'écran à travers un cadre), responsive fragile (hauteur fixe d'un cadre) et thème dupliqué hors de la CSS du site.

## Consequences

Les règles « zéro JavaScript, zéro animation » de D1 sont révisées pour les figures seulement : scripts limités au JSON-LD et au chargeur ; attribut `style` toujours interdit sauf à l'intérieur des SVG de figure (le kit en émet) ; `animation` et `@keyframes` seulement dans la CSS des figures (celle du kit, et la palette des figures pour le grain), sous des sélecteurs `.iso` et des noms `iso-` ; `transition` et `:hover` toujours absents, les états survolés passant par des attributs posés par le script.
