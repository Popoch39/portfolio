# Glossaire

## Animation

**Scène**
Toute animation dont le déclenchement ou l'avancement dépend du défilement : révélation à l'entrée, scrub, épinglage, séquence. Une scène passe par GSAP + ScrollTrigger et s'enregistre auprès du socle d'animation ; elle n'existe que si le mouvement est autorisé.
_À éviter_ : effet, animation de scroll.

**Révélation**
Scène la plus simple : un élément entre dans la vue et anime une fois vers son état final. Jamais sur ce qui est visible au premier affichage (hero, élément LCP). Le site n'en porte plus : la dernière, sur la liste de la Stack, a été remplacée par l'Atome (#15).

**Animation d'interface**
Animation qui ne dépend ni du défilement ni d'un état JS : survol, curseur qui clignote, transition entre pages. Elle reste en CSS (les transitions entre pages sont des view transitions cross-document). Le chargement de l'accueil n'en fait plus partie : c'est l'Intro.

**Intro**
La séquence jouée une fois au chargement de l'accueil, sous le Voile : le globe tourne vers Besançon, se découpe en fuseaux qui deviennent les colonnes de la page, puis le header, le hero et la statusline se révèlent. Timeline GSAP enregistrée auprès du socle (ADR 0005). Elle ne se joue ni au retour par l'historique, ni depuis une autre page du site, ni avec une ancre, ni en mouvement réduit, et n'importe quel geste la passe.
_À éviter_ : loader, splash screen.

**Accroche**
La phrase du hero (« Je construis les cartes de votre réseau électrique. »), réécrite en Vim d'une version à l'autre : chaque version parle à un public. Minuteries en JS, pas une scène : elle attend la fin de l'Intro, se fige hors de l'écran et ne démarre pas en mouvement réduit. Son état final est la première version ; les lecteurs d'écran lisent une phrase stable. Le point de l'Intro devient son curseur bloc.
_À éviter_ : lede (réservé au code), typewriter.

**Voile**
La couche papier opaque qui couvre la fenêtre pendant l'Intro, au-dessus de la page déjà peinte à son état final. Elle s'efface en une frame quand la page se révèle. Sans la classe `intro` posée avant la première peinture (sans JS, notamment), elle n'existe pas.
_À éviter_ : overlay, masque.

**Défilement lissé**
Défilement à la molette et au trackpad interpolé par ScrollSmoother (environ 1 s d'inertie). Jamais au doigt, jamais sous `prefers-reduced-motion: reduce`, jamais sans JS : le défilement reste alors natif.
_À éviter_ : smooth scroll (qui désigne aussi `scroll-behavior: smooth`).

**État final**
Rendu que donnent le HTML et le CSS seuls : tout le contenu visible, à sa place. Une scène anime depuis un état de départ vers cet état final ; sans JS ou en mouvement réduit, la page reste à l'état final sans rien défaire.

## Parcours

**Frise**
La scène de la section Parcours : la carrière dessinée en graphe de commits sur un plan incliné, sur l'aplat accent. À l'état final, le graphe est droit dans une bande qui défile à l'horizontale (ADR 0003).
_À éviter_ : timeline, git graph.

**commit**
Une étape de la Frise : le bac (`init`), un poste, un stage, une mission, ou une fusion qui ramène une branche sur `main`.

**branche**
Une formation : elle part de `main` à son début et y revient par le poste qui la suit, ou par une fusion sans étiquette.

**HEAD**
Le point courant de la progression dans la Frise ; à l'état final, le dernier commit, daté « aujourd'hui ».

## Stack

**Atome**
La scène de la section Stack : les bagues passent de la cible au gyroscope, puis à l'atome autour d'un noyau, se recouchent emboîtées et montent en tour. Son état final est la tour.
_À éviter_ : gyroscope, vue éclatée.

**Bague**
L'anneau d'une catégorie de la stack, une par catégorie, dans l'ordre du profil de la base au sommet de la tour. Chaque bague passe en accent quand le défilement la met en avant ; l'étiquette SIG est en accent.
_À éviter_ : ring, orbite.

**Pastille**
Le logo d'un outil imprimé seul sur la bande de sa bague, sans disque, incliné avec elle. Un outil sans logo n'a pas de pastille : il reste dans l'étiquette.
_À éviter_ : chip, icône, électron.

**Tour**
L'empilement final des bagues, chacune à sa hauteur, avec son étiquette (catégorie et outils) à côté : l'état final de l'Atome.
