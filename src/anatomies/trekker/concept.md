# Concept : trekker — meuble à fiches et gabarit Zod

Fiche de concept de l'anatomie 05 (ticket #19, spec #10). Ni géométrie ni code de figure : elle sert à la revue (#21), puis d'entrée à la construction (#26).

- **Dépôt lu** : [Popoch39/trekker](https://github.com/Popoch39/trekker), branche par défaut `main`.
- **SHA lu** : `0ae7878ca0a422b80644053a50831812fdaf917d` (« perf(treks): index sur l'ordre par defaut de la liste »), identique à la référence de la spec `0ae7878ca0a4`.
- **Base des permaliens** : `https://github.com/Popoch39/trekker/blob/0ae7878ca0a422b80644053a50831812fdaf917d/`
- **Taille du skill** : « Figure », SVG seul, 40 à 80 pièces dessinées (55 prévues ci-dessous).

## Décisions de la revue (#21)

Validé par Louis le 2026-10-25. Les renvois visent la page de revue : ressemblances R1 à R15, incohérences I1 et I2, décisions ouvertes n° 1 à 39 (n° 29 à 33 pour cette fiche).

- **Vue basse (R1).** À azimut 35° et élévation 24°, la caméra était celle de 01 à quelques degrés près. La revue proposait azimut ≈ 22°, élévation ≈ 20°, façade presque pleine ; l'élévation basse est gardée, l'azimut est revu ci-dessous. Le repli « remonter à 26–28° » est abandonné, car il rapprochait encore de 01 : si les fiches du tiroir 1 sont illisibles, on recadre ou on tire le tiroir plus loin. Cela remplace la recommandation de la décision n° 32.
- **Azimut 55–60°, flanc en grande face (arbitrage complémentaire de Louis, 2026-10-25).** À azimut 22°, élévation 20°, la vue retombait sur celle de 02 (18°, 16°), presque de face. 05 passe en 3/4 bas : azimut 55–60°, élévation ≈ 20° conservée. Le flanc droit, qui porte le totalisateur, devient la grande face ; la façade à tiroirs se lit en raccourci et le tiroir tiré sort de biais, vers le bas à gauche.
- **Vue acceptée (arbitrage final de Louis, 2026-10-25).** À azimut 55–60° et élévation 20°, la caméra reste à environ 10 à 15° de celle de 03 (70°, 12°). Louis accepte cet écart : 03 file le long d'une rampe fine, 05 montre un cube massif, et la vue ne change plus.
- **Fente à serrure au lieu du guichet (R8).** 01 et 05 avaient tous deux un « guichet » avec contrôle, goulotte et bac de rejet. 01 perd sa goulotte et son bac ; ici, le bac reste (la 422 recueille la fiche refusée) et le guichet est renommé fente à serrure. Identifiant `guichet` → `fente`.
- **Inertie lourde et petit choc (R12).** L'amortissement critique reste à 03. Le tiroir coulisse avec l'inertie d'un caisson plein et finit sur un petit choc en butée de fin de course, au lieu d'un ressort amorti sans rebond.
- **Format (R13).** Paysage d'environ 1,3 : 1, viewBox de 624 × 480.
- **Plaque d'inventaire retirée (R15).** Plaque muette à trois filets : elle part avec ses vis. Le libellé gravé `/v1/treks`, qui dit la route, reste.
- **Ce qui reste à 05 seul.** Le tiroir (R5 : le cache de 03 devient une capsule vissée), l'éclaté partiel (R2), le bac de rejet (R8), le totalisateur à roues chiffrées, pièce de nomenclature (R11).
- **Décisions n° 29 à 33.** L'option de la fiche est retenue : total de 100 (fixture), dit dans la légende ; tiroir 6 vide inclus dans le tour ; session supposée valide, serrure ouverte ; survol et sélection clavier au ton `hi`, jamais en bleu. La n° 32 suit R1 (ci-dessus).
- **Comptes.** 57 → 55 pièces dessinées ; nomenclature inchangée en nombre, 8 pièces, une seule pièce maîtresse.

## Écarts de la construction (#26)

Ce que le dessin a dû changer par rapport à cette fiche, et pourquoi.

- **Façade à droite, tiroir vers le bas à droite.** Dans le repère du kit, à azimut 55–60°, la grande face (le flanc) est à gauche de l'écran et la façade, en raccourci, à droite : le tiroir tiré sort donc vers le bas à droite. Garder la façade à gauche demandait soit un azimut de 30–35° (celui de 01), soit de retourner le dessin, ce qui inverse la lumière du kit. La caméra validée (azimut 57°, élévation 20°) est gardée.
- **La tige n'est dessinée que par son bouton.** Dans le tiroir, la tige et les trous de tige au pied des fiches sont toujours cachés par la joue du devant (vue à 20°) : ils ne sont pas dessinés, et la tige ne se retire pas à l'écran. Le bouton de tige reste sur chaque façade ; le presse-fiches dépasse des joues pour rester visible.
- **Un filet par onglet.** Les fiches se recouvrent : seul leur onglet dépasse de la fiche de devant. Chaque onglet porte un filet (le nom de l'itinéraire) au lieu de trois filets sur la face ; les fiches montent en escalier (1,8 de plus par rang vers le fond) pour que chaque onglet se lise.
- **Façades en applique.** Les façades recouvrent l'ouverture de 2 et portent contre le cadre, ce qui les tient au caisson sans dessiner les tiroirs fermés.
- **Bac peu profond, sous la corniche.** Le bac de rejet est accroché au flanc sous la corniche, au bout d'une goulotte droite qui passe juste le bord du dessus ; il est peu profond pour que la fiche refusée reste visible au fond.
- **Ajouts.** Une poignée de levage en laiton sur le panneau bas du flanc (une face sans pièce à 4×) ; une patte et un pied de butée pour la broche `pageSize` ; les membres fixes des glissières au fond de chaque ouverture.
- **Le tour alterne les deux refus** des tests d'intégration (`?lat=44.93`, puis `?pageSize=500` au tour suivant), au lieu du seul `?lat=44.93`.
- **Relevé en cours de demande** : `GET ?page=n → …` tant que la fiche passe au gabarit ; le totalisateur se remet à zéro (chaque roue avance jusqu'à son zéro) à chaque nouvelle demande.
- **Tirer à la main** : relâché au-delà de la mi-course, le tiroir finit sa course, puis la fiche de demande passe au gabarit et les fiches montent.

## 1. La machine

Un **meuble à fiches** de bibliothèque, massif, en bois, à six tiroirs, surmonté d'un **gabarit de contrôle** à broches. Une fiche de demande à encoches marginales entre par la fente à serrure du dessus, traverse le gabarit, puis un tiroir sort sur ses glissières et ses vingt fiches se soulèvent.

> **Ce qui bouge = ce que ça signifie.** Le tiroir qui sort, c'est la page demandée : ses vingt fiches sont les lignes que Postgres rend dans l'ordre `name, id`, et il ne sort que si la fiche de demande a d'abord passé le gabarit, le contrat Zod partagé.

### Pourquoi la machine de la grille tient

La grille est retenue telle quelle, parce que le code la raconte presque mot pour mot :

- **Le catalogue est un fichier trié.** La liste est triée par `name` puis `id` ([`treks.service.ts` L146-149](https://github.com/Popoch39/trekker/blob/0ae7878ca0a422b80644053a50831812fdaf917d/apps/api/src/modules/treks/treks.service.ts#L146-L149)), et l'index `treks_name_id_idx` reprend exactement ces colonnes. Un meuble à fiches, c'est cela : un index alphabétique physique.
- **La tige de classement, c'est le départage par `id`.** Dans un vrai meuble à fiches, une tige traverse le trou au pied de chaque fiche pour qu'aucune ne glisse hors de son rang. Le service ajoute `asc(treks.id)` pour la même raison : sans lui, deux « Tour du lac » échangent leur place d'une requête à l'autre, et la pagination par OFFSET rend des doublons en sautant des lignes (commentaire L140-145).
- **Le gabarit, c'est le contrat partagé.** `trekListQuerySchema` vit dans `packages/contracts`, écrit une seule fois pour l'API, le web et le mobile ; l'API n'en dérive que des DTO, « aucun schéma n'est défini ici » ([`treks.dto.ts` L8-14](https://github.com/Popoch39/trekker/blob/0ae7878ca0a422b80644053a50831812fdaf917d/apps/api/src/modules/treks/treks.dto.ts#L8-L14)). Un gabarit d'atelier est aussi un étalon unique, qu'on présente à la pièce avant de la laisser passer.
- **Les refus du contrat sont mécaniques.** Les trois `refine` de la liste (bbox exclusive de la proximité, `lat`/`lon`/`radiusKm` ensemble, `min ≤ max`) se dessinent comme des verrous : une barre qui lie trois broches, un loquet qui en condamne une autre, deux curseurs qui ne peuvent pas se croiser.
- **Seule la requête est contrôlée à l'exécution.** `ZodValidationPipe` est global ([`app.module.ts` L35-37](https://github.com/Popoch39/trekker/blob/0ae7878ca0a422b80644053a50831812fdaf917d/apps/api/src/app.module.ts#L35-L37)), mais aucun intercepteur ne valide la réponse : `TrekListDto` ne sert qu'à Swagger. Le gabarit est donc à l'entrée, sur la fiche de demande, et pas à la sortie des tiroirs.

### Fiche d'identité visuelle

| Axe | Choix | Ce qui la distingue des cinq autres lignes |
|---|---|---|
| Silhouette | Cube massif à tiroirs : un caisson presque aussi profond que haut, deux colonnes de trois tiroirs, posé sur une plinthe pleine en retrait. Le gabarit se dresse sur le dessus comme un cadre étroit, sans dépasser un quart de la hauteur. | Ni large et basse (01), ni murale et plate (02), ni longue et fine (03), ni grêle sur trépied (04), ni colonne (06). C'est la seule masse compacte. |
| Vue | 3/4 bas : élévation d'environ 20° (sous le défaut de 30° du skill, pour donner du poids au meuble), azimut de 55 à 60° (R1, puis arbitrage complémentaire). Le flanc droit, qui porte le totalisateur, est la grande face ; la façade à tiroirs se lit en raccourci sur la gauche, et le tiroir tiré en sort de biais, vers le bas à gauche. Si les fiches du tiroir 1 deviennent illisibles par-dessus les joues, on recadre ou on tire le tiroir plus loin ; on ne remonte pas l'élévation. | Ni 3/4 classique (01 : 35°, 30°, plus haut et côté long), ni presque de face (02), ni rasante (03 : 12°, le long d'une rampe), ni plongée (04), ni 3/4 haut (06). C'est la seule vue qui donne la grande face au flanc. |
| Cadrage et format | Paysage, environ 1,3 : 1 (viewBox de 624 × 480, R13) : le flanc au totalisateur au centre, le tiroir tiré qui déborde vers le bas à gauche et le gabarit au-dessus. | Seul format paysage modéré : 06 et 02 sont en portrait, 04 carré, 01 et 03 panoramiques. |
| Mode de dessin | Éclaté partiel : un seul tiroir sort sur ses glissières télescopiques, et ses vingt fiches se soulèvent en bloc de quelques unités au-dessus du tiroir, la tige retirée. La fiche de demande est vue en cours de passage dans le gabarit. Le reste du meuble est fermé. | Ni porte ouverte (01), ni capot déposé (02), ni fenêtre (03), ni extérieur pur (04), ni écorché (06). |
| Caractère du mouvement | Lourd puis sec : le tiroir coulisse avec l'inertie d'un caisson de bois plein et finit sur un petit choc en butée de fin de course (R12), les broches du gabarit claquent par petits à-coups, les fiches montent ensemble, lentement, et les roues du totalisateur roulent pendant que le tiroir sort. | Ni frappes (01), ni volets qui tombent (02), ni aiguille amortie (03), ni élan de moteur (04), ni avance à vitesse constante (06). |
| Geste | Tirer un tiroir vers soi par sa poignée. | Seul geste de traction. |

**Pas de base sur pieds avec règle graduée** : le meuble pose sur une plinthe pleine, sans pied ni graduation. Les seuls chiffres du dessin sont ceux des roues du totalisateur.

## 2. Les pièces dessinées

55 pièces, groupées comme le demande la spec : socle 3, structure 16, mécanisme 25, commandes 6, sujet 5. Les tons suivent le skill : socle `lo`, structure `mid`, sujet `hi`, et une seule pièce en bleu au repos, le gabarit.

### Socle (3)

1. Plinthe pleine en retrait, sur les deux faces visibles (pas de pieds).
2. Moulure en quart-de-rond entre la plinthe et le caisson.
3. Sabots d'angle en laiton sur les arêtes de la plinthe.

### Structure (16)

4. Flanc droit du caisson, avec son chant : panneau à cadre et plate-bande, grande face de la vue, qui porte la platine du totalisateur.
5. Panneau de dessus, chant biseauté.
6. Corniche moulurée qui coiffe le dessus.
7. Montant gauche de façade.
8. Montant central de façade.
9. Montant droit de façade.
10. Quatre traverses de façade entre les rangées.
11. Rainure d'assemblage entre le flanc et la façade, d'une arête à l'autre.
12. Cornières d'angle en laiton sur le dessus.
13. Ouverture du tiroir tiré : parois intérieures et faux-fond sombre.
14. Platine du totalisateur, vissée sur le flanc.
15. Platine d'acier du gabarit, vissée sur le dessus.
16. Deux montants du cadre du gabarit.
17. Traverse haute du gabarit.
18. Goulotte de rejet inclinée, du gabarit vers le bord droit du dessus.
19. Deux pattes de la goulotte.

### Mécanisme (25)

20. Six façades de tiroir, avec leur chant.
21. Caisson du tiroir tiré : fond, deux joues et arrière.
22. Queues d'aronde sur les joues du tiroir tiré.
23. Deux glissières télescopiques (membre fixe dans le caisson, membre mobile sous le tiroir).
24. Cages à billes des glissières, une rangée visible par glissière.
25. Butées de fin de course des glissières, à tampon : le tiroir y vient buter d'un petit choc.
26. Tige de classement en laiton, qui traverse le pied des fiches.
27. Presse-fiches : bloc en V qui serre les fiches contre l'avant, avec son patin.
28. Cloison entre le compartiment des fiches et celui des tracés.
29. Feuillets de tracé pliés, dans le compartiment arrière : ils restent au fond pendant que les fiches montent.
30. Fente à serrure : boîtier à fente posé sur le dessus, sous le gabarit.
31. Lèvres chanfreinées de la fente.
32. Clapet de sortie du gabarit, sur charnière.
33. Ressort de rappel du clapet.
34. Aiguillage du clapet vers la goulotte de rejet.
35. Broche `page` (entier ≥ 1).
36. Broche `pageSize`, avec sa butée à 100.
37. Peigne `difficulty` à quatre dents (`facile`, `moyen`, `difficile`, `tres_difficile`).
38. Paire de curseurs `minDistanceMeters` / `maxDistanceMeters` sur une même glissière, qui ne peuvent pas se croiser.
39. Verrou triple : une barre commune aux broches `lat`, `lon` et `radiusKm`, qui ne passe que si les trois sont là, ou aucune.
40. Loquet `bbox`, qui condamne le verrou triple quand il est engagé.
41. Sélecteur `matchOn` à deux crans, `start` par défaut.
42. Boîtier du totalisateur, avec deux fenêtres : trois roues chiffrées pour le total, une roue pour le nombre de pages.
43. Arbre et pignon qui relient la fente au totalisateur (le comptage part en même temps que la lecture).
44. Bac de rejet en tôle pliée, à rebord, au bout de la goulotte.

### Commandes (6)

45. Six poignées en coquille, en laiton : le geste.
46. Six boutons de tige sous les poignées.
47. Six porte-étiquettes, chacun avec sa carte à trois filets.
48. Rivets des porte-étiquettes.
49. Serrure à cylindre sur la fente : la session exigée par l'`AuthGuard` global.
50. Quatre vis de réglage moletées aux coins de la platine du gabarit, et le bouton moleté du sélecteur `matchOn`.

### Sujet (5)

51. Fiche de demande à encoches marginales : une rangée de trous en bordure, encochés pour chaque paramètre présent.
52. Vingt fiches résumé, onglets décalés par tiers comme dans un vrai fichier.
53. Trou de tige au pied de chaque fiche.
54. Trois filets « imprimés » par fiche (marqués `free`, ils figurent du texte).
55. Fiche-guide à onglet haut, en tête du tiroir tiré.

Le seul libellé gravé du dessin est `/v1/treks`, sur la face avant du boîtier de la fente : il dit la route (R15). La plaque d'inventaire, muette, est retirée.

## 3. Nomenclature

Huit pièces, de l'entrée de la requête jusqu'à Postgres. Une seule pièce maîtresse : le gabarit.

| # | Pièce | Rôle dans la machine | Élément du code (au SHA lu) |
|---|---|---|---|
| 1 | Fente à serrure | Reçoit la fiche de demande ; la serrure exige une session. | Contrôleur `TreksController.list` et sa note sur l'`AuthGuard` global : [`apps/api/src/modules/treks/treks.controller.ts` L8-24](https://github.com/Popoch39/trekker/blob/0ae7878ca0a422b80644053a50831812fdaf917d/apps/api/src/modules/treks/treks.controller.ts#L8-L24) |
| 2 | **Gabarit à broches** (pièce maîtresse) | Vérifie chaque champ de la fiche de demande et ses verrous avant de la laisser passer. | `trekListQuerySchema`, contrat Zod partagé : [`packages/contracts/src/treks.ts` L126-185](https://github.com/Popoch39/trekker/blob/0ae7878ca0a422b80644053a50831812fdaf917d/packages/contracts/src/treks.ts#L126-L185) |
| 3 | Bac de rejet | Recueille la fiche refusée, avec le détail des champs fautifs. | Branche `ZodValidationException` du `ProblemDetailsFilter`, réponse 422 en RFC 9457 : [`apps/api/src/common/filters/problem-details.filter.ts` L52-61](https://github.com/Popoch39/trekker/blob/0ae7878ca0a422b80644053a50831812fdaf917d/apps/api/src/common/filters/problem-details.filter.ts#L52-L61) |
| 4 | Tige et presse-fiches | Tient les fiches dans l'ordre `name, id` ; le presse-fiches en isole vingt, après celles des tiroirs précédents. | Requête Drizzle de `findMany` : `where`, `limit`/`offset`, `orderBy(name, id)` : [`apps/api/src/modules/treks/treks.service.ts` L127-151](https://github.com/Popoch39/trekker/blob/0ae7878ca0a422b80644053a50831812fdaf917d/apps/api/src/modules/treks/treks.service.ts#L127-L151) |
| 5 | Totalisateur | Compte toutes les fiches qui répondent, pendant que le tiroir sort, et en déduit le nombre de pages. | `$count` en parallèle et `buildPaginationMeta` : [`apps/api/src/modules/treks/treks.service.ts` L152-160](https://github.com/Popoch39/trekker/blob/0ae7878ca0a422b80644053a50831812fdaf917d/apps/api/src/modules/treks/treks.service.ts#L152-L160) |
| 6 | Fiche résumé | Ce qui sort du tiroir : la fiche sans son tracé, qui reste au fond. | `trekSummarySchema`, forme résumée « sans la trace » : [`packages/contracts/src/treks.ts` L49-74](https://github.com/Popoch39/trekker/blob/0ae7878ca0a422b80644053a50831812fdaf917d/packages/contracts/src/treks.ts#L49-L74) |
| 7 | Glissières à billes | Font sortir le tiroir sans qu'on trie le meuble. | Index `treks_name_id_idx` sur `(name, id)` : [`packages/db/src/schema/treks.ts` L142-148](https://github.com/Popoch39/trekker/blob/0ae7878ca0a422b80644053a50831812fdaf917d/packages/db/src/schema/treks.ts#L142-L148) |
| 8 | Corps à tiroirs | Le meuble lui-même : chaque fiche y est rangée une fois. | Table Postgres `treks` (Drizzle `pgTable`) : [`packages/db/src/schema/treks.ts` L57-91](https://github.com/Popoch39/trekker/blob/0ae7878ca0a422b80644053a50831812fdaf917d/packages/db/src/schema/treks.ts#L57-L91) |

Identifiants de pièce proposés pour les crochets du SVG : `fente`, `gabarit`, `bac-rejet`, `tige`, `totalisateur`, `fiche-resume`, `glissieres`, `corps`.

## 4. Scénario d'interaction

### Correspondance tiroirs ↔ pages

Les six tiroirs se lisent comme un texte : 1 et 2 sur la rangée du haut, 3 et 4 au milieu, 5 et 6 en bas. Le tiroir *n* est la page *n* de la liste par défaut (`pageSize` absent, donc 20), sur les 100 itinéraires de la fixture livrée avec le dépôt :

- les tiroirs 1 à 5 tiennent chacun 20 fiches, soit les noms 1 à 20, 21 à 40, etc. dans l'ordre `name, id` : les tiroirs sont donc aussi des tranches alphabétiques, comme dans un vrai fichier ;
- le tiroir 6 est vide. Il est vrai que l'API l'accepte : `page` n'a pas de borne haute, l'offset vaut 100 et la réponse est `200` avec `data: []` et `totalPages: 5`.

### Le flux rejoué

Chaque traction rejoue `GET /api/v1/treks?page=n` :

1. **Fente à serrure** : la fiche de demande tombe dans la fente. La serrure est déjà ouverte : la figure suppose une session valide (sans elle, la route rend 401, [`test/treks.spec.ts` L88-92](https://github.com/Popoch39/trekker/blob/0ae7878ca0a422b80644053a50831812fdaf917d/apps/api/test/treks.spec.ts#L88-L92)).
2. **Gabarit** : la fiche descend entre les broches. Ses encoches sont lues comme des nombres (`z.coerce`), la broche `pageSize` absente se règle d'elle-même sur 20 et le sélecteur `matchOn` reste sur `start`. Les broches claquent une à une, le clapet s'ouvre vers la fente.
3. **Totalisateur et tiroir en même temps** (`Promise.all`) : le pignon fait rouler les roues jusqu'à 100 et 5, pendant que le tiroir *n* sort sur ses glissières. Les tiroirs qui le précèdent restent fermés : ce sont les `(n − 1) × 20` fiches sautées par l'offset.
4. **Fiches** : la tige se retire de quelques unités, le presse-fiches marque la vingtième, et les vingt fiches montent en bloc au-dessus du tiroir. Les feuillets de tracé restent au fond, derrière la cloison : la liste ne sert jamais la trace.
5. **Relevé** : `GET ?page=n → 200 · 20 fiches · p. n/5 · total 100`.

Une fiche refusée rejoue un vrai cas des tests d'intégration :

- `GET ?lat=44.93` : la barre du verrou triple bute, car `lon` et `radiusKm` manquent. Le clapet bascule vers la goulotte, la fiche glisse dans le bac de rejet, aucun tiroir ne bouge. Relevé : `GET ?lat=44.93 → 422 · lat, lon et radiusKm ensemble` ([`test/treks.spec.ts` L291-299](https://github.com/Popoch39/trekker/blob/0ae7878ca0a422b80644053a50831812fdaf917d/apps/api/test/treks.spec.ts#L291-L299)).
- `GET ?pageSize=500` : la broche `pageSize` bute à 100. Relevé : `GET ?pageSize=500 → 422 · pageSize ≤ 100` ([`test/treks.spec.ts` L328-330](https://github.com/Popoch39/trekker/blob/0ae7878ca0a422b80644053a50831812fdaf917d/apps/api/test/treks.spec.ts#L328-L330)).

### Pointeur

- Survoler un tiroir éclaircit sa poignée (ton `hi`, jamais bleu : le bleu reste réservé à la pièce maîtresse et à la pièce visée depuis la nomenclature).
- Saisir la poignée et tirer vers soi, le long de l'axe du tiroir : le tiroir suit la main avec l'inertie d'un caisson plein, démarre lourdement et finit sa course sur un petit choc en butée. Au-delà de la moitié de la course, la demande part (fiche de demande, gabarit, fiches qui montent). Relâché avant, il rentre sans requête.
- Un clic sur une poignée tire le tiroir en entier. Tirer un autre tiroir repousse le précédent avant.

### Toucher

- Faire glisser un tiroir vers soi fait la même chose qu'au pointeur ; un toucher bref le tire en entier.
- La zone de saisie couvre toute la façade du tiroir, pas seulement la poignée, pour rester utilisable à 390 px.

### Clavier

- La scène prend le focus (aucun écouteur global). Les flèches déplacent la sélection d'un tiroir à l'autre dans la grille 2 × 3, la poignée sélectionnée s'éclaircit.
- Entrée ou Espace tire le tiroir sélectionné. Échap le repousse. Tab sort de la scène normalement.

### Tour au repos

Quand personne n'y touche : tiroirs 1, 2, 3, 4 et 5 tirés l'un après l'autre, puis le 6 (vide, `p. 6/5 · 0 fiche`), puis une fiche `?lat=44.93` refusée au bac de rejet, et la boucle reprend. Le tour s'arrête au premier contact et reprend après quelques secondes d'immobilité.

### Au repos et mouvement réduit

- **Au repos** (SVG statique, aperçu sans JavaScript, image de partage) : tiroir 1 sorti, ses vingt fiches levées, la fiche de demande engagée dans le gabarit, totalisateur sur 100 et 5.
- **Mouvement réduit** : cette même pose, immobile. Les tractions sont instantanées : le tiroir est dehors ou dedans, sans coulisse ni montée des fiches.

## 5. Les vrais chiffres

| Chiffre affiché | Valeur | Source au SHA lu |
|---|---|---|
| Fiches par tiroir | 20 (`DEFAULT_PAGE_SIZE`) | [`packages/contracts/src/pagination.ts` L3](https://github.com/Popoch39/trekker/blob/0ae7878ca0a422b80644053a50831812fdaf917d/packages/contracts/src/pagination.ts#L3) |
| Butée de la broche `pageSize` | 100 (`MAX_PAGE_SIZE`) | [`packages/contracts/src/pagination.ts` L4-17](https://github.com/Popoch39/trekker/blob/0ae7878ca0a422b80644053a50831812fdaf917d/packages/contracts/src/pagination.ts#L4-L17) |
| Première page | `page` ≥ 1, défaut 1, sans borne haute | [`packages/contracts/src/pagination.ts` L11](https://github.com/Popoch39/trekker/blob/0ae7878ca0a422b80644053a50831812fdaf917d/packages/contracts/src/pagination.ts#L11) |
| Total du totalisateur | 100 itinéraires, 25 par instance de la liste blanche | [`apps/api/src/data/README.md` L9-11](https://github.com/Popoch39/trekker/blob/0ae7878ca0a422b80644053a50831812fdaf917d/apps/api/src/data/README.md#L9-L11), et les 100 entrées de `apps/api/src/data/treks.fixture.json` |
| Instances de la liste blanche | 4 (Écrins, Chemins des parcs, Alpes-de-Haute-Provence, Cévennes) | [`apps/api/src/modules/treks/geotrek/geotrek.instances.ts` L43-84](https://github.com/Popoch39/trekker/blob/0ae7878ca0a422b80644053a50831812fdaf917d/apps/api/src/modules/treks/geotrek/geotrek.instances.ts#L43-L84) |
| Pages | 5 = ⌈100 / 20⌉ | [`packages/contracts/src/pagination.ts` L52](https://github.com/Popoch39/trekker/blob/0ae7878ca0a422b80644053a50831812fdaf917d/packages/contracts/src/pagination.ts#L52) |
| Fiches sautées pour le tiroir *n* | (n − 1) × 20 | [`packages/contracts/src/pagination.ts` L57-65](https://github.com/Popoch39/trekker/blob/0ae7878ca0a422b80644053a50831812fdaf917d/packages/contracts/src/pagination.ts#L57-L65) |
| Tiroir 6 | 0 fiche, `p. 6/5` | déduit des deux lignes précédentes : offset 100 pour un total de 100 |
| Dents du peigne `difficulty` | 4 valeurs | [`packages/contracts/src/treks.ts` L34-39](https://github.com/Popoch39/trekker/blob/0ae7878ca0a422b80644053a50831812fdaf917d/packages/contracts/src/treks.ts#L34-L39) |
| Butées des broches de proximité | `lat` ±90, `lon` ±180, `radiusKm` > 0 et ≤ 500 | [`packages/contracts/src/treks.ts` L142-146](https://github.com/Popoch39/trekker/blob/0ae7878ca0a422b80644053a50831812fdaf917d/packages/contracts/src/treks.ts#L142-L146) |
| Verrous du gabarit | 3 `refine` : bbox ⟂ proximité, `lat`/`lon`/`radiusKm` ensemble, min ≤ max | [`packages/contracts/src/treks.ts` L150-185](https://github.com/Popoch39/trekker/blob/0ae7878ca0a422b80644053a50831812fdaf917d/packages/contracts/src/treks.ts#L150-L185) |
| Code d'une fiche refusée | 422, `application/problem+json` | [`apps/api/src/common/filters/problem-details.filter.ts` L52-61](https://github.com/Popoch39/trekker/blob/0ae7878ca0a422b80644053a50831812fdaf917d/apps/api/src/common/filters/problem-details.filter.ts#L52-L61) |
| Route de la fente (libellé gravé) | `/api/v1/treks` | préfixe et version : [`apps/api/src/configure-app.ts` L9-41](https://github.com/Popoch39/trekker/blob/0ae7878ca0a422b80644053a50831812fdaf917d/apps/api/src/configure-app.ts#L9-L41) ; route : [`treks.controller.ts` L16](https://github.com/Popoch39/trekker/blob/0ae7878ca0a422b80644053a50831812fdaf917d/apps/api/src/modules/treks/treks.controller.ts#L16) |
| Gain des glissières (légende) | 130 ms sans l'index, 0,9 ms avec, mesuré sur 2 442 treks | [`packages/db/src/schema/treks.ts` L142-148](https://github.com/Popoch39/trekker/blob/0ae7878ca0a422b80644053a50831812fdaf917d/packages/db/src/schema/treks.ts#L142-L148) |

Le relevé ne montre que des chiffres de ce tableau. Le total de 100 est celui de la fixture qu'insère `pnpm seed` sans argument, pas celui du jeu complet importé : la légende le dit.

## 6. Textes de la fiche

- **Accroche** : Une API de randonnées où chaque requête passe d'abord au *gabarit* du contrat partagé. (mot en emphase : « gabarit »)
- **Nom de la machine** : Meuble à fiches et gabarit Zod
- **Titre de la figure** : Meuble à fiches et gabarit Zod
- **Consigne au pointeur** : Tirez une poignée pour demander sa page
- **Consigne au toucher** : Faites glisser un tiroir vers vous pour demander sa page
- **Format du relevé** :
  - page servie : `GET ?page={n} → 200 · {k} fiches · p. {n}/{pages} · total {total}` (« 0 fiche » et « 1 fiche » au singulier) ;
  - fiche refusée : `GET ?{requête} → 422 · {règle}`.
- **Relevé au repos** : `GET ?page=1 → 200 · 20 fiches · p. 1/5 · total 100`
- **Légende** : Chaque tiroir est une page de 20 itinéraires sur les 100 de la fixture livrée. La fiche de demande passe d'abord au gabarit, `trekListQuerySchema`, le contrat Zod que partagent l'API, le web et le mobile : une proximité incomplète ou une page de plus de 100 fiches finit au bac de rejet, en 422. Les fiches tiennent sur la tige dans l'ordre `name, id`, que suit l'index `treks_name_id_idx` (0,9 ms au lieu de 130 sur 2 442 treks), et sortent sans leur tracé.
- **Libellé accessible** : Meuble à fiches en bois à six tiroirs, vu de trois quarts depuis le bas. Sur le dessus, une fiche de demande traverse un gabarit à broches avant d'entrer dans une fente à serrure ; un tiroir sort sur ses glissières, ses vingt fiches se soulèvent et laissent leur tracé au fond, pendant qu'un totalisateur sur le flanc affiche 100 fiches en 5 pages.
- **Titre SEO** : trekker — anatomie d'une API de randonnées NestJS, Zod et Drizzle
- **Description SEO** : Un meuble à fiches explique trekker : chaque requête passe au gabarit Zod partagé, puis NestJS et Drizzle sortent de Postgres 20 itinéraires par page.

## 7. Notes pour la construction (#26)

- **Monde** : environ 1 unité par millimètre. Caisson d'environ 340 de large, 400 de profondeur et 380 de haut, plinthe comprise ; façades de tiroir d'environ 150 × 105 ; course du tiroir tiré d'environ 260. Les fiches font environ 125 × 75, comme une fiche de bibliothèque, et dépassent des joues du tiroir pour rester lisibles malgré la vue basse.
- **Ordre de peinture** : le tiroir tiré, quelle que soit sa rangée, passe devant les tiroirs fermés ; il est peint après la façade, dans son ouverture, avec ses glissières derrière ses joues. Les fiches levées sont peintes après le tiroir. La fiche de demande traverse le cadre du gabarit : montant arrière, fiche, broches, montant avant. Le tiroir 1 (en haut) est celui du repos : à 20° d'élévation et vues à 55–60° de leur face, ses fiches se lisent en raccourci et doivent rester lisibles par-dessus les joues, onglets décalés bien distincts ; si ce n'est pas le cas, recadrer ou tirer le tiroir plus loin, sans remonter l'élévation ni changer de tiroir au repos (R1).
- **Butée** : le petit choc de fin de course est un vrai ressort raide sur les tampons des butées, bref et sans oscillation visible ; ni amortissement critique (03) ni rebond.
- **Pas de tube ni de câble** prévu : l'arbre du totalisateur est une tige droite, à vérifier avec `lines.mjs` ; l'audit du kit n'est requis que si des pièces de révolution s'ajoutent (poignées en coquille, boutons de tige).
- **Une seule pièce bleue** : le gabarit au repos. Le survol des poignées et la sélection clavier passent par le ton `hi`.
