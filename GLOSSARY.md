# Portfolio

Le site personnel de Louis Pocheron : son profil, et ses projets expliqués chacun par une machine dessinée.

Sous chaque terme, la ligne _EN_ donne le terme affiché sur les pages anglaises.

## Projets et fiches

**Projet** :
Un dépôt GitHub de Louis mis en avant sur le site.
_EN_ : Project
_Avoid_ : repo, réalisation

**Fiche** :
La page d'un projet, à son adresse lisible.
_EN_ : Project page
_Avoid_ : page projet, détail

**Lancement** :
À chaque chargement de l'accueil, sauf en revenant d'une page du site, le terminal qui ouvre `portfolio.md` dans Neovim avant que l'accueil n'entre ; une touche ou un clic le termine.
_EN_ : Launch
_Avoid_ : loader, intro, splash, écran de chargement

**Plongée** :
Sur l'accueil, entre le héros et les projets, le défilement où la page s'arrête : le curseur du nom grandit jusqu'à remplir l'écran, puis se range dans le carré de la section Projets. Elle se rejoue à l'envers en remontant.
_EN_ : Dive
_Avoid_ : animation au scroll, transition, scroll épinglé

**Glissé** :
Sur tout le site, un cran de molette fait glisser la page avec de l'inertie au lieu de la faire sauter ; le pavé tactile, le toucher et le clavier gardent leur défilement.
_EN_ : Glide
_Avoid_ : smooth scroll, Lenis, lissage

## Parcours

**Frise** :
La section Parcours de l'accueil : le chemin de Louis dessiné en git graph, du baccalauréat à HEAD. Sans animation au défilement, elle se lit en git log vertical.
_EN_ : Timeline
_Avoid_ : maquette, graph

**Commit** :
Une étape de la Frise (un diplôme, un poste, une mission marquante), avec sa date, son titre, son lieu et ses missions éventuelles.
_EN_ : Commit
_Avoid_ : étape, jalon, poste

**Branche** :
Une formation suivie à côté de `main` (`lea`, `access-code`, `cda`) : elle bifurque de `main` et y revient par une fusion. Les Branches se déduisent des Commits.
_EN_ : Branch
_Avoid_ : couloir, voie

**HEAD** :
Le dernier Commit de la Frise, « La suite » : là où en est Louis aujourd'hui.
_EN_ : HEAD
_Avoid_ : fin, présent

**Commit actif** :
Pendant que la Frise défile, le dernier Commit que la tête de lecture a atteint, jusqu'à ce qu'elle atteigne le suivant : son étiquette est pleine, et il est repris en grand en bas de l'écran.
_EN_ : Current commit
_Avoid_ : étape courante, Commit en cours, HEAD

## Activité

**Jour actif** :
Un jour avec au moins une contribution GitHub (commit, pull request, issue ou revue).
_EN_ : Active day
_Avoid_ : jour de code, jour travaillé

**Semaine active** :
Une colonne du calendrier GitHub (de dimanche à samedi) qui compte au moins un Jour actif.
_EN_ : Active week
_Avoid_ : semaine de code

**Tri** :
Le défilement où la section Activité s'arrête : le calendrier passe à une seule couleur, chaque semaine tasse ses Jours actifs vers le bas, puis devient un nœud sur `main`, les semaines sans Jour actif restant des pauses. Il se rejoue à l'envers en remontant ; sans animation, la section montre directement `main`.
_EN_ : Sort
_Avoid_ : heatmap animée, animation au scroll

## Stack

**Atome** :
Le dessin de la stack dans la section Stack de l'accueil : une Bague par famille autour d'un noyau bleu, une Pastille par technologie qui a un logo. Ce n'est pas une Figure, terme réservé aux machines des fiches.
_EN_ : Atom
_Avoid_ : schéma, illustration, vue éclatée, Figure

**Bague** :
L'anneau d'une famille de la stack dans l'Atome ; celle de Carto & 3D est bleue.
_EN_ : Ring
_Avoid_ : orbite, cercle, anneau

**Pastille** :
Le logo d'une technologie, posé sur la Bague de sa famille, toujours de face.
_EN_ : Chip
_Avoid_ : badge, icône, électron

**Visite** :
Le défilement où la section Stack s'arrête : les Bagues, emboîtées en gyroscope, se déploient en Atome, puis chaque famille s'allume à son tour avec sa ligne de la légende. Elle se rejoue à l'envers en remontant.
_EN_ : Tour
_Avoid_ : animation au scroll, visite guidée, parcours

**Révolution** :
Une fois la Visite finie, la rotation lente et sans fin des Pastilles sur leurs Bagues, chaque Bague dans son sens.
_EN_ : Revolution
_Avoid_ : rotation, spin, orbite

