# Lunette chargée à la première commande

La Lunette (`:`, Ctrl/Cmd+K, ou un clic sur `:wq` dans la barre d'état) est du JavaScript hors des figures. Elle se greffe sur le module qui existe déjà sur chaque page, l'amorce de l'aperçu à l'accueil et le chargeur sur les fiches : ces deux modules importent statiquement un petit écouteur de touches, partagé, qui joue les séquences du mode normal et tient le showcmd. La Lunette elle-même (sa structure, un `<dialog>` qu'elle construit, sa CSS, portée en chaîne et injectée à l'ouverture, et sa logique) vit dans un morceau séparé que l'écouteur importe à la première ouverture. Le registre des commandes est un module pur, sans DOM, que les tests importent sous Node. Aucune page n'ajoute de `<script>`, de HTML ni de CSS de la Lunette à son premier rendu ; seule la barre d'état gagne ses deux boutons, son showcmd, sa région d'écho, live et vide, et le libellé `COMMAND` de son segment de mode, masqué, que la Lunette ouverte fait basculer à la place de `NORMAL` par un attribut (`data-mode="command"`).

## Considered Options

- **Un script en ligne dans le `<head>`**, comme celui de la transition lettre à lettre : écarté. Un script de plus sur chaque page, répété dans chaque HTML, alors que rien ne presse avant la première touche.
- **Un préchargement en idle** de la Lunette : écarté. Des octets téléchargés par tous les visiteurs, dont la plupart ne taperont jamais `:`.
- **Une Lunette rendue au build** (HTML et CSS dans chaque page, masqués) : écartée. Du HTML et de la CSS sur chaque premier rendu, pour une fenêtre que peu ouvrent.

## Consequences

La règle « scripts limités au JSON-LD et au chargeur » de l'ADR 0001 est révisée : chaque page garde au plus un module, mais ce module importe aussi l'écouteur de la Lunette, et le budget de l'amorce de l'accueil passe de 2 500 à 4 000 octets pour l'accueillir. La Lunette n'est jamais référencée ni préchargée par une page. Les règles CSS ne bougent pas, Lunette comprise : ni `:hover` (le survol d'un résultat est un attribut posé par le script), ni `transition`, ni `@keyframes` hors du kit et de la transition ; la Lunette apparaît et disparaît sans animation.
