# Concept — anatomie de ma_parcelle

| | |
|---|---|
| Projet | [ma_parcelle](https://github.com/Popoch39/ma_parcelle) (projet 06 / 06) |
| Slug | `ma-parcelle` |
| Commit lu | `8d83a60bcf40c7d61355296887bcbdec026b8d4d` (branche `main`, identique à la référence de la spec `8d83a60bcf40`) |
| Machine | **Colonne de sondage** |
| Taille (skill `anatomy`) | Figure : 65 pièces dessinées, SVG seul, ni WebGL ni 3D |
| Ticket | #20, parent #10. Revue : #21. Construction : #27 |

Tous les liens vers le code sont des permaliens complets, figés sur ce commit.

## 1. Ce que fait le projet (la vérité de départ)

On clique une parcelle sur une carte MapLibre plein écran. Le clic lit l'IDU dans la tuile vectorielle du plan cadastral déjà affichée, sans appel réseau, et la parcelle s'allume aussitôt. La sélection ne retient qu'une parcelle à la fois. Ensuite :

1. **Le bloc Cadastre passe en premier.** Il charge la parcelle (géométrie, contenance) depuis l'API Carto de l'IGN. Les autres blocs partent de cette parcelle : si le Cadastre échoue, ils échouent tous avec la même erreur.
2. **Les cinq autres blocs** (Urbanisme, Risques, Ventes, Bâtiment, DPE) interrogent chacun leur source publique en parallèle. Chacun échoue seul : une source en panne ne casse que son bloc.
3. **La synthèse** en tête de la fiche se compose de ce qui est arrivé. Un bloc encore en chargement ou en erreur n'y apporte rien, et un indicateur reste allumé tant qu'un bloc charge.
4. **Pas de serveur.** Le navigateur appelle directement les API publiques (ADR 0001). Les réponses restent en cache 12 h : revoir la même parcelle dans la session ne relance aucune requête.

La fiche empile les blocs dans un ordre fixe, du cadastre au DPE. On la lit de haut en bas.

## 2. La machine

**Une colonne de sondage** : une colonne de sol en viroles d'acier boulonnées, comme celles des laboratoires de géotechnique, coupée en écorché sur un quart. Un petit carottier sur mât est monté sur sa bride de tête. Le dessus de la colonne est un plateau gravé du plan cadastral. Sous ce plateau, chaque virole contient une strate. Le carottier part de la parcelle incrustée dans le plateau, traverse la croûte puis les strates une à une, et remonte une carotte où toutes les couches sont superposées. Un log de sondage, fixé au mât, note ce que chaque strate a livré.

> **Ce qui bouge = ce que ça signifie.** Le carottier bleu descend de la parcelle choisie à travers six strates : chaque strate qu'il franchit est un bloc de la fiche interrogé à sa source publique, et la carotte qu'il remonte, couche sur couche, est la fiche elle-même.

Pourquoi cette machine raconte bien le code :

- **La croûte conditionne tout.** Le carottier doit percer la croûte cadastrale avant de rencontrer les autres strates, comme chaque bloc attend la parcelle chargée par le Cadastre (`parcelBlockQuery`).
- **Une virole par bloc.** Les strates sont séparées par des brides boulonnées : on peut retirer une virole sans toucher aux autres, de même qu'ajouter, retirer ou déplacer un bloc tient en une ligne de `BLOCKS`.
- **Perte de carotte = bloc en erreur.** Quand une strate ne remonte pas, le tube intérieur montre un vide à sa hauteur et sa ligne du log reste vierge. Le sondage continue et les autres strates remontent : c'est exactement `assembleSummary`.
- **L'épaisseur est un vrai chiffre.** Chaque strate est aussi épaisse que le nombre de requêtes HTTP que son bloc envoie pour la parcelle rejouée (§ 6). Le cadastre est une croûte mince (1 requête), les risques forment la strate la plus épaisse (11).

**Ordre et temps, sans tricher.** La profondeur suit l'ordre de lecture de la fiche, pas l'ordre d'arrivée des réponses. Dans l'app, les cinq blocs sous la croûte partent tous ensemble dès que la parcelle est en cache. La figure le dit de deux façons : le témoin « en cours » du log s'allume dès que la croûte est percée, et reste allumé tant qu'une strate n'a pas été lue. La légende le dit aussi en toutes lettres.

## 3. Fiche d'identité visuelle (ligne 06 de la grille)

| Axe | Grille de la spec | Ce concept |
|---|---|---|
| Machine | Carotte de calques | Colonne de sondage : colonne de sol en viroles, carottier sur mât, la carotte des six calques remonte dans le tube intérieur. **Grille suivie.** |
| Silhouette | Colonne verticale | Une colonne : un fût cylindrique d'environ 110 unités de diamètre sur 330 de haut, prolongé par un mât de 230. Elle est presque trois fois plus haute que large, et le format de la carte est **portrait** (viewBox d'environ 400 × 640). |
| Vue | Coupe (écorché) | Le quart de la colonne tourné vers le lecteur est enlevé jusqu'à l'axe. On voit les deux plans de coupe, avec les strates et les brides tranchées, le forage ouvert dans l'angle et le carottier entier dedans. Caméra : azimut 45°, pour que les deux plans de coupe s'ouvrent de façon symétrique, et élévation 32°, pour lire le plateau gravé sans écraser la hauteur. |
| Mode et mouvement | Le carottier traverse les strates | Une descente verticale lourde et continue : les tiges tournent, l'avance est lente et régulière, avec une pause dans chaque strate. Les curseurs du log se calent avec un petit ressort. Au fond, le treuil remonte le tube intérieur et sa carotte. |
| Geste | Descendre dans les couches | Le pointeur règle la profondeur : plus il est bas sur la colonne, plus le carottier descend. Au toucher, une strate touchée y fait descendre le carottier. |

