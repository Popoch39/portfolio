# Concept : trekker — meuble à fiches et gabarit Zod

Fiche de concept de l'anatomie 05 (ticket #19, spec #10). Ni géométrie ni code de figure : elle sert à la revue (#21), puis d'entrée à la construction (#26).

- **Dépôt lu** : [Popoch39/trekker](https://github.com/Popoch39/trekker), branche par défaut `main`.
- **SHA lu** : `0ae7878ca0a422b80644053a50831812fdaf917d` (« perf(treks): index sur l'ordre par defaut de la liste »), identique à la référence de la spec `0ae7878ca0a4`.
- **Base des permaliens** : `https://github.com/Popoch39/trekker/blob/0ae7878ca0a422b80644053a50831812fdaf917d/`
- **Taille du skill** : « Figure », SVG seul, 40 à 80 pièces dessinées (environ 57 prévues ci-dessous).

## 1. La machine

Un **meuble à fiches** de bibliothèque, massif, en bois, à six tiroirs, surmonté d'un **gabarit de contrôle** à broches. Une fiche de demande à encoches marginales entre par le guichet du dessus, traverse le gabarit, puis un tiroir sort sur ses glissières et ses vingt fiches se soulèvent.

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
| Vue | 3/4 bas : élévation 24° (plus basse que le défaut de 30° du skill, pour donner du poids au meuble), azimut d'environ 35° pour que la façade à tiroirs occupe à peu près les deux tiers de la largeur et que le flanc droit, qui porte le totalisateur, en occupe un tiers. Le tiroir tiré pointe vers le lecteur. | Ni 3/4 classique (01), ni presque de face (02), ni rasante (03), ni plongée (04), ni coupe (06). |
| Cadrage et format | Presque carré, environ 600 × 520 : le cube, son tiroir tiré vers le bas à gauche et le gabarit au-dessus. | Les autres formats sont larges, hauts ou longs. |
| Mode de dessin | Éclaté partiel : un seul tiroir sort sur ses glissières télescopiques, et ses vingt fiches se soulèvent en bloc de quelques unités au-dessus du tiroir, la tige retirée. La fiche de demande est vue en cours de passage dans le gabarit. Le reste du meuble est fermé. | Pas « en fonctionnement » (01), pas d'annonciateur (02), pas d'instrument (03), pas de balayage (04), pas d'écorché (06). |
| Caractère du mouvement | Lourd puis sec : le tiroir coulisse avec l'inertie d'un caisson de bois plein (ressort amorti, sans rebond), les broches du gabarit claquent par petits à-coups, les fiches montent ensemble, lentement, et les roues du totalisateur roulent pendant que le tiroir sort. | Ni frappes (01), ni volets qui tombent (02), ni aiguille amortie (03), ni balayage continu (04), ni descente (06). |
| Geste | Tirer un tiroir vers soi par sa poignée. | Seul geste de traction. |

**Pas de base sur pieds avec règle graduée** : le meuble pose sur une plinthe pleine, sans pied ni graduation. Les seuls chiffres du dessin sont ceux des roues du totalisateur.

## 2. Les pièces dessinées

Environ 57 pièces, groupées comme le demande la spec. Les tons suivent le skill : socle `lo`, structure `mid`, sujet `hi`, et une seule pièce en bleu au repos, le gabarit.

### Socle (5)

1. Plinthe pleine en retrait, sur les deux faces visibles (pas de pieds).
2. Moulure en quart-de-rond entre la plinthe et le caisson.
3. Sabots d'angle en laiton sur les arêtes de la plinthe.
4. Plaque d'inventaire en laiton sur la plinthe, avec trois filets gravés.
5. Vis de la plaque d'inventaire (points de 0,45).

### Structure (16)

6. Flanc droit du caisson, avec son chant.
7. Panneau de dessus, chant biseauté.
8. Corniche moulurée qui coiffe le dessus.
9. Montant gauche de façade.
10. Montant central de façade.
11. Montant droit de façade.
12. Quatre traverses de façade entre les rangées.
13. Rainure d'assemblage entre le flanc et la façade, d'une arête à l'autre.
14. Cornières d'angle en laiton sur le dessus.
15. Ouverture du tiroir tiré : parois intérieures et faux-fond sombre.
16. Platine du totalisateur, vissée sur le flanc.
17. Platine d'acier du gabarit, vissée sur le dessus.
18. Deux montants du cadre du gabarit.
19. Traverse haute du gabarit.
20. Goulotte de rejet inclinée, du gabarit vers le bord droit du dessus.
21. Deux pattes de la goulotte.

### Mécanisme (25)

22. Six façades de tiroir, avec leur chant.
23. Caisson du tiroir tiré : fond, deux joues et arrière.
24. Queues d'aronde sur les joues du tiroir tiré.
25. Deux glissières télescopiques (membre fixe dans le caisson, membre mobile sous le tiroir).
26. Cages à billes des glissières, une rangée visible par glissière.
27. Butées de fin de course des glissières.
28. Tige de classement en laiton, qui traverse le pied des fiches.
29. Presse-fiches : bloc en V qui serre les fiches contre l'avant, avec son patin.
30. Cloison entre le compartiment des fiches et celui des tracés.
31. Feuillets de tracé pliés, dans le compartiment arrière : ils restent au fond pendant que les fiches montent.
32. Guichet : boîtier à fente posé sur le dessus, sous le gabarit.
33. Lèvres chanfreinées de la fente.
34. Clapet de sortie du gabarit, sur charnière.
35. Ressort de rappel du clapet.
36. Aiguillage du clapet vers la goulotte de rejet.
37. Broche `page` (entier ≥ 1).
38. Broche `pageSize`, avec sa butée à 100.
39. Peigne `difficulty` à quatre dents (`facile`, `moyen`, `difficile`, `tres_difficile`).
40. Paire de curseurs `minDistanceMeters` / `maxDistanceMeters` sur une même glissière, qui ne peuvent pas se croiser.
41. Verrou triple : une barre commune aux broches `lat`, `lon` et `radiusKm`, qui ne passe que si les trois sont là, ou aucune.
42. Loquet `bbox`, qui condamne le verrou triple quand il est engagé.
43. Sélecteur `matchOn` à deux crans, `start` par défaut.
44. Boîtier du totalisateur, avec deux fenêtres : trois roues chiffrées pour le total, une roue pour le nombre de pages.
45. Arbre et pignon qui relient le guichet au totalisateur (le comptage part en même temps que la lecture).
46. Bac de rejet en tôle pliée, à rebord, au bout de la goulotte.

### Commandes (6)

47. Six poignées en coquille, en laiton : le geste.
48. Six boutons de tige sous les poignées.
49. Six porte-étiquettes, chacun avec sa carte à trois filets.
50. Rivets des porte-étiquettes.
51. Serrure à cylindre sur le guichet : la session exigée par l'`AuthGuard` global.
52. Quatre vis de réglage moletées aux coins de la platine du gabarit, et le bouton moleté du sélecteur `matchOn`.

### Sujet (5)

53. Fiche de demande à encoches marginales : une rangée de trous en bordure, encochés pour chaque paramètre présent.
54. Vingt fiches résumé, onglets décalés par tiers comme dans un vrai fichier.
55. Trou de tige au pied de chaque fiche.
56. Trois filets « imprimés » par fiche (marqués `free`, ils figurent du texte).
57. Fiche-guide à onglet haut, en tête du tiroir tiré.

Le seul libellé gravé du dessin est `/v1/treks`, sur la face avant du guichet.

## 3. Nomenclature

Huit pièces, de l'entrée de la requête jusqu'à Postgres. Une seule pièce maîtresse : le gabarit.

| # | Pièce | Rôle dans la machine | Élément du code (au SHA lu) |
|---|---|---|---|
| 1 | Guichet à serrure | Reçoit la fiche de demande ; la serrure exige une session. | Contrôleur `TreksController.list` et sa note sur l'`AuthGuard` global : [`apps/api/src/modules/treks/treks.controller.ts` L8-24](https://github.com/Popoch39/trekker/blob/0ae7878ca0a422b80644053a50831812fdaf917d/apps/api/src/modules/treks/treks.controller.ts#L8-L24) |
| 2 | **Gabarit à broches** (pièce maîtresse) | Vérifie chaque champ de la fiche de demande et ses verrous avant de la laisser passer. | `trekListQuerySchema`, contrat Zod partagé : [`packages/contracts/src/treks.ts` L126-185](https://github.com/Popoch39/trekker/blob/0ae7878ca0a422b80644053a50831812fdaf917d/packages/contracts/src/treks.ts#L126-L185) |
| 3 | Bac de rejet | Recueille la fiche refusée, avec le détail des champs fautifs. | Branche `ZodValidationException` du `ProblemDetailsFilter`, réponse 422 en RFC 9457 : [`apps/api/src/common/filters/problem-details.filter.ts` L52-61](https://github.com/Popoch39/trekker/blob/0ae7878ca0a422b80644053a50831812fdaf917d/apps/api/src/common/filters/problem-details.filter.ts#L52-L61) |
| 4 | Tige et presse-fiches | Tient les fiches dans l'ordre `name, id` ; le presse-fiches en isole vingt, après celles des tiroirs précédents. | Requête Drizzle de `findMany` : `where`, `limit`/`offset`, `orderBy(name, id)` : [`apps/api/src/modules/treks/treks.service.ts` L127-151](https://github.com/Popoch39/trekker/blob/0ae7878ca0a422b80644053a50831812fdaf917d/apps/api/src/modules/treks/treks.service.ts#L127-L151) |
| 5 | Totalisateur | Compte toutes les fiches qui répondent, pendant que le tiroir sort, et en déduit le nombre de pages. | `$count` en parallèle et `buildPaginationMeta` : [`apps/api/src/modules/treks/treks.service.ts` L152-160](https://github.com/Popoch39/trekker/blob/0ae7878ca0a422b80644053a50831812fdaf917d/apps/api/src/modules/treks/treks.service.ts#L152-L160) |
| 6 | Fiche résumé | Ce qui sort du tiroir : la fiche sans son tracé, qui reste au fond. | `trekSummarySchema`, forme résumée « sans la trace » : [`packages/contracts/src/treks.ts` L49-74](https://github.com/Popoch39/trekker/blob/0ae7878ca0a422b80644053a50831812fdaf917d/packages/contracts/src/treks.ts#L49-L74) |
| 7 | Glissières à billes | Font sortir le tiroir sans qu'on trie le meuble. | Index `treks_name_id_idx` sur `(name, id)` : [`packages/db/src/schema/treks.ts` L142-148](https://github.com/Popoch39/trekker/blob/0ae7878ca0a422b80644053a50831812fdaf917d/packages/db/src/schema/treks.ts#L142-L148) |
| 8 | Corps à tiroirs | Le meuble lui-même : chaque fiche y est rangée une fois. | Table Postgres `treks` (Drizzle `pgTable`) : [`packages/db/src/schema/treks.ts` L57-91](https://github.com/Popoch39/trekker/blob/0ae7878ca0a422b80644053a50831812fdaf917d/packages/db/src/schema/treks.ts#L57-L91) |

Identifiants de pièce proposés pour les crochets du SVG : `guichet`, `gabarit`, `bac-rejet`, `tige`, `totalisateur`, `fiche-resume`, `glissieres`, `corps`.

## 4. Scénario d'interaction

### Correspondance tiroirs ↔ pages

Les six tiroirs se lisent comme un texte : 1 et 2 sur la rangée du haut, 3 et 4 au milieu, 5 et 6 en bas. Le tiroir *n* est la page *n* de la liste par défaut (`pageSize` absent, donc 20), sur les 100 itinéraires de la fixture livrée avec le dépôt :

- les tiroirs 1 à 5 tiennent chacun 20 fiches, soit les noms 1 à 20, 21 à 40, etc. dans l'ordre `name, id` : les tiroirs sont donc aussi des tranches alphabétiques, comme dans un vrai fichier ;
- le tiroir 6 est vide. Il est vrai que l'API l'accepte : `page` n'a pas de borne haute, l'offset vaut 100 et la réponse est `200` avec `data: []` et `totalPages: 5`.

### Le flux rejoué

Chaque traction rejoue `GET /api/v1/treks?page=n` :

1. **Guichet** : la fiche de demande tombe dans la fente. La serrure est déjà ouverte : la figure suppose une session valide (sans elle, la route rend 401, [`test/treks.spec.ts` L88-92](https://github.com/Popoch39/trekker/blob/0ae7878ca0a422b80644053a50831812fdaf917d/apps/api/test/treks.spec.ts#L88-L92)).
2. **Gabarit** : la fiche descend entre les broches. Ses encoches sont lues comme des nombres (`z.coerce`), la broche `pageSize` absente se règle d'elle-même sur 20 et le sélecteur `matchOn` reste sur `start`. Les broches claquent une à une, le clapet s'ouvre vers le guichet.
3. **Totalisateur et tiroir en même temps** (`Promise.all`) : le pignon fait rouler les roues jusqu'à 100 et 5, pendant que le tiroir *n* sort sur ses glissières. Les tiroirs qui le précèdent restent fermés : ce sont les `(n − 1) × 20` fiches sautées par l'offset.
4. **Fiches** : la tige se retire de quelques unités, le presse-fiches marque la vingtième, et les vingt fiches montent en bloc au-dessus du tiroir. Les feuillets de tracé restent au fond, derrière la cloison : la liste ne sert jamais la trace.
5. **Relevé** : `GET ?page=n → 200 · 20 fiches · p. n/5 · total 100`.

Une fiche refusée rejoue un vrai cas des tests d'intégration :

- `GET ?lat=44.93` : la barre du verrou triple bute, car `lon` et `radiusKm` manquent. Le clapet bascule vers la goulotte, la fiche glisse dans le bac de rejet, aucun tiroir ne bouge. Relevé : `GET ?lat=44.93 → 422 · lat, lon et radiusKm ensemble` ([`test/treks.spec.ts` L291-299](https://github.com/Popoch39/trekker/blob/0ae7878ca0a422b80644053a50831812fdaf917d/apps/api/test/treks.spec.ts#L291-L299)).
- `GET ?pageSize=500` : la broche `pageSize` bute à 100. Relevé : `GET ?pageSize=500 → 422 · pageSize ≤ 100` ([`test/treks.spec.ts` L328-330](https://github.com/Popoch39/trekker/blob/0ae7878ca0a422b80644053a50831812fdaf917d/apps/api/test/treks.spec.ts#L328-L330)).

### Pointeur

- Survoler un tiroir éclaircit sa poignée (ton `hi`, jamais bleu : le bleu reste réservé à la pièce maîtresse et à la pièce visée depuis la nomenclature).
- Saisir la poignée et tirer vers soi, le long de l'axe du tiroir : le tiroir suit avec un ressort amorti. Au-delà de la moitié de la course, la demande part (fiche de demande, gabarit, fiches qui montent). Relâché avant, il rentre sans requête.
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
| Route du guichet | `/api/v1/treks` | préfixe et version : [`apps/api/src/configure-app.ts` L9-41](https://github.com/Popoch39/trekker/blob/0ae7878ca0a422b80644053a50831812fdaf917d/apps/api/src/configure-app.ts#L9-L41) ; route : [`treks.controller.ts` L16](https://github.com/Popoch39/trekker/blob/0ae7878ca0a422b80644053a50831812fdaf917d/apps/api/src/modules/treks/treks.controller.ts#L16) |
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
- **Libellé accessible** : Meuble à fiches en bois à six tiroirs, vu de trois quarts depuis le bas. Sur le dessus, une fiche de demande traverse un gabarit à broches avant d'entrer dans un guichet ; un tiroir sort sur ses glissières, ses vingt fiches se soulèvent et laissent leur tracé au fond, pendant qu'un totalisateur sur le flanc affiche 100 fiches en 5 pages.
- **Titre SEO** : trekker — anatomie d'une API de randonnées NestJS, Zod et Drizzle
- **Description SEO** : Un meuble à fiches explique trekker : chaque requête passe au gabarit Zod partagé, puis NestJS et Drizzle sortent de Postgres 20 itinéraires par page.

## 7. Notes pour la construction (#26)

- **Monde** : environ 1 unité par millimètre. Caisson d'environ 340 de large, 400 de profondeur et 380 de haut, plinthe comprise ; façades de tiroir d'environ 150 × 105 ; course du tiroir tiré d'environ 260. Les fiches font environ 125 × 75, comme une fiche de bibliothèque, et dépassent des joues du tiroir pour rester lisibles malgré la vue basse.
- **Ordre de peinture** : le tiroir tiré, quelle que soit sa rangée, passe devant les tiroirs fermés ; il est peint après la façade, dans son ouverture, avec ses glissières derrière ses joues. Les fiches levées sont peintes après le tiroir. La fiche de demande traverse le cadre du gabarit : montant arrière, fiche, broches, montant avant. Le tiroir 1 (en haut) est celui du repos : le choix de l'élévation (24°) doit garder ses fiches lisibles par-dessus les joues ; si ce n'est pas le cas, remonter à 26-28° plutôt que de changer de tiroir au repos.
- **Pas de tube ni de câble** prévu : l'arbre du totalisateur est une tige droite, à vérifier avec `lines.mjs` ; l'audit du kit n'est requis que si des pièces de révolution s'ajoutent (poignées en coquille, boutons de tige).
- **Une seule pièce bleue** : le gabarit au repos. Le survol des poignées et la sélection clavier passent par le ton `hi`.
