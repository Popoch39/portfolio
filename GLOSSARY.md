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
Le picker centré qu'ouvre `:`, façon Telescope : on y tape ou choisit une commande.
_EN_ : Telescope
_Avoid_ : palette, picker, modale

**Commande** :
Ce qu'on tape ou choisit dans la Lunette (`:e trekker`), avec son argument s'il en faut un.
_EN_ : Command
_Avoid_ : action, raccourci

**Volet** :
La partie droite de la Lunette : l'Aperçu du projet sélectionné, ou l'aide de la commande.
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