**Rien à contester.** Le code raconte bien une descente : la fiche se lit de haut en bas, une première couche conditionne les suivantes et chaque couche vient d'une source distincte. La grille tient.

**Distinction avec les cinq autres lignes.**

| | Silhouette | Vue | Mode | Geste |
|---|---|---|---|---|
| 01 typomaniac | large et basse | 3/4 classique | en fonctionnement | taper une lettre |
| 02 claude-tmux-notify | haute et plate, murale | presque de face | volets, sonnette | acquitter |
| 03 claude-status-line | longue et fine | rasante | instrument, aiguille | faire avancer le temps |
| 04 pointcloud-viewer | grêle sur terrain | plongée | balayage continu | orienter la tête |
| 05 trekker | cube massif | 3/4 bas | éclaté partiel | tirer un tiroir |
| **06 ma_parcelle** | **colonne pleine, format portrait** | **écorché en quart, intérieur visible** | **traversée verticale** | **descendre** |

C'est la seule figure en écorché, la seule au format portrait et la seule dont le mouvement principal est vertical vers le bas. **Pas de base sur pieds ni de règle graduée.** La colonne repose sur sa bride de fond pleine, comme une vraie colonne de laboratoire. La profondeur se lit aux brides et au compteur de strate, pas sur une règle. Le seul trépied de la série reste celui du 04 : celle-ci n'a pas de pieds.

**Tons.** La colonne et le mât sont en `mid`. La bride de fond et les brides de jonction sont en `lo`. Le plateau, le log et les strates sont en `hi`. Les textures de strate restent dans les encres de la palette, sans couleur de terre. Le seul bleu au repos est le carottier, la pièce maîtresse.

## 4. Pièces dessinées (65)

Le sujet est ce que le lecteur regarde : le plateau, les strates, la carotte et le log. Chaque pièce repose sur une autre.

**Socle (7)**

1. Bride de fond pleine, épaisse et chanfreinée, posée sur un halo.
2. Couronne de 12 boulons de la bride de fond.
3. Oreille de levage gauche (patte percée, soudée sur la bride).
4. Oreille de levage droite.
5. Robinet de purge : corps et clé à ailettes.
6. Bec de purge avec son écrou six pans.
7. Plaque signalétique rivetée sur le chant de la bride (3 filets, 4 rivets).

**Structure (26)**