## Langues

**Version** :
Une page dans l'une des deux langues du site ; chaque page a exactement deux versions, liées l'une à l'autre. « Langue » désigne seulement le français ou l'anglais, jamais une page.
_EN_ : Version
_Avoid_ : traduction, locale

## Anatomies

**Anatomie** :
La figure d'un projet et sa nomenclature, ensemble.
_EN_ : Anatomy
_Avoid_ : illustration, schéma

**Machine** :
L'objet physique inventé dont le fonctionnement est celui du projet.
_EN_ : Machine
_Avoid_ : métaphore, objet

**Figure** :
Le dessin isométrique interactif d'une machine, dans sa carte.
_EN_ : Figure
_Avoid_ : illustration, SVG, schéma

**Pièce** :
Élément nommé de la machine, lié à un élément du code ; une machine en a 5 à 8, et vis, pieds ou graduations n'en sont pas.
_EN_ : Part
_Avoid_ : partie, composant

**Pièce maîtresse** :
La seule pièce en bleu : celle qu'il faut regarder en premier.
_EN_ : Key part
_Avoid_ : pièce principale, accent

**Grain** :
La trame de points bleus qui remplit la pièce en bleu ; sur la pièce visée, il naît à un coin et la gagne en entier.
_EN_ : Grain
_Avoid_ : pointillé, texture, trame

**Nomenclature** :
La liste numérotée des pièces d'une machine, chacune avec son rôle et son code.
_EN_ : Parts list
_Avoid_ : légende, liste des pièces

**Note** :
Sur la fiche, autour de la figure, le texte d'une pièce relié à elle par un trait : en clair, ce qu'elle fait sans la machine (un verbe, une phrase, ses technologies) ; en code, son symbole et sa signature.
_EN_ : Note
_Avoid_ : tooltip, étiquette, repère

**Lecture** :
La façon dont toutes les notes se lisent à la fois, en clair ou en code, choisie par la ligne de commande de la carte (`:set lecture=clair|code`).
_EN_ : View (`:set view=plain|code`)
_Avoid_ : mode, vue, onglet

**Viseur** :
Les quatre équerres qui se referment sur la pièce visée, avec l'indice technique de sa note tapé au-dessus.
_EN_ : Viewfinder
_Avoid_ : cadre, sélection, focus

**Signature** :
Les premières lignes de code d'une pièce, hors lignes vides et commentaires, relevées au commit lu.
_EN_ : Signature
_Avoid_ : extrait, snippet

**Règle de temps** :
Sous une figure qui a un temps, la règle graduée qui montre et règle ce temps, avec ses événements et le bouton du tour.
_EN_ : Time ruler
_Avoid_ : slider, timeline, frise

**Aperçu** :
La figure du projet sélectionné, à côté d'une liste de projets : celle de l'accueil, ou celle de la Lunette.
_EN_ : Preview
_Avoid_ : prévisualisation, vignette

**Consigne** :
L'indication de l'interaction possible avec la figure.
_EN_ : Instruction
_Avoid_ : aide, astuce, hint

**Relevé** :
La valeur vivante affichée par la carte, tirée du modèle de la figure.
_EN_ : Reading
_Avoid_ : compteur, readout

**Au repos** :
La pose de départ d'une figure, avant tout mouvement.
_EN_ : At rest
_Avoid_ : état initial, statique

## Lunette

**Lunette** :
La fenêtre de commandes centrée, façon Telescope, qu'ouvre `:` : on y tape ou choisit une commande.
_EN_ : Telescope
_Avoid_ : palette, picker, modale

**Commande** :
Ce qu'on tape ou choisit dans la Lunette (`:e trekker`), avec son argument s'il en faut un.
_EN_ : Command
_Avoid_ : action, raccourci

**Volet** :
La partie droite de la Lunette : l'Aperçu du projet sélectionné, la note de la pièce sélectionnée (`:pieces`), l'aide de la commande, ou ce qu'elle montre une fois lancée (`:checkhealth`, `:version`, `:smile`, `:Lazy`).
_EN_ : Pane
_Avoid_ : preview, panneau

**Portée** :
Les pages où une commande existe (l'accueil, les fiches, les figures à temps). Hors de sa portée, elle n'est pas listée et répond `E492`.
_EN_ : Scope
_Avoid_ : contexte, disponibilité

**Écho** :
Le message qu'affiche la barre d'état à la place du chemin, quelques secondes, après une commande : une information (copie de l'adresse) ou une erreur (`E492`). Les lecteurs d'écran l'annoncent.
_EN_ : Echo
_Avoid_ : toast, notification, message
