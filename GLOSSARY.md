# Glossaire

## Animation

**Scène**
Toute animation dont le déclenchement ou l'avancement dépend du défilement : révélation à l'entrée, scrub, épinglage, séquence. Une scène passe par GSAP + ScrollTrigger et s'enregistre auprès du socle d'animation ; elle n'existe que si le mouvement est autorisé.
_À éviter_ : effet, animation de scroll.

**Révélation**
Scène la plus simple : un élément entre dans la vue et anime une fois vers son état final. Jamais sur ce qui est visible au premier affichage (hero, élément LCP).

**Animation d'interface**
Animation qui ne dépend pas du défilement : survol, chargement, hero, transition entre pages. Elle reste en CSS (les transitions entre pages sont des view transitions cross-document).

**Défilement lissé**
Défilement à la molette et au trackpad interpolé par ScrollSmoother (environ 1 s d'inertie). Jamais au doigt, jamais sous `prefers-reduced-motion: reduce`, jamais sans JS : le défilement reste alors natif.
_À éviter_ : smooth scroll (qui désigne aussi `scroll-behavior: smooth`).

**État final**
Rendu que donnent le HTML et le CSS seuls : tout le contenu visible, à sa place. Une scène anime depuis un état de départ vers cet état final ; sans JS ou en mouvement réduit, la page reste à l'état final sans rien défaire.