8. Virole 1 : croûte cadastrale (épaisseur de 1 requête).
9. Virole 2 : Urbanisme (8 requêtes).
10. Virole 3 : Risques (11 requêtes).
11. Virole 4 : Ventes (5 requêtes).
12. Virole 5 : Bâtiment (3 requêtes).
13. Virole 6 : DPE (4 requêtes).
14. à 18. Cinq brides de jonction entre viroles, chacune avec sa couronne de boulons.
19. Bride de tête, sous le plateau.
20. Joints entre brides (liserés sombres).
21. Faces de coupe de l'écorché : deux plans, de la bride de tête à la bride de fond.
22. Tranches des brides coupées, d'un ton plein et plus sombre, sans hachures.
23. Paroi du forage, demi-cylindre visible dans l'angle de coupe.
24. Mât, en tube carré.
25. Console du mât, boulonnée sur la bride de tête.
26. Gousset gauche de la console.
27. Gousset droit de la console.
28. Crémaillère d'avance le long du mât.
29. Butée haute.
30. Butée basse.
31. Chapeau de mât avec sa poulie de tête et son axe.
32. Tambour du treuil, à joues.
33. Flasques du treuil, boulonnées sur la bride de tête.

**Mécanisme (13)**

34. Chariot sur le mât, avec 4 bagues de guidage.
35. Pignon d'avance, visible par la lumière du chariot.
36. Moteur de rotation à ailettes.
37. Carter de réducteur.
38. Mandrin.
39. Train de tiges, en 3 tronçons.
40. Manchons de raccord des tiges.
41. **Carottier** (tube extérieur), la pièce maîtresse en bleu.
42. Couronne diamantée à 8 segments.
43. Tube intérieur avec la carotte : 6 bandes, une par strate, qui reprennent leurs textures.
44. Câble de repêchage, du tambour au carottier en passant par la poulie de tête.
45. Émerillon au sommet de la tête, par où entre le câble.
46. Tubage de tête : collier à brides posé sur la parcelle incrustée.

**Commandes (6)**

47. Manivelle d'avance sur le chariot.
48. Poignée moletée de la manivelle.
49. Levier d'embrayage de rotation, à boule.
50. Vis de blocage moletée du chariot.
51. Levier de frein du treuil.
52. Compteur de strate à tambour : 6 crans gravés, sans chiffres.

**Sujet (13)**

