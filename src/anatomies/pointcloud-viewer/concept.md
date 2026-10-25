# Concept · pointcloud-viewer

Fiche de concept de l'anatomie de `pointcloud-viewer` (ticket #18, spec #10). Elle fixe la machine, ses pièces, le scénario, les chiffres et les textes avant tout dessin. Elle sert à la revue (#21), puis d'entrée à la construction (#25).

- **Dépôt lu** : [Popoch39/pointcloud-viewer](https://github.com/Popoch39/pointcloud-viewer), branche par défaut `main`.
- **SHA lu** : `e30a105e0cf22c12d500d6bbf06fcd26b12697a1`, identique à la référence de la spec (`e30a105e0cf2`).
- **Base des permaliens** : `https://github.com/Popoch39/pointcloud-viewer/blob/e30a105e0cf22c12d500d6bbf06fcd26b12697a1/`. Toutes les plages de lignes ci-dessous sont lues à ce SHA.
- **Taille** : « Figure » du skill `anatomy`, en SVG seul, sans WebGL ni 3D.

## Décisions de la revue (#21)

Validé par Louis le 2026-10-25. Les renvois visent la page de revue : ressemblances R1 à R15, incohérences I1 et I2, décisions ouvertes n° 1 à 39 (n° 20 à 28 pour cette fiche).

- **Extérieur pur (R2).** 01, 03 et 04 se déclaraient tous « en fonctionnement ». 04 n'a aucune ouverture ni coupe : tout se lit sur la surface (faisceau, dépôt du nuage, gravure du disque).
- **Viser au lieu de glisser (R3).** Le glisser horizontal amorti était le geste de 03. La tête vise le pointeur : son azimut suit l'angle du pointeur autour de la station. Tourner dans le sens de la spirale lit les points, revenir fait patiner le cliquet. Au toucher, toucher un point du terrain tourne la tête jusqu'à lui, en avant seulement. Le volant moleté d'orientation, qui doublait la tête et le volant de 03, est retiré. Consignes, libellé et clavier suivent.
- **Disque gravé au lieu de la cassette (R4).** La bande sur deux bobines est à 02. Le PCBK devient un disque gravé en quatre secteurs dont les angles suivent les blocs (positions 240°, intensité 40°, RGB 60°, classification 20°), l'en-tête de 72 octets au moyeu. Il se grave secteur par secteur, puis glisse sur le rail jusqu'au support de carnet, loquet compris. Identifiant `cassette` → `disque`.
- **Orthophoto en trame (R10).** Le trait gravé reste à 06, dont le plan cadastral est vectoriel. Les tuiles d'orthophoto, un raster, deviennent de la trame : aplats tonals en pointillé ou en hachure, sans contour gravé.
- **Élan de moteur (R12).** L'amortissement critique reste à 03. La tête garde son élan de moteur : elle accélère, file et freine, y compris quand on la vise.
- **Vraie plongée à 58–60° (arbitrage complémentaire de Louis, 2026-10-25).** Après R1, 06 montait à 40° d'élévation pour un azimut de 45°, trop près de 04 (40°, 50°). 04 monte à 58–60°, azimut 40° gardé : on regarde vraiment d'en haut, le disque de la spirale s'ouvre presque rond, et le trépied garde sa silhouette grêle, ses trois jambes écartées bien lisibles. Sa hauteur se raccourcit à l'écran (environ la moitié de sa hauteur vraie) : l'instrument, déjà hors d'échelle, reste assez grand pour dominer le nuage.
- **Format carré (R13, I2).** La fiche annonçait « un peu en hauteur » avec un viewBox plus large que haut. Tranché : carré, 600 × 600.
- **Décisions n° 20 à 28.** L'option de la fiche est retenue : instrument hors d'échelle dit dans la légende, un point dessiné sur 40, modes de couleur en tons d'encre calculés avec les formules du dépôt, bake rejoué au ralenti sans durée affichée, « 1,80 Mo » à la virgule, vitesse affichée plafonnée avec flou de bougé, plongée (à 58–60° plutôt que 50°, voir ci-dessous), format tranché par I2. La n° 26 (poses précalculées ou petit projeteur pour la tête) reste ouverte : elle se tranche à la construction, selon le budget.
- **Comptes.** 66 → 65 pièces dessinées (volant d'orientation retiré) ; nomenclature inchangée en nombre, 7 pièces, une seule pièce maîtresse.

## 1. La machine

**Un scanner laser sur trépied**, mince et haut, planté au-dessus d'un carré de terrain fait de quatre dalles d'orthophoto. Sa tête tourne sans arrêt et son miroir dépose un nuage de points en spirale sur le terrain. Une borne marque un angle du nuage, et un disque gravé, qui glisse jusqu'à un support serré à une jambe, reçoit le fichier cuit.

Le dépôt fournit lui-même la vérité du mouvement. Son fichier d'essai, `sample.laz`, est une spirale de 100 000 points écrite par [`generate-sample.rs` L27-L44](https://github.com/Popoch39/pointcloud-viewer/blob/e30a105e0cf22c12d500d6bbf06fcd26b12697a1/webassembly/examples/generate-sample.rs#L27-L44) : le point `i` est à l'angle `t = i / 100` radians, à `0,05 · t` mètres du centre et à `50 + 0,02 · t` mètres d'altitude. Un scanner qui tourne sur lui-même en allongeant sa visée trace exactement cette courbe. **La tête tourne d'un angle qui est l'indice du point lu** : un tour lit 628 points, et les 100 000 points prennent 159 tours.

> **Ce qui bouge = ce que ça signifie.** Chaque tour de tête fait avancer la boucle Rust de 628 points dans le fichier ; le miroir bleu ramène chaque point dans l'espace local de la borne avant de l'écrire, et quand la boucle se termine, three.js pose d'un coup tout le nuage sur la carte.

### Fiche d'identité visuelle

La ligne de la grille est **suivie, pas contestée** : le code raconte précisément un balayage qui dépose des points (la boucle `for point in reader.points()`, dans l'ordre du fichier) et une scène géoréférencée posée sur un fond de carte. Le trépied et son terrain portent ces deux idées sans détour.

| Axe | Ligne de la grille | Ce concept |
|---|---|---|
| Machine | Scanner sur trépied | Scanner laser de relevé, tête de révolution, sur trépied télescopique à trois jambes |
| Silhouette | Haute et grêle, au-dessus d'un terrain | Trois jambes longues et écartées, une tête fine en colonne ; sous elle, un carré de terrain plat dont le nuage se relève en entonnoir vers le bord (0 à 20 m de haut pour 50 m de rayon) |
| Vue | Plongée | **Vraie plongée** : élévation 58 à 60° (le skill autorise de monter « pour regarder dans quelque chose d'ouvert », comme le bac à ondes à 44° ; ici plus haut encore, arbitrage complémentaire), azimut 40°, pour lire le disque de la spirale presque rond et le sommet de la tête. La plus haute caméra de la série, loin des 40° de 06 |
| Mode de dessin | En fonctionnement | **Extérieur pur** : machine en marche, rien d'éclaté, de coupé ni d'ouvert. Tout se lit sur la surface : le faisceau, le dépôt du nuage, la gravure du disque. La fente du miroir et la fente de carte sont des ouvertures de l'instrument réel, pas des vues sur son intérieur (R2) |
| Mouvement | Balayage continu, nuage qui se dépose | La tête tourne en continu, accélère au démarrage comme un vrai moteur et garde cet élan quand on la vise : pas d'amortissement critique (R12). La spirale grandit du centre vers le bord ; le disque se grave secteur par secteur à la fin ; le nuage s'allume d'un bloc |
| Geste | Orienter la tête | **Viser avec la tête** : la tête tourne vers le pointeur, son azimut suit l'angle du pointeur autour de la station. Tourner dans le sens de la spirale lit des points, revenir fait patiner le cliquet (R3) |
| Format | (libre) | Carré : viewBox de 600 × 600 (R13, I2) |

### Ce qui la distingue des cinq autres lignes

| Projet | Sa ligne | Écart avec ce concept |
|---|---|---|
| 01 typomaniac | Banc de duel large et bas, 3/4 classique, porte ouverte | Ici une silhouette verticale et grêle, vue en plongée, sans aucune ouverture |
| 02 claude-tmux-notify.nvim | Tableau mural, presque de face, bande sur deux bobines | Ici un objet posé au sol, vu d'en haut, sans face plane dominante ; le PCBK est un disque gravé, pas une bande |
| 03 claude-status-line | Rampe longue, vue rasante, glisser linéaire | Ici une vue plongeante sur un disque, rien de long ni de rasant ; on vise d'un geste angulaire, on ne glisse pas, et aucun volant moleté ne double la tête |
| 05 trekker | Cube massif à tiroirs, éclaté partiel | Aucun tiroir : le fichier PCBK est un disque qui glisse sur un rail, et rien n'est éclaté |
| 06 ma_parcelle | Colonne en coupe, écorché, plan cadastral gravé, vue à 40°, appui maintenu pour forer | Aucune coupe ni strate : le terrain est vu presque d'aplomb (58–60°), en surface, et la carte est une trame tonale, pas un trait gravé ; on vise sans appuyer, la tête suit l'angle du pointeur |

**Pas de base par réflexe.** Il n'y a ni plaque sur pieds ni règle graduée. Le sol est le terrain lui-même : quatre tuiles d'orthophoto posées à plat, dans lesquelles les pointes des jambes s'enfoncent. La seule graduation est le cercle horizontal de la tête, une vraie pièce d'instrument de relevé.

## 2. Monde et caméra

- **Unités** : le nuage est dessiné à l'échelle, 2 unités par mètre : 200 × 200 unités au sol, 40 de haut. L'altitude n'est pas exagérée.
- **Hors d'échelle, assumé** : l'instrument est dessiné grand devant le terrain, comme sur une maquette. La tête doit dominer le bord de l'entonnoir pour tirer vers le bas, donc elle est à environ 1,1 fois le rayon du nuage. La légende ne prétend pas le contraire.
- **Repère** : la station (le centre de la spirale) est sous le fil à plomb, au centre du terrain. La borne est à l'angle sud-ouest du nuage, au minimum par axe, et non sous le trépied : c'est la vraie définition du World Offset ([`lib.rs` L56](https://github.com/Popoch39/pointcloud-viewer/blob/e30a105e0cf22c12d500d6bbf06fcd26b12697a1/webassembly/src/lib.rs#L56)). Un jalon à cible marque l'angle opposé, le maximum de la bbox.
- **Caméra** : azimut 40°, élévation 58 à 60°, `fitProjection` sur les coins du terrain, la pointe des jambes et le sommet de la roue de filtres. Le nuage et le trépied occupent 55 à 65 % de la carte. Vue de si haut, la tête se raccourcit : le cylindre du boîtier se lit surtout par son dessus (roue de filtres, cercle gradué), et la fente du miroir doit rester visible sur le flanc tourné vers le lecteur.- **Tête de révolution** : le corps de la tête est un cylindre vertical. En tournant, sa silhouette ne change pas : seuls bougent la fente du miroir, le tambour, le cran du cercle et l'encoche de la carte. Le module de mouvement reste petit, et l'on évite de reconstruire des boîtes à chaque image.
- **Tons** : terrain et pointes en `lo`, trépied et tête en `mid`, nuage en `hi`. Seule pièce bleue au repos : le tambour du miroir. Pas d'autre couleur, même pour les modes de couleur du nuage (voir § 5).

## 3. Pièces dessinées (65)

Chaque pièce repose sur une autre. Les numéros entre crochets renvoient à la nomenclature (§ 4). Par groupe : socle 14, structure 20, mécanisme 20, commandes 5, sujet 6.

### Socle : le terrain (14)

1. Tuile d'orthophoto nord, dalle mince (épaisseur 1,2, biseau 0,6).
2. Tuile d'orthophoto est.
3. Tuile d'orthophoto sud.
4. Tuile d'orthophoto ouest.
5. Joint en croix entre les quatre tuiles, rainure `faint` qui court d'un bord à l'autre.
6. Îlots bâtis en trame sur les tuiles : aplats tonals en pointillé serré, sans contour gravé, coupés net au bord de chaque tuile (le quartier de l'Odéon, sous la station de l'échantillon).
7. Allée de jardin en trame claire, une hachure fine qui traverse deux tuiles et se termine sur leurs bords, sans contour.
8. Clou de station au centre du terrain, tête ronde et anneau.
9. Borne d'angle [5], pierre trapue biseautée, posée à l'angle sud-ouest du nuage.
10. Disque de bronze scellé sur la borne, croix gravée.
11. Bague de scellement autour du disque.
12. Jalon d'emprise à l'angle opposé, tube à bandes alternées.
13. Sabot pointu du jalon, enfoncé dans la tuile.
14. Cible damier en tête du jalon, avec sa vis de fixation.

### Structure : le trépied (20)

15. à 17. Trois jambes supérieures, tubes plats en bois.
18. à 20. Trois coulisses inférieures, tubes en aluminium qui sortent des jambes.
21. à 23. Trois colliers de serrage à papillon, un par jambe.
24. à 26. Trois pointes ferrées avec pédale, plantées dans les tuiles.
27. Plateau de tête triangulaire.
28. à 30. Trois chapes de charnière sous le plateau, avec leur axe.
31. Vis de fixation centrale sous le plateau, avec sa molette.
32. Fil à plomb qui pend de la vis de fixation.
33. Plomb conique, sa pointe juste au-dessus du clou de station.
34. Support de carnet serré sur la jambe avant : collier et bras.

### Mécanisme : la tête (20)

35. Embase à trois vis calantes, posée sur le plateau.
36. Nivelle sphérique sur l'embase, bulle centrée.
37. Socle fixe de la tête, cylindre bas : il porte le cliquet et le dock de gravure du disque.
38. Couronne à rochet, dents tout autour du pied de la partie tournante.
39. Cliquet fixe, son ressort et son axe, appuyé sur la couronne.
40. Cercle horizontal gradué sur la partie tournante, traits pendus à son bord, un majeur tous les 5.
41. Index fixe, face au cercle gradué.
42. Boîtier scellé [2], le corps cylindrique de la tête, avec son joint d'étanchéité en anneau et deux rangées de fentes d'aération fermées.
43. Fente du miroir, coupée dans le boîtier sur toute sa hauteur utile, avec ses parois intérieures.
44. Tambour du miroir [3], cylindre à axe horizontal dans la fente : **la pièce maîtresse, en bleu**.
45. Miroir à 45°, la face oblique du tambour.
46. Deux paliers du tambour, de part et d'autre de la fente.
47. Fente de carte sur le flanc du boîtier, avec son volet.
48. Carte LAS/LAZ [1], plaquette mince avec ses contacts dorés en peigne et son encoche.
49. Faisceau laser, du miroir au point d'impact.
50. Point d'impact, le point terminal du faisceau sur le nuage.
51. Disque PCBK [4], galette mince gravée en quatre secteurs dont les angles suivent les blocs (positions 240°, intensité 40°, RGB 60°, classification 20°), l'en-tête de 72 octets au moyeu ; des sillons concentriques marquent le secteur gravé.
52. Dock de gravure dans le socle fixe (plateau tournant et pointe de gravure), rail court jusqu'au support de carnet, et chariot porte-disque qui y glisse.
53. Câble spiralé du socle fixe au chariot porte-disque, avec ses deux coquilles de connecteur.
54. Bague collectrice entre la partie tournante et le socle fixe, trait de joint.

### Commandes (5)

55. Roue de filtres [7] sur le sommet de la tête, quatre fenêtres rondes.
56. Bille d'indexage de la roue, dans son logement.
57. Bouton de marche sur le boîtier, avec sa bague.
58. Voyant d'état à côté du bouton : éteint, clignotant pendant le bake, fixe une fois le nuage rendu (en tons, sans couleur).
59. Loquet du disque, qui bascule du côté du socle au côté du support au moment du transfert.

### Sujet (6)

60. Nuage de points [6] : la spirale de 100 000 points lus, dont 2 500 dessinés (un sur 40), en entonnoir de 0 à 20 m.
61. Points tout juste écrits, au ton `lo` pendant le bake : le tampon en mémoire, pas encore rendu.
62. Spire courante, la dernière posée, au ton `mid`.
63. Halo doux sous le disque et son support.
64. Halo doux sous chaque pointe de jambe et sous la borne.
65. Halo doux sous le trépied, au centre.

## 4. Nomenclature (7 pièces)

« 7 pièces · une seule les compte ». Chaque pièce porte un identifiant, égal au crochet de pièce du SVG.

| N° | Identifiant | Pièce | Rôle | Code au SHA lu |
|---|---|---|---|---|
| 1 | `carte` | Carte LAS/LAZ | Le fichier choisi. Un `.las` ou un `.laz` part au bake dans un Worker, un `.bin` déjà cuit s'ouvre sur place. | [`src/hooks/use-bake.ts` L78-L87](https://github.com/Popoch39/pointcloud-viewer/blob/e30a105e0cf22c12d500d6bbf06fcd26b12697a1/src/hooks/use-bake.ts#L78-L87) |
| 2 | `boitier` | Boîtier scellé | Le Web Worker : il lit les octets du fichier, initialise le WebAssembly une seule fois, remonte la progression et rend le PCBK par transfert, sans copie. | [`src/workers/bake-worker.ts` L13-L37](https://github.com/Popoch39/pointcloud-viewer/blob/e30a105e0cf22c12d500d6bbf06fcd26b12697a1/src/workers/bake-worker.ts#L13-L37) |
| 3 | `miroir` | **Tambour du miroir** (pièce maîtresse) | Le bake Rust compilé en WebAssembly : il parcourt les points du LAS/LAZ, les recentre sur le minimum par axe pour qu'ils restent précis en f32, puis écrit l'en-tête de 72 octets et les blocs planaires. | [`webassembly/src/lib.rs` L48-L132](https://github.com/Popoch39/pointcloud-viewer/blob/e30a105e0cf22c12d500d6bbf06fcd26b12697a1/webassembly/src/lib.rs#L48-L132) |
| 4 | `disque` | Disque PCBK | Le format maison : vérifie le magic et la version, puis pose des vues TypedArray sur le buffer, sans rien décoder. | [`src/lib/baked-pointcloud.ts` L41-L91](https://github.com/Popoch39/pointcloud-viewer/blob/e30a105e0cf22c12d500d6bbf06fcd26b12697a1/src/lib/baked-pointcloud.ts#L41-L91) |
| 5 | `borne` | Borne d'angle | L'ancre : seul le World Offset est reprojeté (proj4 vers WGS84, puis Mercator), et tout le nuage se place autour de lui. | [`src/lib/map-anchor.ts` L22-L46](https://github.com/Popoch39/pointcloud-viewer/blob/e30a105e0cf22c12d500d6bbf06fcd26b12697a1/src/lib/map-anchor.ts#L22-L46) |
| 6 | `nuage` | Nuage de points | Le calque three.js sur le contexte WebGL de MapLibre : positions envoyées telles quelles, matrices composées en doubles à chaque image. | [`src/lib/pointcloud-layer.ts` L25-L121](https://github.com/Popoch39/pointcloud-viewer/blob/e30a105e0cf22c12d500d6bbf06fcd26b12697a1/src/lib/pointcloud-layer.ts#L25-L121) |
| 7 | `roue` | Roue de filtres | Le mode de couleur (RGB, intensité, classification, altitude) : un uniform change, la géométrie reste. | [`src/lib/pointcloud-shaders.ts` L127-L156](https://github.com/Popoch39/pointcloud-viewer/blob/e30a105e0cf22c12d500d6bbf06fcd26b12697a1/src/lib/pointcloud-shaders.ts#L127-L156) |

**Pièce maîtresse : le tambour du miroir.** C'est le cœur du projet tel que son README le présente : le parsing en Rust compilé en WebAssembly. C'est aussi la pièce que l'œil suit, puisque c'est elle qui tourne et tire.

Ne sont pas des pièces de nomenclature : le trépied, l'embase, les vis, le cliquet, le cercle gradué, les tuiles et le jalon. Le cliquet et la couronne illustrent pourtant une vérité du code (l'itérateur ne recule pas), et les tuiles le fond IGN de [`basemap-style.ts` L4-L20](https://github.com/Popoch39/pointcloud-viewer/blob/e30a105e0cf22c12d500d6bbf06fcd26b12697a1/src/lib/basemap-style.ts#L4-L20).

## 5. Scénario d'interaction

### Au repos

Le bake de `sample.laz` est fini et le nuage est rendu en mode RGB : 100 000 points lus, 2 500 dessinés au ton `hi`. La tête est arrêtée, la fente du miroir pointe vers le dernier point de la spirale, sur le bord sud-est, et la carte affleure dans sa fente. Le disque, gravé de ses quatre secteurs, est dans le support de carnet, loquet du côté du support. La roue de filtres est sur RGB, le voyant fixe.

C'est la pose du SVG au repos, de l'image de partage et du mouvement réduit.

### Tour au repos (boucle d'environ 26 s)

Chaque temps rejoue une étape du vrai flux, dans l'ordre du code.

| Temps | Ce qu'on voit | Ce que le code fait |
|---|---|---|
| 0 – 1,2 s | Le nuage s'efface en 0,6 s. La carte ressort de 6 unités puis s'enfonce dans sa fente. Le disque revient au dock, son loquet bascule et ses secteurs s'effacent : il est vierge. | Choix d'un fichier ([`bake-panel.tsx` L55](https://github.com/Popoch39/pointcloud-viewer/blob/e30a105e0cf22c12d500d6bbf06fcd26b12697a1/src/components/bake-panel.tsx#L55)), réglages remis à zéro ([`app.tsx` L20-L27](https://github.com/Popoch39/pointcloud-viewer/blob/e30a105e0cf22c12d500d6bbf06fcd26b12697a1/src/app.tsx#L20-L27)), aiguillage `.laz` → bake ([`use-bake.ts` L78-L87](https://github.com/Popoch39/pointcloud-viewer/blob/e30a105e0cf22c12d500d6bbf06fcd26b12697a1/src/hooks/use-bake.ts#L78-L87)), l'ancien Worker est arrêté et un nouveau démarre ([`use-bake.ts` L49-L76](https://github.com/Popoch39/pointcloud-viewer/blob/e30a105e0cf22c12d500d6bbf06fcd26b12697a1/src/hooks/use-bake.ts#L49-L76)). |
| 1,2 – 2 s | Le voyant clignote, le tambour se met à tourner, la tête reste immobile. | Lecture des octets, initialisation unique du WebAssembly ([`bake-worker.ts` L19-L26](https://github.com/Popoch39/pointcloud-viewer/blob/e30a105e0cf22c12d500d6bbf06fcd26b12697a1/src/workers/bake-worker.ts#L19-L26)), ouverture du LAS, lecture de l'en-tête, du minimum par axe et de l'EPSG ([`lib.rs` L52-L57](https://github.com/Popoch39/pointcloud-viewer/blob/e30a105e0cf22c12d500d6bbf06fcd26b12697a1/webassembly/src/lib.rs#L52-L57), [`crs.rs` L21-L46](https://github.com/Popoch39/pointcloud-viewer/blob/e30a105e0cf22c12d500d6bbf06fcd26b12697a1/webassembly/src/crs.rs#L21-L46)). |
| 2 – 16 s | La tête tourne, d'abord lentement (on suit un point par fente), puis accélère comme un moteur jusqu'à un flou régulier. Le faisceau balaie, la spirale pousse du centre vers le bord au ton `lo`, la spire courante au ton `mid`. Le cliquet claque sur chaque dent de la couronne. | La boucle `for point in reader.points()` : chaque point est recentré sur le minimum par axe, converti en f32, ajouté aux tableaux, et la bbox locale grandit ([`lib.rs` L66-L96](https://github.com/Popoch39/pointcloud-viewer/blob/e30a105e0cf22c12d500d6bbf06fcd26b12697a1/webassembly/src/lib.rs#L66-L96)). |
| 16 – 17,5 s | La tête ralentit et s'arrête sur le dernier point. Le disque tourne sous la pointe de gravure : d'abord le moyeu (l'en-tête), puis les quatre secteurs l'un après l'autre, positions (240°), intensité (40°), RGB (60°), classification (20°). | Dernier appel de progression ([`lib.rs` L97](https://github.com/Popoch39/pointcloud-viewer/blob/e30a105e0cf22c12d500d6bbf06fcd26b12697a1/webassembly/src/lib.rs#L97)), puis écriture du PCBK : l'en-tête de 72 octets et les quatre blocs planaires, dans cet ordre ([`lib.rs` L99-L131](https://github.com/Popoch39/pointcloud-viewer/blob/e30a105e0cf22c12d500d6bbf06fcd26b12697a1/webassembly/src/lib.rs#L99-L131)). |
| 17,5 – 18,5 s | Le disque glisse sur son rail, dans son chariot, du dock au support de carnet, et le loquet bascule. Il change de côté sans être recopié. | Le Worker transfère le buffer au fil principal ([`bake-worker.ts` L31-L33](https://github.com/Popoch39/pointcloud-viewer/blob/e30a105e0cf22c12d500d6bbf06fcd26b12697a1/src/workers/bake-worker.ts#L31-L33)), qui le lit en vues zero-copy ([`baked-pointcloud.ts` L72-L88](https://github.com/Popoch39/pointcloud-viewer/blob/e30a105e0cf22c12d500d6bbf06fcd26b12697a1/src/lib/baked-pointcloud.ts#L72-L88)). |
| 18,5 – 19,5 s | Le disque de bronze de la borne prend un éclat bref (un ton plus clair, sans bleu). Tout le nuage passe du ton `lo` au ton `hi` d'un seul fondu ; le voyant devient fixe. | L'EPSG 2154 est accepté ([`app.tsx` L34](https://github.com/Popoch39/pointcloud-viewer/blob/e30a105e0cf22c12d500d6bbf06fcd26b12697a1/src/app.tsx#L34)), l'ancre est calculée ([`map-anchor.ts` L22-L46](https://github.com/Popoch39/pointcloud-viewer/blob/e30a105e0cf22c12d500d6bbf06fcd26b12697a1/src/lib/map-anchor.ts#L22-L46)), puis three.js envoie toutes les positions au GPU en une fois et le rendu suit la carte ([`pointcloud-layer.ts` L58-L97](https://github.com/Popoch39/pointcloud-viewer/blob/e30a105e0cf22c12d500d6bbf06fcd26b12697a1/src/lib/pointcloud-layer.ts#L58-L97)). |
| 19,5 – 26 s | La roue de filtres saute de cran toutes les 1,6 s : RGB → intensité → classification → altitude → RGB. À chaque cran, tout le nuage change de tons d'un coup, sans que la spirale bouge. | Changement d'un uniform, sans reconstruire la géométrie ([`pointcloud-shaders.ts` L154-L156](https://github.com/Popoch39/pointcloud-viewer/blob/e30a105e0cf22c12d500d6bbf06fcd26b12697a1/src/lib/pointcloud-shaders.ts#L154-L156), [`pointcloud-layer.ts` L110-L114](https://github.com/Popoch39/pointcloud-viewer/blob/e30a105e0cf22c12d500d6bbf06fcd26b12697a1/src/lib/pointcloud-layer.ts#L110-L114)). |

**Modes de couleur en monochrome.** La palette du site n'a que l'encre, le papier et le bleu, et le bleu est réservé aux pièces. Chaque mode se traduit donc en tons d'encre, calculés avec les formules du dépôt :

- RGB : luminance des couleurs de l'échantillon (`sin t`, `cos t`, `i / 100 000`) ;
- intensité : `i mod 65 536`, mis à l'échelle par le maximum (facteur 1 ici, le maximum valant 65 535) ;
- classification : `i mod 6`, six classes ASPRS (0 à 5) en six tons ;
- altitude : rampe de tons de `z` local, de 0 à 20 m (la palette turbo du shader, rendue en tons).

### Pointeur

- **Viser avec la tête** : la tête vise le pointeur, sans clic ni glisser. Son azimut suit l'angle du pointeur autour de la station, mesuré dans le plan du terrain (le pointeur est ramené au sol par la projection inverse). Le moteur reste embrayé : la tête court vers l'angle visé avec l'élan d'un moteur, accélère, file et freine en arrivant, sans amortissement critique.
  - Faire tourner le pointeur autour de la station **dans le sens de la spirale**, au-delà de l'angle déjà atteint, lit les points suivants : 628 par tour, posés sur la spirale.
  - Le ramener **en sens inverse** fait patiner le cliquet : la tête recule, mais aucun point n'est relu ni effacé, et le compteur ne baisse pas. C'est l'itérateur `reader.points()`, qui ne va que vers l'avant.
  - Quand le pointeur quitte la scène, la tête finit sa course sur son élan, puis le moteur reprend le tour après 2 s d'inactivité.
- **Clic sur la roue de filtres** (une fois le nuage rendu) : mode de couleur suivant. Avant la fin du bake, la roue est bloquée par sa bille, comme les réglages, qui n'apparaissent dans l'app qu'une fois le nuage chargé ([`app.tsx` L43-L46](https://github.com/Popoch39/pointcloud-viewer/blob/e30a105e0cf22c12d500d6bbf06fcd26b12697a1/src/app.tsx#L43-L46)).
- **Clic sur la carte** : nouveau bake depuis zéro (l'ancien Worker est arrêté).
- **Survol d'une pièce** : mise en avant commune, la ligne de nomenclature s'éclaire.

### Toucher

Toucher un point du terrain tourne la tête jusqu'à lui, **en avant seulement** : si le point est derrière l'angle atteint, la tête fait le tour par l'avant et lit les points en chemin. Toucher la roue change de mode, toucher la carte relance. Aucun glisser n'est capté : la page défile librement.

### Clavier (scène focalisée, aucun écouteur global)

| Touche | Effet |
|---|---|
| → | Tourne la tête d'un huitième de tour en avant : 79 points lus |
| Maj + → | Dix tours en avant : 6 283 points |
| ← | Le cliquet patine : la tête recule d'un huitième de tour, rien n'est relu |
| Fin | Finit le bake d'un trait |
| C | Mode de couleur suivant (une fois le nuage rendu) |
| Entrée | Recharge la carte : nouveau bake |
| Tab | Quitte la scène normalement |

### Mouvement réduit et hors écran

En mouvement réduit, la figure reste dans sa pose au repos. Les touches et les clics agissent sans transition : la tête saute à son angle, les points apparaissent d'un coup, la roue change de cran. Hors écran, la boucle s'arrête.

## 6. Chiffres vrais et leur source

Tous les chiffres affichés viennent du code au SHA lu. Ceux qui en sont dérivés le disent, avec leur calcul, refait sans exécuter le code du dépôt.

### Le format PCBK

| Chiffre | Valeur | Source |
|---|---|---|
| En-tête | 72 octets | [`lib.rs` L100](https://github.com/Popoch39/pointcloud-viewer/blob/e30a105e0cf22c12d500d6bbf06fcd26b12697a1/webassembly/src/lib.rs#L100), [`baked-pointcloud.ts` L11](https://github.com/Popoch39/pointcloud-viewer/blob/e30a105e0cf22c12d500d6bbf06fcd26b12697a1/src/lib/baked-pointcloud.ts#L11) |
| Magic et version | `PCBK` (`0x4b424350` en u32 little-endian), version 2 | [`lib.rs` L102-L103](https://github.com/Popoch39/pointcloud-viewer/blob/e30a105e0cf22c12d500d6bbf06fcd26b12697a1/webassembly/src/lib.rs#L102-L103), [`baked-pointcloud.ts` L12-L14](https://github.com/Popoch39/pointcloud-viewer/blob/e30a105e0cf22c12d500d6bbf06fcd26b12697a1/src/lib/baked-pointcloud.ts#L12-L14) |
| Drapeaux d'attributs | RGB = 1, intensité = 2, classification = 4 ; l'échantillon a les trois, soit 7 | [`lib.rs` L10-L12](https://github.com/Popoch39/pointcloud-viewer/blob/e30a105e0cf22c12d500d6bbf06fcd26b12697a1/webassembly/src/lib.rs#L10-L12), [`lib.rs` L99](https://github.com/Popoch39/pointcloud-viewer/blob/e30a105e0cf22c12d500d6bbf06fcd26b12697a1/webassembly/src/lib.rs#L99) |
| Octets par point | 18 = positions f32 × 3 (12) + intensité u16 (2) + RGB u8 × 3 (3) + classification u8 (1) | [`lib.rs` L41-L47](https://github.com/Popoch39/pointcloud-viewer/blob/e30a105e0cf22c12d500d6bbf06fcd26b12697a1/webassembly/src/lib.rs#L41-L47) |
| Ordre des blocs | positions, intensité, RGB, classification : l'intensité passe avant le RGB pour que chaque bloc reste aligné | [`lib.rs` L115-L130](https://github.com/Popoch39/pointcloud-viewer/blob/e30a105e0cf22c12d500d6bbf06fcd26b12697a1/webassembly/src/lib.rs#L115-L130), ADR 0001 |
| Secteurs du disque | en-tête 72 o au moyeu, positions 1 200 000 o (66,7 %, 240°), intensité 200 000 o (11,1 %, 40°), RGB 300 000 o (16,7 %, 60°), classification 100 000 o (5,6 %, 20°) | dérivé des deux lignes ci-dessus pour 100 000 points ; angle = part des 1 800 000 octets de blocs × 360° |
| RGB 16 bits | réduit à 8 bits par `>> 8`, sauf si toutes les valeurs tiennent déjà sur 8 bits | [`lib.rs` L121-L129](https://github.com/Popoch39/pointcloud-viewer/blob/e30a105e0cf22c12d500d6bbf06fcd26b12697a1/webassembly/src/lib.rs#L121-L129) |
| Pas de progression | tous les 500 000 points, plus un dernier appel à la fin | [`lib.rs` L8](https://github.com/Popoch39/pointcloud-viewer/blob/e30a105e0cf22c12d500d6bbf06fcd26b12697a1/webassembly/src/lib.rs#L8), [`lib.rs` L93-L97](https://github.com/Popoch39/pointcloud-viewer/blob/e30a105e0cf22c12d500d6bbf06fcd26b12697a1/webassembly/src/lib.rs#L93-L97) |
| Maximum de points | 4 294 967 295 (`count` en u32), au-delà `TooManyPoints` | [`lib.rs` L54](https://github.com/Popoch39/pointcloud-viewer/blob/e30a105e0cf22c12d500d6bbf06fcd26b12697a1/webassembly/src/lib.rs#L54) |

### Le fichier rejoué : `sample.laz`

| Chiffre | Valeur | Source |
|---|---|---|
| Points | 100 000 | [`generate-sample.rs` L27](https://github.com/Popoch39/pointcloud-viewer/blob/e30a105e0cf22c12d500d6bbf06fcd26b12697a1/webassembly/examples/generate-sample.rs#L27) |
| Spirale | angle `t = i / 100` rad, rayon `0,05 · t` m, altitude `50 + 0,02 · t` m | [`generate-sample.rs` L29-L33](https://github.com/Popoch39/pointcloud-viewer/blob/e30a105e0cf22c12d500d6bbf06fcd26b12697a1/webassembly/examples/generate-sample.rs#L29-L33) |
| Points par tour de tête | 628 (`200 π`) | dérivé de la spirale |
| Tours pour tout le fichier | 159 (`1 000 / 2π` = 159,15) | dérivé de la spirale |
| Écart entre deux spires | 0,31 m (`0,05 · 2π`) | dérivé de la spirale |
| Rayon final | 50 m | dérivé de la spirale |
| CRS | EPSG:2154 (Lambert-93), clé GeoTIFF 3072 | [`generate-sample.rs` L12-L23](https://github.com/Popoch39/pointcloud-viewer/blob/e30a105e0cf22c12d500d6bbf06fcd26b12697a1/webassembly/examples/generate-sample.rs#L12-L23), lue par [`crs.rs` L52-L73](https://github.com/Popoch39/pointcloud-viewer/blob/e30a105e0cf22c12d500d6bbf06fcd26b12697a1/webassembly/src/crs.rs#L52-L73) |
| Station | (651 500, 6 861 000) en Lambert-93, soit 48,847° N, 2,339° E | [`generate-sample.rs` L10-L11](https://github.com/Popoch39/pointcloud-viewer/blob/e30a105e0cf22c12d500d6bbf06fcd26b12697a1/webassembly/examples/generate-sample.rs#L10-L11) ; conversion refaite avec les paramètres de [`epsg-registry.ts` L8-L10](https://github.com/Popoch39/pointcloud-viewer/blob/e30a105e0cf22c12d500d6bbf06fcd26b12697a1/src/lib/epsg-registry.ts#L8-L10) |
| Format LAS | 1.2, format de point 2 (avec couleur), pas de quantification 0,001 m | [`generate-sample.rs` L52-L62](https://github.com/Popoch39/pointcloud-viewer/blob/e30a105e0cf22c12d500d6bbf06fcd26b12697a1/webassembly/examples/generate-sample.rs#L52-L62) |
| World Offset (la borne) | (651 450,21 ; 6 860 950,13 ; 50,00) | minimum par axe des points quantifiés, [`lib.rs` L56](https://github.com/Popoch39/pointcloud-viewer/blob/e30a105e0cf22c12d500d6bbf06fcd26b12697a1/webassembly/src/lib.rs#L56) ; calcul refait |
| Ancre | 48,8468° N, 2,3384° E | World Offset reprojeté, [`map-anchor.ts` L24-L26](https://github.com/Popoch39/pointcloud-viewer/blob/e30a105e0cf22c12d500d6bbf06fcd26b12697a1/src/lib/map-anchor.ts#L24-L26) ; calcul refait |
| Bbox locale | (0, 0, 0) → (99,75 ; 99,59 ; 20,00) m | dérivé de la spirale et de l'offset |
| Taille du PCBK | 1 800 072 octets = 72 + 100 000 × 18, affichée « 1,80 Mo » | [`lib.rs` L100](https://github.com/Popoch39/pointcloud-viewer/blob/e30a105e0cf22c12d500d6bbf06fcd26b12697a1/webassembly/src/lib.rs#L100) ; unités de [`bake-panel.tsx` L18-L23](https://github.com/Popoch39/pointcloud-viewer/blob/e30a105e0cf22c12d500d6bbf06fcd26b12697a1/src/components/bake-panel.tsx#L18-L23) |
| Classes | `i mod 6` : 0 à 5 (jamais classé, non classé, sol, végétation basse, moyenne, haute) | [`generate-sample.rs` L35](https://github.com/Popoch39/pointcloud-viewer/blob/e30a105e0cf22c12d500d6bbf06fcd26b12697a1/webassembly/examples/generate-sample.rs#L35), palette [`pointcloud-shaders.ts` L35-L55](https://github.com/Popoch39/pointcloud-viewer/blob/e30a105e0cf22c12d500d6bbf06fcd26b12697a1/src/lib/pointcloud-shaders.ts#L35-L55) |
| Intensité | `i mod 65 536`, maximum 65 535, facteur d'échelle 1 | [`generate-sample.rs` L34](https://github.com/Popoch39/pointcloud-viewer/blob/e30a105e0cf22c12d500d6bbf06fcd26b12697a1/webassembly/examples/generate-sample.rs#L34), [`pointcloud-shaders.ts` L118-L125](https://github.com/Popoch39/pointcloud-viewer/blob/e30a105e0cf22c12d500d6bbf06fcd26b12697a1/src/lib/pointcloud-shaders.ts#L118-L125) |

### Le viewer

| Chiffre | Valeur | Source |
|---|---|---|
| Modes de couleur | 4 : RGB, intensité, classification, altitude | [`pointcloud-shaders.ts` L10-L17](https://github.com/Popoch39/pointcloud-viewer/blob/e30a105e0cf22c12d500d6bbf06fcd26b12697a1/src/lib/pointcloud-shaders.ts#L10-L17) |
| Palette de classification | 19 classes ASPRS (0 à 18) | [`pointcloud-shaders.ts` L35-L55](https://github.com/Popoch39/pointcloud-viewer/blob/e30a105e0cf22c12d500d6bbf06fcd26b12697a1/src/lib/pointcloud-shaders.ts#L35-L55) |
| Taille des points | 1 à 8 px, 2 px par défaut | [`viewer-settings.tsx` L69-L70](https://github.com/Popoch39/pointcloud-viewer/blob/e30a105e0cf22c12d500d6bbf06fcd26b12697a1/src/components/viewer-settings.tsx#L69-L70), [`app.tsx` L14](https://github.com/Popoch39/pointcloud-viewer/blob/e30a105e0cf22c12d500d6bbf06fcd26b12697a1/src/app.tsx#L14) |
| Cadrage initial | inclinaison 45°, marge 80 px ; inclinaison maximale 80° | [`map-view.tsx` L32](https://github.com/Popoch39/pointcloud-viewer/blob/e30a105e0cf22c12d500d6bbf06fcd26b12697a1/src/components/map-view.tsx#L32), [`map-view.tsx` L44](https://github.com/Popoch39/pointcloud-viewer/blob/e30a105e0cf22c12d500d6bbf06fcd26b12697a1/src/components/map-view.tsx#L44) |
| Tuiles du fond | 256 px, zoom 19 au plus ; une tuile de zoom 19 couvre 50,3 m à la latitude de l'échantillon, donc 2 × 2 tuiles couvrent ses 100 m | [`basemap-style.ts` L14-L15](https://github.com/Popoch39/pointcloud-viewer/blob/e30a105e0cf22c12d500d6bbf06fcd26b12697a1/src/lib/basemap-style.ts#L14-L15) ; calcul `40 075 017 / 2¹⁹ × cos 48,85°` |
| CRS acceptés | Lambert-93 (2154) et les 120 zones UTM WGS84 (326xx, 327xx) | [`epsg-registry.ts` L12-L21](https://github.com/Popoch39/pointcloud-viewer/blob/e30a105e0cf22c12d500d6bbf06fcd26b12697a1/src/lib/epsg-registry.ts#L12-L21) |

**Ce que la figure ne prétend pas.**

- **La durée du bake** n'est jamais affichée. L'app la mesure (`durationMs`) au lieu de la fixer, et la figure rejoue le bake au ralenti.
- **La progression** : avec l'échantillon, la barre de l'app ne bouge qu'une fois, à la fin, puisque 100 000 < 500 000. Le compteur de la figure compte les points de la boucle Rust, pas les messages de progression.
- **Le décimal** : l'app écrit « 1.80 Mo » (`toFixed`), la figure écrit « 1,80 Mo », à la française comme le reste du site.

### Format du relevé

Le relevé est en bas à droite de la carte, en Fragment Mono, avec des espaces fines comme séparateurs de milliers. Il dit toujours le nombre de points lus, puis un état.

| Moment | Relevé |
|---|---|
| Au repos | `100 000 pts · 1,80 Mo · EPSG:2154` |
| Bake | `41 300 / 100 000 pts · tour 65` |
| Écriture | `100 000 pts · PCBK v2 · 1 800 072 o` |
| Transfert et ancre | `100 000 pts · ancre 48,847° N 2,338° E` |
| Rendu, par mode | `100 000 pts · RGB` puis `· intensité`, `· classification`, `· altitude` |
| Cliquet qui patine | `41 300 / 100 000 pts · cliquet` |

## 7. Textes de la fiche

- **Nom de la machine** : Scanner laser sur trépied
- **Accroche** : Un nuage LiDAR lu en Rust compilé en WebAssembly, puis posé sur la carte par three.js : tout se passe dans le *navigateur*.
  - Mot en emphase : « navigateur ».
- **Titre de la figure** : Un tour de tête, 628 points
- **Consigne pointeur** : Visez le terrain : la tête tourne vers le pointeur · clic sur la roue : couleur
- **Consigne toucher** : Touchez le terrain : la tête tourne jusqu'au point · toucher la roue : couleur
- **Relevé au repos** : `100 000 pts · 1,80 Mo · EPSG:2154`
- **Légende** : Le scanner relit `sample.laz`, le fichier d'essai du dépôt : 100 000 points en spirale autour d'une station du 6ᵉ arrondissement, en Lambert-93. Chaque tour de tête lit 628 points. Le miroir, c'est-à-dire le bake Rust compilé en WebAssembly dans un Web Worker, recentre chaque point sur la borne d'angle, le minimum du nuage, pour qu'il reste précis en f32. Le disque reçoit alors le PCBK : 72 octets d'en-tête au moyeu, puis 18 octets par point, en quatre secteurs, un par bloc. Le bake fini, three.js pose tout le nuage d'un coup sur le fond IGN, et la roue en change les couleurs sans toucher à la géométrie. Un point dessiné en représente 40, et l'instrument n'est pas à l'échelle du terrain.
- **Libellé accessible** : Scanner laser sur un trépied haut et fin, planté sur quatre dalles d'orthophoto. Sa tête tourne et son miroir, en bleu, dépose une spirale de points qui se relève vers le bord du terrain ; la tête vise le pointeur, et un point du terrain touché l'attire. Une borne marque l'angle du nuage, un jalon l'angle opposé, et un disque gravé en quatre secteurs, posé sur un support fixé à une jambe, reçoit le fichier cuit. Flèches pour tourner la tête d'un huitième de tour, C pour changer de couleur.
- **Titre SEO** : pointcloud-viewer · nuages LiDAR en Rust, WebAssembly et three.js
- **Description SEO** : Un scanner sur trépied explique pointcloud-viewer : un .laz lu en Rust compilé en WebAssembly dans un Web Worker, puis rendu en three.js sur la carte IGN.

## 8. Notes pour la construction (#25)

- **Nuage** : 2 500 points précalculés au build, dans l'ordre du fichier (un sur 40). Pendant le bake, on les révèle par lots selon l'indice. Les tons des quatre modes sont précalculés aussi, pour que le changement de mode ne soit qu'un échange de classes.
- **Tête** : elle est de révolution pour que sa silhouette ne change pas. Seuls la fente, le tambour (un petit cylindre horizontal), le cran du cercle et l'encoche de carte sont recalculés en tournant. Il reste à trancher, selon le budget (SVG ≤ 250 Ko, mouvement ≤ 20 Ko), entre des poses précalculées et un petit projeteur dans le module de mouvement.
- **Vitesse** : 159 tours en 14 s font plus de 11 tours par seconde, ce qui crénèlerait. La vitesse affichée de la tête est donc plafonnée, et au-delà, la fente et le tambour passent en flou de bougé (les traits de la couronne s'estompent). Le nombre de tours lu dans le relevé reste exact.
- **Faisceau** : une ligne du miroir au point d'impact, terminée par un point. Elle ne traverse aucune jambe : l'azimut 40° et l'emplacement de la jambe avant sont choisis pour cela, et la ligne passe derrière une jambe quand la tête tire de l'autre côté.
- **Câble spiralé** : il est tracé avec `kit/tube.mjs` et ses coquilles de connecteur, et suit le chariot porte-disque sur son rail. L'audit du kit doit finir à zéro (tubes et pièces de révolution présents), disque au dock et au support.
- **Disque** : ses quatre secteurs et son moyeu sont dans le plan du disque, posé à plat ; les angles sont calculés depuis la taille des blocs, pas écrits à la main. Les sillons d'un secteur finissent sur ses deux rayons.
- **Terrain en trame** : les tuiles sont des aplats tonals en pointillé ou en hachure, sans contour gravé ; seuls les joints entre dalles sont des traits. Aucun trait de la carte ne doit rappeler les rainures du plateau cadastral de 06.
- **Visée** : l'angle du pointeur se mesure autour du clou de station, après projection inverse sur le plan du terrain. Hors du terrain, la visée garde le dernier angle valide.
- **Une seule pièce bleue** : le tambour. L'éclat de la borne et le passage du nuage au ton `hi` restent en tons d'encre.
