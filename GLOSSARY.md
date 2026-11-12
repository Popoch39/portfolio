# Glossaire

## Animation

**Scène**
Toute animation dont le déclenchement ou l'avancement dépend du défilement : révélation à l'entrée, scrub, épinglage, séquence. Une scène passe par GSAP + ScrollTrigger et s'enregistre auprès du socle d'animation ; elle n'existe que si le mouvement est autorisé.
_À éviter_ : effet, animation de scroll.

**Révélation**
Scène la plus simple : un élément entre dans la vue et anime une fois vers son état final. Jamais sur ce qui est visible au premier affichage (hero, élément LCP). Le site n'en porte plus : la dernière, sur la liste de la Stack, a été remplacée par l'Atome (#15).

**Animation d'interface**
Animation qui ne dépend ni du défilement ni d'un état JS : survol, défilement du bandeau, transition entre pages. Elle reste en CSS (les transitions entre pages sont des view transitions cross-document). Le chargement de l'accueil n'en fait plus partie : c'est l'Intro.

**Intro**
La séquence jouée une fois au chargement de l'accueil, sous le Voile : le globe tourne vers Besançon, se découpe en fuseaux qui deviennent les colonnes de la page, le point de Besançon se pose sur le repère de la carte du hero, puis le header, le hero et la statusline se révèlent. Timeline GSAP enregistrée auprès du socle (ADR 0005). Elle ne se joue ni au retour par l'historique, ni depuis une autre page du site, ni avec une ancre, ni en mouvement réduit ; un clic, un tap ou une touche la passe, un défilement non.
_À éviter_ : loader, splash screen.

**Ouverture**
Le rôle de l'Intro auprès du socle : seule construite au chargement, elle garde le thread principal tant qu'elle bouge. L'Ouverture construit les scènes et l'Accroche dans un **temps mort** de l'Intro, sous le Voile, quand ni le globe ni aucun tween de la page ne bouge (entre la remise du point de Besançon et la montée de la statusline) : l'Intro finie, la page défile sans attendre. Passée avant ce temps mort, défaite, ou si polices et images n'étaient pas encore en place, elle les construit à sa fin. Sans Intro, elles le sont une fois polices et images en place (ADR 0001).

**Accroche**
La phrase du hero (« Je construis les cartes de votre réseau électrique. »), réécrite en Vim d'une version à l'autre : chaque version parle à un public. Minuteries en JS, pas une scène : elle attend la fin de l'Intro, se fige hors de l'écran et sous la Pause, et ne démarre pas en mouvement réduit. Son état final est la première version ; les lecteurs d'écran lisent une phrase stable.
_À éviter_ : lede (réservé au code), typewriter.

**Pause**
La bascule de la statusline, à côté de `NORMAL`, qui fige le bandeau et l'Accroche puis les relance (WCAG 2.2.2). Une case à cocher native : le bandeau s'arrête même sans JS ; l'Accroche revient entière, au repos, sur sa version courante, et reprend de là. Le choix est retenu par visiteur. Seule partie de la statusline exposée aux lecteurs d'écran.
_À éviter_ : bouton play/pause, stop.

**Voile**
La couche papier opaque qui couvre la fenêtre pendant l'Intro, au-dessus de la page déjà peinte à son état final. Elle s'efface en une frame quand la page se révèle. Sans la classe `intro` posée avant la première peinture (sans JS, notamment), elle n'existe pas. Si l'Intro ne démarre pas, un filet la lève quand même (ADR 0005).
_À éviter_ : overlay, masque.

**Terminateur**
La ligne qui sépare le jour de la nuit sur la carte du hero, là où le soleil se couche (ou se lève) à Besançon à l'heure de la visite, bordée de son liseré signal et des crépuscules hachurés. L'heure ne fait que la glisser ; elle tombe à la fin de l'Intro (ADR 0008).
_À éviter_ : dark mode, thème sombre (pour la ligne elle-même).

**Nuancier**
L'éventail de bandes riveté en bas à droite de la fenêtre, une bande par papier, qui choisit le Papier du site (ADR 0009). Le papier choisi gagne la page en cercle depuis sa bande.
_À éviter_ : theme switcher, sélecteur de thème.

**Papier**
Le fond choisi dans le Nuancier, sur tout le site : Jour (`light`), Nuit (`dark`), Cyanotype (`cyan`, tirage bleu) ou Auto (`auto`, qui suit le soleil à Besançon : sombre du coucher au lever). Retenu par visiteur.
_À éviter_ : thème, mode sombre, `:set bg=` (retiré).

**Défilement lissé**
Défilement à la molette et au trackpad interpolé par ScrollSmoother (environ 1 s d'inertie). Jamais au doigt, jamais sous `prefers-reduced-motion: reduce`, jamais sans JS : le défilement reste alors natif. Sur un téléphone ou une tablette, il n'existe pas du tout, et les scènes épinglées défilent comme une page native.
_À éviter_ : smooth scroll (qui désigne aussi `scroll-behavior: smooth`).

**État final**
Rendu que donnent le HTML et le CSS seuls : tout le contenu visible, à sa place. Une scène anime depuis un état de départ vers cet état final ; sans JS ou en mouvement réduit, la page reste à l'état final sans rien défaire.

## Relief

**Relief**
La section qui suit le hero : le terrain de Besançon (la boucle du Doubs, la Citadelle, les collines) en carte à plat, nord en haut, à plus grande échelle que la carte du hero. Elle porte l'Estompage, les noms de lieux et un cartouche.
_À éviter_ : terrain (réservé au travail sur site : « équipe terrain »), section 3D.

**Estompage**
La pièce de la section Relief : le relief ombré à l'encre et au grain, dont les ombres portées répondent à la Lampe. Ce n'est pas une Scène : il ne dépend pas du défilement, le visiteur le manipule. Son état final est l'estompage des cartes imprimées, lumière au nord-ouest. Il suit le Papier : de jour il dessine l'ombre, de nuit la lumière.
_À éviter_ : hillshade, shader, relief 3D, plan-relief.

**Lampe**
La lumière que le visiteur tient au-dessus de l'Estompage : là où est le pointeur, ou le doigt tant qu'il touche la carte. Sans visiteur, elle est au nord-ouest. Au pointeur, elle y revient quand il sort de la carte ; au doigt, elle reste où on l'a laissée.
_À éviter_ : soleil (réservé au Terminateur), lumière, curseur.

## Parcours

**Frise**
La scène de la section Parcours : la carrière dessinée en graphe de commits sur un plan incliné, sur l'aplat sombre. À l'état final, le graphe est droit dans une bande qui défile à l'horizontale (ADR 0003).
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
L'anneau d'une catégorie de la stack, une par catégorie, dans l'ordre du profil de la base au sommet de la tour. Chaque bague passe en accent quand le défilement la met en avant ; l'étiquette SIG est en encre pleine, l'accent ne portant jamais de texte sur le papier (ADR 0006).
_À éviter_ : ring, orbite.

**Pastille**
Le logo d'un outil imprimé seul sur la bande de sa bague, sans disque, incliné avec elle. Un outil sans logo n'a pas de pastille : il reste dans l'étiquette.
_À éviter_ : chip, icône, électron.

**Tour**
L'empilement final des bagues, chacune à sa hauteur, avec son étiquette (catégorie et outils) à côté : l'état final de l'Atome.

## Café

**Café**
La section entre la Stack et le Contact : elle propose de parler d'un projet autour d'un café, sans engagement, ou en visio. Elle invite à écrire un mail, en face du Montage.
_À éviter_ : CTA, section moka.

**Montage**
La scène de la section Café : une Moka Express fidèle à la Bialetti se remonte pièce par pièce au-dessus d'un réchaud, puis le feu s'allume et la caméra s'approche du couvercle qui fume. Son état final est la moka montée sur le feu, vue de près.
_À éviter_ : assemblage, animation de la moka.

**Pièce**
L'une des six parties de la moka, dans l'ordre du Montage : la chaudière, l'entonnoir et son café, le filtre, le joint, le collecteur, le couvercle. Le réchaud n'en est pas une : il est là dès le départ.
_À éviter_ : calque (réservé au dessin), élément.

**Vissage**
Le tour complet, dans le sens horaire, que fait le collecteur une fois posé sur le pas de vis de la chaudière, comme sur une vraie moka.
_À éviter_ : rotation.