53. Plateau parcellaire : disque posé sur la bride de tête.
54. Rainures gravées des limites de parcelles : un îlot de la section KJ de Bordeaux, stylisé.
55. Incrustation de la parcelle KJ 33, sous le tubage.
56. Log de sondage : plaque fixée au mât.
57. Six curseurs à trois crans (info, vigilance, alerte), un par strate.
58. Témoin « en cours » du log.
59. Deux colliers qui fixent le log au mât.
60. Texture de la croûte cadastrale : un grain fin et serré.
61. Texture de l'Urbanisme, 8 corps pour 8 requêtes GPU : un banc continu fait de 4 lits soudés (zone, secteur, document, commune, qui doivent réussir ensemble), une lentille (prescriptions) et les trois formes des servitudes (une nappe, une veine et un nodule, pour surface, ligne et point).
62. Texture des Risques : 12 inclusions, 6 nodules groupés près du forage (risques localisés autour du centroïde) et 6 veines qui traversent toute la colonne (risques connus à l'échelle de la commune).
63. Texture des Ventes : 5 lits de graviers, un par page Cerema reçue.
64. Texture du Bâtiment : 3 assises de blocs maçonnés (BDNB, millésime, altimétrie).
65. Texture du DPE : 7 lamines, de A à G.

Les textures de strate finissent sur les brides et sur l'arête de coupe : aucune ne s'arrête au milieu d'une face.

## 5. Nomenclature (7 pièces, une seule maîtresse)

| # | Identifiant | Pièce | Rôle | Code |
|---|---|---|---|---|
| 1 | `plateau` | Plateau parcellaire | Le plan cadastral gravé. On choisit la parcelle en la touchant : l'IDU est lu dans la tuile déjà affichée, sans appel réseau. | [`src/map/layers/PciLayer.tsx` L9–45](https://github.com/Popoch39/ma_parcelle/blob/8d83a60bcf40c7d61355296887bcbdec026b8d4d/src/map/layers/PciLayer.tsx#L9-L45) |
| 2 | `tubage` | Tubage de tête | Un seul tubage pour un seul trou : la sélection retient une parcelle à la fois. | [`src/stores/selection-store.ts` L3–20](https://github.com/Popoch39/ma_parcelle/blob/8d83a60bcf40c7d61355296887bcbdec026b8d4d/src/stores/selection-store.ts#L3-L20) |
| 3 | `croute` | Croûte cadastrale | La première couche à percer : la parcelle désignée par son IDU, d'où partent toutes les autres. | [`src/api/cadastre.ts` L63–74](https://github.com/Popoch39/ma_parcelle/blob/8d83a60bcf40c7d61355296887bcbdec026b8d4d/src/api/cadastre.ts#L63-L74) |
| 4 | `carottier` | **Carottier** (pièce maîtresse) | Il emporte la parcelle sortie du cache du Cadastre jusque dans chaque strate. Si la croûte casse, il ne remonte rien. | [`src/queries/block.ts` L6–15](https://github.com/Popoch39/ma_parcelle/blob/8d83a60bcf40c7d61355296887bcbdec026b8d4d/src/queries/block.ts#L6-L15) |
| 5 | `couronne` | Couronne diamantée | Elle mord chaque source : un GET avec un délai de 15 s et une erreur typée (HTTP, délai, réseau, JSON invalide). | [`src/api/fetch-json.ts` L61–91](https://github.com/Popoch39/ma_parcelle/blob/8d83a60bcf40c7d61355296887bcbdec026b8d4d/src/api/fetch-json.ts#L61-L91) |
| 6 | `viroles` | Viroles des strates | Six viroles boulonnées, une par bloc, dans l'ordre de la fiche. Chacune charge et échoue seule. | [`src/components/report/blocks.ts` L14–25](https://github.com/Popoch39/ma_parcelle/blob/8d83a60bcf40c7d61355296887bcbdec026b8d4d/src/components/report/blocks.ts#L14-L25) |
| 7 | `log` | Log de sondage | La synthèse : elle s'écrit avec ce qui est remonté. Une strate perdue ou encore en cours laisse sa ligne vierge, et le témoin reste allumé tant qu'une strate charge. | [`src/lib/summary/summary.ts` L59–68](https://github.com/Popoch39/ma_parcelle/blob/8d83a60bcf40c7d61355296887bcbdec026b8d4d/src/lib/summary/summary.ts#L59-L68) |

Mention d'en-tête : « 7 pièces · une seule les compte ».

Crochets de pièce dans le SVG : `plateau` couvre les pièces 53–55, `tubage` la 46, `croute` les 8 et 60, `carottier` les 41 et 43, `couronne` la 42, `viroles` les 9–19, `log` les 56–59. La couronne est vissée au bout du carottier mais garde son propre crochet. L'identifiant `carottier` peut figurer sur deux groupes (tube extérieur et tube intérieur), que l'ordre de peinture sépare autour de la paroi du forage.

## 6. Les chiffres et leur source

La parcelle rejouée est **33063 KJ 33** (Bordeaux, rue Sainte-Catherine). C'est la parcelle de référence des tests du projet, et ses fixtures sont de vraies réponses d'API capturées avec `curl` (README du projet). Les valeurs viennent des tests au commit lu, avec la date figée du 2026-10-11.

**Constantes du code**

| Chiffre affiché | Valeur | Source |
|---|---|---|
| Format de l'IDU | 14 caractères | [`src/lib/idu.ts` L12–13](https://github.com/Popoch39/ma_parcelle/blob/8d83a60bcf40c7d61355296887bcbdec026b8d4d/src/lib/idu.ts#L12-L13) |
| Plan cadastral cliquable dès le zoom | 15 (tuiles jusqu'à 19) | [`src/map/layers/pci-source.ts` L12–21](https://github.com/Popoch39/ma_parcelle/blob/8d83a60bcf40c7d61355296887bcbdec026b8d4d/src/map/layers/pci-source.ts#L12-L21) |
| Nombre de strates (blocs) | 6, dans cet ordre | [`src/components/report/blocks.ts` L18–25](https://github.com/Popoch39/ma_parcelle/blob/8d83a60bcf40c7d61355296887bcbdec026b8d4d/src/components/report/blocks.ts#L18-L25) |
| Délai par requête | 15 s | [`src/api/fetch-json.ts` L6–8](https://github.com/Popoch39/ma_parcelle/blob/8d83a60bcf40c7d61355296887bcbdec026b8d4d/src/api/fetch-json.ts#L6-L8) |
| Urbanisme : requêtes au GPU | 8 (4 obligatoires ensemble, 1 de prescriptions, 3 de servitudes) | [`src/api/gpu.ts` L214–231](https://github.com/Popoch39/ma_parcelle/blob/8d83a60bcf40c7d61355296887bcbdec026b8d4d/src/api/gpu.ts#L214-L231) |
| Urbanisme : part minimale d'une zone | 1 % de la parcelle | [`src/api/gpu.ts` L141–143](https://github.com/Popoch39/ma_parcelle/blob/8d83a60bcf40c7d61355296887bcbdec026b8d4d/src/api/gpu.ts#L141-L143) |
| Urbanisme : grille de mesure | 50 × 50 points | [`src/lib/coverage.ts` L4–6](https://github.com/Popoch39/ma_parcelle/blob/8d83a60bcf40c7d61355296887bcbdec026b8d4d/src/lib/coverage.ts#L4-L6) |
| Risques lus | 12 (6 localisés, 6 communaux) | [`src/api/georisques.ts` L188–293](https://github.com/Popoch39/ma_parcelle/blob/8d83a60bcf40c7d61355296887bcbdec026b8d4d/src/api/georisques.ts#L188-L293) |
| Risques : rayons | 500 m, 1 000 m pour les installations classées, 100 m pour « très proche » | [`src/api/georisques.ts` L14–19](https://github.com/Popoch39/ma_parcelle/blob/8d83a60bcf40c7d61355296887bcbdec026b8d4d/src/api/georisques.ts#L14-L19) |
| Ventes : voisinage, période, seuil de médiane | 500 m, 5 ans, 5 ventes simples | [`src/lib/sales.ts` L3–10](https://github.com/Popoch39/ma_parcelle/blob/8d83a60bcf40c7d61355296887bcbdec026b8d4d/src/lib/sales.ts#L3-L10) |
| Ventes : source et secours | Cerema, puis data.gouv.fr | [`src/api/sales/index.ts` L32–33](https://github.com/Popoch39/ma_parcelle/blob/8d83a60bcf40c7d61355296887bcbdec026b8d4d/src/api/sales/index.ts#L32-L33) |
| Ventes : emprise Cerema et délai | carré de 1 km (limite 0,02°), 45 s | [`src/api/sales/cerema.ts` L9–10](https://github.com/Popoch39/ma_parcelle/blob/8d83a60bcf40c7d61355296887bcbdec026b8d4d/src/api/sales/cerema.ts#L9-L10), [L40–41](https://github.com/Popoch39/ma_parcelle/blob/8d83a60bcf40c7d61355296887bcbdec026b8d4d/src/api/sales/cerema.ts#L40-L41) |
| Bâtiment : sources | BDNB (2 requêtes) et altimétrie RGE ALTI (1) | [`src/api/building.ts` L51–60](https://github.com/Popoch39/ma_parcelle/blob/8d83a60bcf40c7d61355296887bcbdec026b8d4d/src/api/building.ts#L51-L60) |
| DPE : voisinage, page, plafond | 100 m, 100 par page, 3 pages | [`src/api/ademe.ts` L64–70](https://github.com/Popoch39/ma_parcelle/blob/8d83a60bcf40c7d61355296887bcbdec026b8d4d/src/api/ademe.ts#L64-L70) |
| DPE : lamines | 7 étiquettes, de A à G | [`src/api/ademe.ts` L10](https://github.com/Popoch39/ma_parcelle/blob/8d83a60bcf40c7d61355296887bcbdec026b8d4d/src/api/ademe.ts#L10) |
| Niveaux d'alerte (crans des curseurs) | 3 : info, vigilance, alerte | [`src/lib/summary/summary.ts` L4–7](https://github.com/Popoch39/ma_parcelle/blob/8d83a60bcf40c7d61355296887bcbdec026b8d4d/src/lib/summary/summary.ts#L4-L7) |
| Cache des réponses | 12 h ; 2 nouvelles tentatives sur panne passagère | [`src/queries/query-client.ts` L4–18](https://github.com/Popoch39/ma_parcelle/blob/8d83a60bcf40c7d61355296887bcbdec026b8d4d/src/queries/query-client.ts#L4-L18) |

**Épaisseur des strates = requêtes envoyées pour KJ 33 (32 en tout)**

| Strate | Requêtes | Source |
|---|---|---|
| Cadastre | 1 (API Carto) | [`src/api/cadastre.ts` L67–74](https://github.com/Popoch39/ma_parcelle/blob/8d83a60bcf40c7d61355296887bcbdec026b8d4d/src/api/cadastre.ts#L67-L74) |
| Urbanisme | 8 | [`src/api/gpu.ts` L214–231](https://github.com/Popoch39/ma_parcelle/blob/8d83a60bcf40c7d61355296887bcbdec026b8d4d/src/api/gpu.ts#L214-L231) |
| Risques | 11 (12 risques, `ssp` lu une fois pour deux ; Bordeaux sans arrondissement, donc un appel par point d'accès) | [`src/api/georisques.ts` L179–180](https://github.com/Popoch39/ma_parcelle/blob/8d83a60bcf40c7d61355296887bcbdec026b8d4d/src/api/georisques.ts#L179-L180), [L296–312](https://github.com/Popoch39/ma_parcelle/blob/8d83a60bcf40c7d61355296887bcbdec026b8d4d/src/api/georisques.ts#L296-L312) |
| Ventes | 5 (pages Cerema) | [`src/lib/summary/summary.test.ts` L197–202](https://github.com/Popoch39/ma_parcelle/blob/8d83a60bcf40c7d61355296887bcbdec026b8d4d/src/lib/summary/summary.test.ts#L197-L202) |
| Bâtiment | 3 | [`src/api/building.ts` L54–60](https://github.com/Popoch39/ma_parcelle/blob/8d83a60bcf40c7d61355296887bcbdec026b8d4d/src/api/building.ts#L54-L60) |
| DPE | 4 (une emprise vide, puis 3 pages de voisinage) | [`src/api/ademe.test.ts` L111–133](https://github.com/Popoch39/ma_parcelle/blob/8d83a60bcf40c7d61355296887bcbdec026b8d4d/src/api/ademe.test.ts#L111-L133) |

**Valeurs de la parcelle rejouée**

| Strate | Ce que montre le relevé | Ligne du log | Source |
|---|---|---|---|
| Cadastre | 131 m² | info | [`summary.test.ts` L212–218](https://github.com/Popoch39/ma_parcelle/blob/8d83a60bcf40c7d61355296887bcbdec026b8d4d/src/lib/summary/summary.test.ts#L212-L218) |
| Urbanisme | aucune zone publiée | vigilance | [`summary.test.ts` L219–226](https://github.com/Popoch39/ma_parcelle/blob/8d83a60bcf40c7d61355296887bcbdec026b8d4d/src/lib/summary/summary.test.ts#L219-L226) |
| Risques | 12 lus, vigilance au plus | vierge (rien ne monte en synthèse) | [`summary.test.ts` L185–186](https://github.com/Popoch39/ma_parcelle/blob/8d83a60bcf40c7d61355296887bcbdec026b8d4d/src/lib/summary/summary.test.ts#L185-L186) |
| Ventes | 4 125 €/m², 7 ventes d'appartements (4 maisons, sous le seuil) | info | [`summary.test.ts` L227–235](https://github.com/Popoch39/ma_parcelle/blob/8d83a60bcf40c7d61355296887bcbdec026b8d4d/src/lib/summary/summary.test.ts#L227-L235) |
| Bâtiment | construit en 1850, 10 m, altitude 7,47 m | info | [`src/api/building.test.ts` L28–53](https://github.com/Popoch39/ma_parcelle/blob/8d83a60bcf40c7d61355296887bcbdec026b8d4d/src/api/building.test.ts#L28-L53) |
| DPE | voisinage, 377 annoncés, arrêt à la 3ᵉ page | vierge | [`src/api/ademe.test.ts` L111–133](https://github.com/Popoch39/ma_parcelle/blob/8d83a60bcf40c7d61355296887bcbdec026b8d4d/src/api/ademe.test.ts#L111-L133) |
| Strate perdue (2ᵉ tour) | BDNB répond 500 : la strate Bâtiment ne remonte pas, le log s'écrit sans elle | vierge | [`summary.test.ts` L254–264](https://github.com/Popoch39/ma_parcelle/blob/8d83a60bcf40c7d61355296887bcbdec026b8d4d/src/lib/summary/summary.test.ts#L254-L264), [`summary.ts` L59–68](https://github.com/Popoch39/ma_parcelle/blob/8d83a60bcf40c7d61355296887bcbdec026b8d4d/src/lib/summary/summary.ts#L59-L68) |
| Strate en cours | témoin allumé, d'autres faits peuvent venir | — | [`summary.test.ts` L247–252](https://github.com/Popoch39/ma_parcelle/blob/8d83a60bcf40c7d61355296887bcbdec026b8d4d/src/lib/summary/summary.test.ts#L247-L252) |

## 7. Scénario d'interaction

Le flux rejoué : une parcelle choisie sur la carte, la croûte cadastrale percée, puis les cinq couches publiques interrogées et superposées dans la carotte, sans compte ni serveur.

**Au repos.** KJ 33 est incrustée sous le tubage, le carottier attend juste au-dessus du plateau, les tiges sont immobiles, le log est vierge et le témoin éteint. Relevé : « 33063 KJ 33 · prêt · 0/6 ».

**Tour de démonstration** (boucle, environ 18 s, quand personne n'y touche) :

1. **Choix.** L'incrustation de KJ 33 s'allume d'un coup, sans attendre le cadastre (le surlignage vient de la tuile, comme `SelectionLayer`). Le témoin s'allume.
2. **Croûte.** Les tiges se mettent à tourner et le carottier perce la croûte (1 requête). Relevé : « 1/6 Cadastre · 1 req. · 131 m² ». Le curseur 1 se cale sur info.
3. **Strates.** Le carottier descend et marque une pause dans chaque virole. À chaque strate, le relevé passe à la suivante et son curseur se cale (ou la ligne reste vierge) :
   - « 2/6 Urbanisme · 8 req. · aucune zone publiée », vigilance ;
   - « 3/6 Risques · 11 req. · vigilance au plus », ligne vierge ;
   - « 4/6 Ventes · 5 req. · 4 125 €/m² (7) », info ;
   - « 5/6 Bâtiment · 3 req. · 1850 · alt. 7,47 m », info ;
   - « 6/6 DPE · 4 req. · 377 annoncés », ligne vierge.
4. **Remontée.** Au fond, le témoin s'éteint. Le treuil remonte le tube intérieur, et la carotte apparaît entière, six bandes superposées. Relevé : « 6/6 · 32 req. · 0 serveur ». Le carottier remonte lentement à sa pose de repos.
5. **Un tour sur deux, la strate perdue.** Le tour suivant rejoue le test où la BDNB répond 500. La couronne traverse la virole Bâtiment, mais la carotte présente un vide à sa hauteur et la ligne 5 du log reste vierge. Relevé : « 5/6 Bâtiment · BDNB 500 · strate perdue ». Les strates du dessous remontent normalement.

**Pointeur** (aperçu et fiche) :

- La hauteur du pointeur sur la colonne fixe la profondeur visée, entre le plateau et la bride de fond. Le carottier suit avec un amortissement critique, sans dépassement, la manivelle et le compteur de strate tournent avec lui, et le relevé affiche la strate atteinte. On descend dans les couches comme on lit la fiche.
- Un clic sur le plateau choisit de nouveau la parcelle. Comme les réponses sont en cache (12 h), le carottier redescend quatre fois plus vite, le témoin ne s'allume pas et le log se remplit d'un coup. Relevé : « 33063 KJ 33 · en cache · 0 req. ».
- Quand le pointeur quitte la figure, le carottier reste où il est. Le tour reprend après 4 s d'inactivité.

**Toucher** : une strate touchée y fait descendre le carottier, et le plateau touché relance le sondage, depuis le cache. Il n'y a pas de glisser vertical, pour ne pas voler le défilement de la page.

**Clavier** (focus sur la scène, aucun écouteur global) : ↓ et ↑ passent d'une strate à l'autre, Début ramène au plateau, Fin envoie au fond, Entrée ou Espace relance le sondage. Tab sort de la scène normalement.

**Mouvement réduit** : la figure reste immobile dans sa pose au repos. Les interactions placent le carottier à la strate visée sans transition, et le relevé change aussitôt.

**Hors écran** : la boucle s'arrête.

## 8. Textes de la fiche

- **Accroche** : « Cliquez une parcelle : la carte la *carotte* à travers six couches de données publiques, sans compte ni serveur. » (le mot en emphase : *carotte*)
- **Nom de la machine** : Colonne de sondage
- **Titre de la figure** : « Carotte d'une parcelle »
- **Consigne pointeur** : « Descendez le long de la colonne pour traverser les strates · cliquez le plateau pour relancer le sondage »
- **Consigne toucher** : « Touchez une strate pour y descendre · touchez le plateau pour relancer le sondage »
- **Relevé au repos** : « 33063 KJ 33 · prêt · 0/6 »
- **Format du relevé** : « {n}/6 {strate} · {requêtes} req. · {valeur} », par exemple « 4/6 Ventes · 5 req. · 4 125 €/m² (7) ». Variantes : « 6/6 · 32 req. · 0 serveur » au fond, « 5/6 Bâtiment · BDNB 500 · strate perdue » pour la strate perdue, « 33063 KJ 33 · en cache · 0 req. » quand le sondage est relancé.
- **Légende** : « Le carottier part de la parcelle choisie sur le plan cadastral et traverse six strates, une par bloc de la fiche, dans leur ordre d'affichage. Chaque strate est aussi épaisse que le nombre de requêtes que son bloc envoie pour la parcelle 33063 KJ 33 : 32 en tout, du navigateur aux API publiques, sans serveur. Seule la croûte du cadastre conditionne les autres, qui sont interrogées ensemble ; une strate perdue manque au log sans arrêter le sondage. »
- **Libellé accessible** : « Colonne de sondage en écorché. Un carottier bleu descend d'un plateau gravé du plan cadastral à travers six strates de sol, de haut en bas : cadastre, urbanisme, risques, ventes, bâtiment et DPE. Un log fixé au mât note ce que chaque strate a livré. »
- **Titre SEO** : « ma_parcelle — anatomie d'une carte des données publiques · Louis Pocheron »
- **Description SEO** : « Comment ma_parcelle réunit ce que les données publiques disent d'une parcelle : une colonne de sondage interactive traverse cadastre, urbanisme, risques, ventes, bâtiment et DPE, chaque pièce reliée au code React et MapLibre. »

## 9. Notes pour la construction (#27)

- **Ordre de peinture.** Ce qui est derrière l'axe de coupe se peint d'abord : la demi-paroi arrière du forage, puis le carottier entier, puis les faces de coupe, puis les tranches de brides. Le câble passe derrière le mât au-dessus de la console et devant la poulie. Quand le carottier traverse une bride, il est dessiné dans l'angle ouvert, jamais à travers une tranche.
- **Pièces de révolution et câble** : les viroles, brides, tiges, carottier et poulie viennent de `kit/lathe.mjs`, le câble de `kit/tube.mjs`. L'audit du kit doit finir à zéro, carottier en haut, à mi-course et au fond.
- **Textures** : les veines communales des Risques vont d'un plan de coupe à l'autre et finissent sur l'arête extérieure. Les lamines du DPE finissent sur les brides. Les graviers des Ventes restent dans leur lit.
- **Budget** : SVG ≤ 250 Ko brut, module de mouvement ≤ 20 Ko minifié.
