# Concept : typomaniac — banc de duel

Fiche de concept de l'anatomie du projet 01 (ticket #15, spec #10). Ni géométrie ni code : elle
sert à la revue (#21), puis d'entrée au ticket de construction (#22).

- **Dépôt lu** : [Popoch39/typomaniac](https://github.com/Popoch39/typomaniac), branche par défaut `main`.
- **Commit lu** : `183f5a8de9fce3f371ad9dc2b315071218bfbbeb` (« English Word list version 2 becomes the
  current one, for Solo Runs and Duels »). C'est le SHA de référence de la spec (`183f5a8de9fc`) :
  GitHub n'a pas bougé depuis. Le clone local, qui diverge, n'a pas été lu.
- **Taille** (skill `anatomy`) : « Figure », SVG seul, sans WebGL ni 3D.

Tous les liens ci-dessous sont des permaliens figés sur ce SHA. Racine :
`https://github.com/Popoch39/typomaniac/blob/183f5a8de9fce3f371ad9dc2b315071218bfbbeb/`.

## 1. Ce que le code raconte

typomaniac est un jeu de dactylo multijoueur. Son cœur est le **duel classé** : deux joueurs tapent
le même texte pendant 30 s, au meilleur des trois manches (Bo3), et le vainqueur gagne des TP.

L'idée qui structure tout le code est l'ADR 0003, « Duel serveur-autoritaire en mémoire » :

1. Le navigateur **date** chaque frappe (`at`, en ms depuis le début de la manche), l'applique tout
   de suite à l'écran, puis l'envoie **par lots de 50 ms** sur une WebSocket unique par onglet.
2. Le serveur (Bun + Elysia, un seul process, tout en mémoire) **ne croit pas l'horloge du client
   sur parole**. Il refuse une frappe datée avant le départ, après son arrivée, avant la précédente,
   ou après la fin (30 s, plus 400 ms de tolérance réseau). Le client fautif reçoit un `resync`.
3. Les frappes acceptées sont relayées à l'adversaire (`opponent-keystrokes`), qui les rejoue.
4. À 30,4 s, le serveur **rejoue** les deux journaux de frappes avec le moteur pur
   (`typing-engine`) : le meilleur score gagne la manche, puis la meilleure précision.
5. Deux manches gagnées (ou trois jouées) décident le duel. Une seule issue fait bouger le MMR
   caché (Elo) et les TP visibles (package `ranked`).

Une cadence de plus de 40 frappes acceptées en moins d'une seconde n'est pas humaine : c'est un
forfait.

## 2. La machine

**Banc de duel**, conforme à la ligne de la grille. Aucune contestation : le code raconte
exactement un arbitre central entre deux postes symétriques, reliés par deux liaisons.

Un long banc bas porte, à chaque extrémité, un **clavier** mécanique tourné vers le centre. Au
milieu se dresse la **tour d'arbitrage**, un coffret à fenêtre où l'on voit le **guichet** : un rail
où chaque frappe passe sous quatre volets de contrôle. Deux **câbles** tressés courent dans une
goulotte, du dos de chaque clavier jusqu'au pied de la tour. Sur les joues de la tour, deux paires
de **lampes de manche**. Au-dessus, un **mât** fin porte deux curseurs de rang, un par joueur.

> **Ce qui bouge = ce que ça signifie.** Une touche s'enfonce sur le clavier A, une impulsion
> court le long du câble jusqu'au guichet, les quatre volets la laissent passer ou la renvoient au
> rebut : c'est le serveur qui décide si une frappe datée par le client compte. Puis la lampe qui
> s'allume dit qui a gagné la manche, et le curseur qui grimpe le mât dit ce que le duel rapporte.

### Fiche d'identité visuelle

| Axe | Choix | D'après |
|---|---|---|
| Silhouette | **Large et basse, symétrique** : le banc fait environ 380 unités de long pour 96 de profondeur et 14 de haut, la tour 78 de haut. Seul le mât, fin (6 × 6), dépasse ; l'ensemble reste deux fois plus large que haut à l'écran. | grille |
| Vue | **3/4 classique** : élévation 30°, azimut d'environ 35° qui présente le côté long. Le grand axe du banc reste presque horizontal à l'écran (pente d'environ 15°), A à gauche, B à droite, assez symétriques pour se lire comme un face-à-face. | grille |
| Cadrage et format | Carte **panoramique**, environ 2,1 : 1 (par exemple un viewBox de 900 × 430). La machine occupe 60 % de la carte ; le mât monte dans le ciel libre au-dessus de la tour. | — |
| Mode de dessin | **En fonctionnement**, assemblé, rien d'éclaté ni d'écorché. L'intérieur du guichet se voit par une fenêtre vitrée de la face avant de la tour, avec les parois de l'embrasure dessinées et le contenu découpé par l'ouverture. | grille |
| Caractère du mouvement | **Percussif et discret, en écho** : frappes sèches (ressort raide, petit rebond), impulsions qui glissent à vitesse constante, volets qui claquent (ressort amorti critique, environ 120 ms), lampes qui chauffent (montée de 250 ms comme un filament), curseurs du mât en suivi amorti lent (constante de temps de 400 ms). | grille |
| Geste | **Taper une lettre** : clic ou toucher sur le clavier A, ou une vraie touche quand la scène a le focus. | grille |
| Base | **Pas de base sur pieds, pas de règle graduée.** Le banc est une plinthe de fonte posée à plat, avec une goulotte centrale et deux semelles de clavier. La seule échelle de la figure est celle du mât (24 divisions et Maniac), qui est le classement lui-même. | spec |

### En quoi elle se distingue des cinq autres lignes

| Projet | Sa machine | Ce qui l'oppose au banc de duel |
|---|---|---|
| 02 claude-tmux-notify.nvim | tableau d'annonciateur mural, presque de face | haute et plate, sans profondeur ; le banc est bas, profond, vu de 3/4 |
| 03 claude-status-line | rampe à cadran, vue rasante | une seule aiguille amortie sur une longue rampe ; ici, deux postes symétriques et des frappes sèches |
| 04 pointcloud-viewer | scanner sur trépied, en plongée | haut et grêle au-dessus d'un terrain ; le banc est posé à plat |
| 05 trekker | meuble à fiches, éclaté partiel, 3/4 bas | cube massif et tiroir qui sort ; ici, rien ne s'éclate et la vue est à hauteur classique |
| 06 ma_parcelle | carotte de calques en coupe | colonne verticale écorchée ; ici, horizontal et fermé, vu par une fenêtre |

## 3. Nomenclature

**7 pièces · une seule les compte.** Chaque identifiant est le crochet de pièce dans le SVG. Les
claviers A et B portent le même identifiant : c'est le même code, monté deux fois.

| N° | Identifiant | Pièce | Rôle | Code (au SHA lu) |
|---|---|---|---|---|
| 1 | `socle` | Socle | Bun + Elysia : un seul process porte la file, les duels en mémoire et toutes les routes de l'API. | [`apps/api/src/app.ts` L97-L182](https://github.com/Popoch39/typomaniac/blob/183f5a8de9fce3f371ad9dc2b315071218bfbbeb/apps/api/src/app.ts#L97-L182) |
| 2 | `claviers` | Claviers A et B | Clients React 19 : la frappe est datée, appliquée tout de suite à l'écran, puis mise en lot. | [`apps/frontend/src/stores/duel-store.ts` L792-L823](https://github.com/Popoch39/typomaniac/blob/183f5a8de9fce3f371ad9dc2b315071218bfbbeb/apps/frontend/src/stores/duel-store.ts#L792-L823) |
| 3 | `cables` | Câbles | La WebSocket `/api/duel`, une par onglet : lots de frappes à l'aller, frappes de l'adversaire et resync au retour. | [`apps/api/src/modules/duel/index.ts` L17-L52](https://github.com/Popoch39/typomaniac/blob/183f5a8de9fce3f371ad9dc2b315071218bfbbeb/apps/api/src/modules/duel/index.ts#L17-L52) |
| 4 | `tour` | **Tour d'arbitrage** (pièce maîtresse) | Le duel en cours, en mémoire : reçoit chaque lot, coupe au forfait une cadence inhumaine, juge la manche à 30,4 s et ouvre la suivante 7 s plus tard. | [`apps/api/src/modules/duel/running-duel.ts` L423-L522](https://github.com/Popoch39/typomaniac/blob/183f5a8de9fce3f371ad9dc2b315071218bfbbeb/apps/api/src/modules/duel/running-duel.ts#L423-L522) |
| 5 | `guichet` | Guichet | Les quatre contrôles de date d'une frappe : avant le départ, après son arrivée, hors d'ordre, après la fin. | [`packages/typing-engine/src/acceptance.ts` L21-L68](https://github.com/Popoch39/typomaniac/blob/183f5a8de9fce3f371ad9dc2b315071218bfbbeb/packages/typing-engine/src/acceptance.ts#L21-L68) |
| 6 | `lampes` | Lampes de manche | Le meilleur score gagne la manche, puis la précision ; deux manches gagnées ou trois jouées décident le duel. | [`packages/typing-engine/src/outcome.ts` L21-L67](https://github.com/Popoch39/typomaniac/blob/183f5a8de9fce3f371ad9dc2b315071218bfbbeb/packages/typing-engine/src/outcome.ts#L21-L67) |
| 7 | `mat` | Mât | Les TP du duel, bornés entre 8 et 35 ; montée à 100 TP avec bouclier, descente à 75 TP ; le MMR reste caché. | [`packages/ranked/src/ranked.ts` L164-L206](https://github.com/Popoch39/typomaniac/blob/183f5a8de9fce3f371ad9dc2b315071218bfbbeb/packages/ranked/src/ranked.ts#L164-L206) |

La tour est la seule pièce en bleu au repos : c'est la thèse du projet (ADR 0003). Le guichet est
logé dans la tour mais reste une pièce à part, car il vient d'un autre module (le moteur pur,
partagé par le client et le serveur).

## 4. Pièces dessinées

54 pièces dessinées, en plus des répétitions. Chacune repose sur une autre. Entre crochets, la pièce
de nomenclature dont elle prend le bleu au survol.

### Socle [`socle`]

1. Banc de fonte : plinthe longue (environ 380 × 96 × 14), angles arrondis (r 6), posée à plat.
2. Chanfrein de rive (biseau de 1,2) sur tout le pourtour.
3. Rainure de rive, en retrait de 4 sur les deux longs côtés, qui tourne aux extrémités.
4. Halo au sol sous le banc.
5. Goulotte centrale, creusée dans l'axe sur toute la longueur.
6. Deux capots de goulotte, entre chaque clavier et la tour, percés de fentes fermées.
7. Huit vis de capot (points de 0,5 cerclés).
8. Deux semelles de clavier, incrustées, au contour en creux.
9. Embase de la tour (environ 80 × 70 × 4), avec quatre boulons.
10. Deux passe-câbles en caoutchouc au pied de la tour.
11. Quatre vis d'angle cerclées.
12. Plaque d'identité sur la face avant, la seule gravure de la figure : « bun · elysia », avec trois filets.

### Structure

13. Caisse de la tour, coffret aux arêtes arrondies [`tour`].
14. Chapiteau biseauté qui coiffe la caisse [`tour`].
15. Deux joues latérales, une par joueur, qui portent les lampes [`tour`].
16. Fenêtre du guichet, vitrage en retrait avec les parois de l'embrasure [`guichet`].
17. Cadre de fenêtre et ses quatre vis [`tour`].
18. Coutures de caisse, qui font le tour des angles visibles [`tour`].
19. Mât, tube carré de 6 × 6 [`mat`].
20. Collier d'embase du mât, bride à quatre vis sur le chapiteau [`mat`].
21. Sept bagues de palier, une par Tier (Fer à Diamant, puis Maniac) [`mat`].
22. Deux crémaillères, une par face (A et B), à 24 crans [`mat`].
23. Fleuron Maniac au sommet [`mat`].
24. Fente du contrepoids, sur la face arrière du mât [`mat`].
25. Deux boîtiers de clavier, inclinés vers le joueur [`claviers`].
26. Deux capots de bandeau sur les boîtiers [`claviers`].
27. Deux serre-câbles au dos des claviers [`cables`].
28. Deux boîtes d'envoi au dos des claviers : le lot de 50 ms [`claviers`].
29. Quatre connecteurs de câble, au clavier et à la tour [`cables`].

### Mécanisme

30. 26 touches lettres par clavier, capuchons vierges à cuvette [`claviers`].
31. Deux barres d'espace [`claviers`].
32. Deux touches retour [`claviers`].
33. Deux barres de verrouillage sur leurs colonnettes, qui tombent sur les touches pendant le compte à rebours et la pause [`claviers`].
34. Câbles A et B, tressés (anneaux qui suivent la section), couchés dans la goulotte [`cables`].
35. Rail d'entrée du guichet [`guichet`].
36. Quatre volets de contrôle, un par motif de refus [`guichet`].
37. Quatre pivots de volet [`guichet`].
38. Goulotte de rejet et son bac [`guichet`].
39. Deux compteurs de frappes reçues, petits tambours (le `received` du code) [`tour`].
40. Tambour de temps sur le chapiteau : 0 à 30 s, et un court secteur jusqu'à 30,4 s [`tour`].
41. Index du tambour [`tour`].
42. Deux compteurs de score à quatre chiffres, un par joue [`tour`].
43. Disjoncteur de cadence : levier qui saute au-delà de 40 frappes par seconde [`tour`].
44. Deux curseurs de rang sur les crémaillères [`mat`].
45. Deux verniers de TP sur les curseurs, de 0 à 100 [`mat`].
46. Deux drapeaux de bouclier, qui basculent après une montée [`mat`].
47. Contrepoids du MMR, à peine visible dans la fente [`mat`].

### Commandes

48. Sélecteur de format, bouton moleté à index : un point pour Défi, deux points pour Classé [`tour`].
49. Deux témoins de liaison, un par câble, éteints quand l'adversaire est déconnecté [`cables`].
50. Deux tirettes d'abandon, une par clavier (`leave-duel`) [`claviers`].

### Sujet

51. Jeton de frappe : l'impulsion sur le câble, puis le jeton sous les volets. C'est le seul accent `lit` [`guichet`].
52. Deux bandeaux de texte : le texte de la manche, les lettres tapées encrées, le curseur du joueur plein et celui de l'adversaire creux [`claviers`].
53. Quatre lampes de manche, deux par joueur, avec leur ampoule [`lampes`].
54. Quatre grilles de protection des lampes [`lampes`].

Tons : banc et semelles en `lo`, tour, mât et boîtiers en `mid`, touches et lampes en `hi`. Le
jeton de frappe est le seul accent `lit`. Le bleu appartient à la pièce maîtresse et à la pièce
visée (spec #10).

## 5. Scénario d'interaction

Le visiteur est le joueur A. B est piloté par un journal de frappes scripté, à sa propre cadence.
Tout est calculé par un modèle pur (`model.ts` du module d'anatomie), port fidèle des fonctions
citées : `acceptKeystroke`, `computeScore`, `roundOutcome`, `isDuelDecided`, `tpDelta`, `applyTp`.

### Le flux d'une frappe (rejoué tel quel)

| Étape | Dans la machine | Dans le code |
|---|---|---|
| 1 | La touche s'enfonce, la lettre s'encre aussitôt sur le bandeau de A. | `pressed` date la frappe (`at = now − startsAt`) et l'applique localement : [duel-store.ts L792-L823](https://github.com/Popoch39/typomaniac/blob/183f5a8de9fce3f371ad9dc2b315071218bfbbeb/apps/frontend/src/stores/duel-store.ts#L792-L823) |
| 2 | La frappe tombe dans la boîte d'envoi. Au plus 50 ms après la première, le lot part : plusieurs frappes rapides font une seule impulsion. | `queueKeystroke` et `flush`, `BATCH_MS = 50` : [duel-store.ts L254-L279](https://github.com/Popoch39/typomaniac/blob/183f5a8de9fce3f371ad9dc2b315071218bfbbeb/apps/frontend/src/stores/duel-store.ts#L254-L279) |
| 3 | L'impulsion court le long du câble A jusqu'au pied de la tour. | message `keystrokes`, reçu par la route WebSocket : [duel/index.ts L39-L47](https://github.com/Popoch39/typomaniac/blob/183f5a8de9fce3f371ad9dc2b315071218bfbbeb/apps/api/src/modules/duel/index.ts#L39-L47) |
| 4 | Le jeton passe sous les quatre volets du guichet, un par un. Le compteur de frappes reçues avance, acceptée ou non. | `receive` : [running-duel.ts L490-L522](https://github.com/Popoch39/typomaniac/blob/183f5a8de9fce3f371ad9dc2b315071218bfbbeb/apps/api/src/modules/duel/running-duel.ts#L490-L522), contrôles : [acceptance.ts L21-L46](https://github.com/Popoch39/typomaniac/blob/183f5a8de9fce3f371ad9dc2b315071218bfbbeb/packages/typing-engine/src/acceptance.ts#L21-L46) |
| 5a | Acceptée : une impulsion repart par le câble B, et le curseur creux de A avance sur le bandeau de B. Une lettre fausse est acceptée quand même : le guichet juge la date, pas l'orthographe. | `opponent-keystrokes` : [service.ts L734-L758](https://github.com/Popoch39/typomaniac/blob/183f5a8de9fce3f371ad9dc2b315071218bfbbeb/apps/api/src/modules/duel/service.ts#L734-L758) |
| 5b | Refusée : un volet se ferme, le jeton tombe au rebut, une impulsion `resync` revient par le même câble et le bandeau de l'expéditeur se recale. | `resync` : même plage |
| 5c | Plus de 40 frappes acceptées en moins d'une seconde : le disjoncteur saute, forfait. | `isFlooding` : [running-duel.ts L198-L204](https://github.com/Popoch39/typomaniac/blob/183f5a8de9fce3f371ad9dc2b315071218bfbbeb/apps/api/src/modules/duel/running-duel.ts#L198-L204) |
| 6 | À 30,4 s, l'index du tambour passe le secteur de tolérance : les compteurs de score roulent, une lampe s'allume (aucune sur une manche nulle). | `endRound` : [running-duel.ts L423-L475](https://github.com/Popoch39/typomaniac/blob/183f5a8de9fce3f371ad9dc2b315071218bfbbeb/apps/api/src/modules/duel/running-duel.ts#L423-L475), programmé à `endsAt` : [service.ts L647-L673](https://github.com/Popoch39/typomaniac/blob/183f5a8de9fce3f371ad9dc2b315071218bfbbeb/apps/api/src/modules/duel/service.ts#L647-L673) |
| 7 | Pause de 7 s : les barres de verrouillage tombent sur les deux claviers, une frappe ne part pas. Puis nouveau texte, et les barres remontent. | `pressed` ne fait rien hors de la phase `running` ; `ROUND_BREAK_MS` |
| 8 | Duel décidé : les curseurs du mât glissent, le vernier du gagnant passe 100 et le curseur monte d'un cran, son drapeau de bouclier bascule. | `rateDuel` → `tpDelta` et `applyTp` : [ranked.ts L164-L206](https://github.com/Popoch39/typomaniac/blob/183f5a8de9fce3f371ad9dc2b315071218bfbbeb/packages/ranked/src/ranked.ts#L164-L206) |

L'impulsion est ralentie pour l'œil (environ 350 ms par câble). La figure n'affiche pas de
latence : le relevé donne la date `at`, qui est ce que le serveur contrôle vraiment.

### Pointeur

- Survol d'une touche du clavier A : elle se soulève à peine.
- Clic sur le clavier A : il frappe la **lettre attendue** du texte (les capuchons sont vierges, le
  visiteur n'a pas à viser). Le flux ci-dessus se déroule.
- Clic sur le sélecteur de format : bascule Classé (Bo3, mât actif) ↔ Défi (une manche, mât
  immobile, aucun rang), et relance un duel.
- Survol d'une pièce : elle passe en bleu et sa ligne de nomenclature se surligne (mécanisme commun
  de la spec).

### Toucher

- Toucher le clavier A : même effet que le clic, une lettre attendue par appui.
- Toucher le sélecteur : même bascule.

### Clavier (focus sur la scène, aucun écouteur global)

- Une lettre ou l'espace : une frappe `char` avec ce caractère. Une lettre fausse est acceptée par
  le guichet, mais casse le combo au score, comme dans le jeu.
- Retour arrière : une frappe `backspace`. Ctrl + retour arrière : `deleteWord`. Ce sont les trois
  sortes de frappe du protocole ([model.ts L16-L25](https://github.com/Popoch39/typomaniac/blob/183f5a8de9fce3f371ad9dc2b315071218bfbbeb/apps/api/src/modules/duel/model.ts#L16-L25)).
- Tab sort de la scène normalement.

Dès que le visiteur frappe, le pilote automatique de A s'arrête et le temps du duel passe en temps
réel. Après 5 s sans frappe, le tour reprend là où en est le duel.

### Tour au repos

Un duel classé complet, en vraie cadence, avec un saut avoué par manche pour tenir en une minute
environ. A tape à une Pace de 58 wpm, B à 52 wpm (4,8 et 4,3 caractères par seconde).

| Temps du tour | Moment | Ce qu'on voit |
|---|---|---|
| 0 → 4,5 s | Face-à-face et 3-2-1 | barres de verrouillage baissées, curseurs du mât à Or II 90 TP (A) et Or II 40 TP (B) |
| 4,5 → 10,5 s | Manche 1, de 0 à 6 s | frappes des deux côtés, impulsions, volets |
| 10,5 → 10,9 s | Saut à 26 s | le tambour tourne vite ; les bandeaux avancent du texte tapé entre-temps selon le journal |
| 10,9 → 15,3 s | Manche 1, de 26 à 30,4 s | jugement : A gagne, sa première lampe s'allume |
| 15,3 → 22,3 s | Pause de 7 s | barres baissées, relevé « reprise dans 7 s » |
| 22,3 → 33,1 s | Manche 2, même découpage | une frappe de B datée après son arrivée est refusée, `resync` vers B ; B gagne la manche |
| 33,1 → 40,1 s | Pause de 7 s | — |
| 40,1 → 50,9 s | Manche 3, même découpage | A gagne : 2–1 |
| 50,9 → 54 s | Classement | A : vernier 90 → 100, le curseur monte à Or I, 10 TP, drapeau de bouclier ; B : 40 → 20 TP |
| 54 → 56 s | Retour au repos | fondu des lampes, curseurs ramenés, boucle |

Le saut est visible (le tambour file) et le relevé donne toujours le vrai temps de manche : rien
n'est accéléré, une portion de manche est sautée. Les scores au jugement sont calculés sur les
journaux complets, portion sautée comprise. La frappe refusée de B est le seul refus du tour : en
jeu réel, il naît d'une horloge client en avance ou d'une triche.

### Au repos (pose de départ)

Manche 2 à 18,6 s, A mène 1–0 (sa première lampe allumée). Un jeton est sous le deuxième volet du
guichet, une impulsion à mi-câble A. Barres de verrouillage levées. Curseurs du mât à Or II 90 TP
et Or II 40 TP, verniers à 90 et 40. Le sélecteur est sur Classé.

C'est la pose du SVG au repos, de l'image de partage, du rendu sans JavaScript et du mouvement
réduit. En mouvement réduit, les interactions sont instantanées : la lettre s'encre, le jeton
apparaît accepté au bout du rail, sans trajet.

La figure s'arrête hors écran.

## 6. Chiffres affichés et leur source

| Chiffre | Valeur | Où il se voit | Source |
|---|---|---|---|
| Durée d'une manche | 30 s, en anglais | tambour de temps, relevé | `DUEL_SECONDS`, `DUEL_LANGUAGE` : [service.ts L28-L31](https://github.com/Popoch39/typomaniac/blob/183f5a8de9fce3f371ad9dc2b315071218bfbbeb/apps/api/src/modules/duel/service.ts#L28-L31) |
| Tolérance réseau en fin de manche | 400 ms (jugement à 30,4 s) | secteur du tambour | `END_TOLERANCE_MS` et `endsAt` : [running-duel.ts L33-L35](https://github.com/Popoch39/typomaniac/blob/183f5a8de9fce3f371ad9dc2b315071218bfbbeb/apps/api/src/modules/duel/running-duel.ts#L33-L35), [L253-L257](https://github.com/Popoch39/typomaniac/blob/183f5a8de9fce3f371ad9dc2b315071218bfbbeb/apps/api/src/modules/duel/running-duel.ts#L253-L257) |
| Pause entre deux manches | 7 s | barres de verrouillage, relevé | `ROUND_BREAK_MS` : [running-duel.ts L37-L38](https://github.com/Popoch39/typomaniac/blob/183f5a8de9fce3f371ad9dc2b315071218bfbbeb/apps/api/src/modules/duel/running-duel.ts#L37-L38) |
| Cadence de forfait | plus de 40 frappes en moins de 1 s | disjoncteur | `MAX_KEYSTROKES_PER_SECOND`, `isFlooding` : [running-duel.ts L40-L41](https://github.com/Popoch39/typomaniac/blob/183f5a8de9fce3f371ad9dc2b315071218bfbbeb/apps/api/src/modules/duel/running-duel.ts#L40-L41), [L198-L204](https://github.com/Popoch39/typomaniac/blob/183f5a8de9fce3f371ad9dc2b315071218bfbbeb/apps/api/src/modules/duel/running-duel.ts#L198-L204) |
| Manches à gagner, manches au plus | 2 et 3 en Classé, 1 et 1 en Défi | lampes, sélecteur | `RANKED_ROUNDS_TO_WIN`, `CHALLENGE_ROUNDS_TO_WIN` : [service.ts L33-L36](https://github.com/Popoch39/typomaniac/blob/183f5a8de9fce3f371ad9dc2b315071218bfbbeb/apps/api/src/modules/duel/service.ts#L33-L36) ; `maxRounds = 2 × n − 1` : [outcome.ts L61-L63](https://github.com/Popoch39/typomaniac/blob/183f5a8de9fce3f371ad9dc2b315071218bfbbeb/packages/typing-engine/src/outcome.ts#L61-L63) |
| Qui gagne la manche | score, puis précision ; sinon nulle | lampes | `roundOutcome` : [outcome.ts L21-L23](https://github.com/Popoch39/typomaniac/blob/183f5a8de9fce3f371ad9dc2b315071218bfbbeb/packages/typing-engine/src/outcome.ts#L21-L23) |
| Face-à-face et compte à rebours | 4,5 s (1,5 s puis 3-2-1) | barres baissées au début du tour | `COUNTDOWN_MS` : [service.ts L41-L42](https://github.com/Popoch39/typomaniac/blob/183f5a8de9fce3f371ad9dc2b315071218bfbbeb/apps/api/src/modules/duel/service.ts#L41-L42) |
| Lot d'envoi | toutes les 50 ms au plus | boîte d'envoi, impulsions | `BATCH_MS` : [duel-store.ts L213-L214](https://github.com/Popoch39/typomaniac/blob/183f5a8de9fce3f371ad9dc2b315071218bfbbeb/apps/frontend/src/stores/duel-store.ts#L213-L214) |
| Motifs de refus | avant le départ, après son arrivée, hors d'ordre, après la fin | quatre volets, relevé | `RejectReason` et `rejectReason` : [acceptance.ts L10-L46](https://github.com/Popoch39/typomaniac/blob/183f5a8de9fce3f371ad9dc2b315071218bfbbeb/packages/typing-engine/src/acceptance.ts#L10-L46) |
| Score | lettres + espace × multiplicateur ; ×2 au 5ᵉ mot sans faute, ×3 au 10ᵉ, ×4 au 15ᵉ ; Burst (×2) à 1,2 fois la Pace, mots de 4 lettres et plus | compteurs de score | `comboSteps`, `maxMultiplier`, `burstMargin`, `burstMinLetters` : [score.ts L23-L32](https://github.com/Popoch39/typomaniac/blob/183f5a8de9fce3f371ad9dc2b315071218bfbbeb/packages/typing-engine/src/score.ts#L23-L32), règle : [L46-L114](https://github.com/Popoch39/typomaniac/blob/183f5a8de9fce3f371ad9dc2b315071218bfbbeb/packages/typing-engine/src/score.ts#L46-L114) |
| Pace | médiane des 10 derniers duels, 50 wpm sans duel | cadence des pilotes A (58) et B (52) | `paceOf` : [pace.ts L4-L18](https://github.com/Popoch39/typomaniac/blob/183f5a8de9fce3f371ad9dc2b315071218bfbbeb/packages/typing-engine/src/pace.ts#L4-L18) ; `defaultPace` : [score.ts L34-L35](https://github.com/Popoch39/typomaniac/blob/183f5a8de9fce3f371ad9dc2b315071218bfbbeb/packages/typing-engine/src/score.ts#L34-L35) |
| TP d'un duel | +20 / −20 entre MMR égaux, bornés entre 8 et 35 | vernier, relevé de fin | `BASE_TP`, `MIN_TP`, `MAX_TP` : [ranked.ts L44-L49](https://github.com/Popoch39/typomaniac/blob/183f5a8de9fce3f371ad9dc2b315071218bfbbeb/packages/ranked/src/ranked.ts#L44-L49) ; `tpDelta` : [L164-L185](https://github.com/Popoch39/typomaniac/blob/183f5a8de9fce3f371ad9dc2b315071218bfbbeb/packages/ranked/src/ranked.ts#L164-L185) |
| Montée et descente | 100 TP par division, montée avec bouclier, descente à 75 TP | curseur, drapeau | `DIVISION_TP`, `DEMOTED_TP` : [ranked.ts L58-L61](https://github.com/Popoch39/typomaniac/blob/183f5a8de9fce3f371ad9dc2b315071218bfbbeb/packages/ranked/src/ranked.ts#L58-L61) ; `applyTp` : [L187-L206](https://github.com/Popoch39/typomaniac/blob/183f5a8de9fce3f371ad9dc2b315071218bfbbeb/packages/ranked/src/ranked.ts#L187-L206) |
| Échelle du mât | 6 Tiers × 4 divisions = 24 crans, puis Maniac | crémaillères, bagues, fleuron | `DIVISION_TIERS`, `TIERS`, `DIVISIONS` : [ranked.ts L3-L13](https://github.com/Popoch39/typomaniac/blob/183f5a8de9fce3f371ad9dc2b315071218bfbbeb/packages/ranked/src/ranked.ts#L3-L13) ; `MANIAC_STEP` : [L63-L66](https://github.com/Popoch39/typomaniac/blob/183f5a8de9fce3f371ad9dc2b315071218bfbbeb/packages/ranked/src/ranked.ts#L63-L66) |
| MMR | jamais affiché (contrepoids sans chiffre) | fente du mât | ADR 0008 ; `rankedOf` ne renvoie que le rang : [running-duel.ts L190-L192](https://github.com/Popoch39/typomaniac/blob/183f5a8de9fce3f371ad9dc2b315071218bfbbeb/apps/api/src/modules/duel/running-duel.ts#L190-L192) |

### Le calcul du classement du tour, vérifié

A et B sont en Or II avec un MMR de 1 100, celui qu'attend Or II (400 + 14 × 50, `expectedMmr` :
[ranked.ts L160](https://github.com/Popoch39/typomaniac/blob/183f5a8de9fce3f371ad9dc2b315071218bfbbeb/packages/ranked/src/ranked.ts#L160)).

- Base Elo : 2 × 20 × (1 − 0,5) = +20 pour A, 2 × 20 × (0 − 0,5) = −20 pour B. Rattrapage :
  (1 100 − 1 100) × 0,1 = 0. Bornes respectées : +20 et −20.
- A : 90 + 20 = 110 ≥ 100, donc cran 15 = Or I, 110 − 100 = 10 TP, bouclier levé.
- B : 40 − 20 = 20 TP, reste en Or II, sans bouclier.
- Le MMR bouge aussi (1 116 et 1 084, K = 32), mais ne se voit pas : seul le contrepoids glisse
  dans la fente, sans chiffre.

### Le texte des bandeaux

Le texte de chaque manche est tiré par l'algorithme du moteur (`generateText`, mulberry32, liste
anglaise v2 pondérée : [text.ts L73-L108](https://github.com/Popoch39/typomaniac/blob/183f5a8de9fce3f371ad9dc2b315071218bfbbeb/packages/typing-engine/src/text.ts#L73-L108)).
Le ticket de construction calcule une fois trois textes (une graine par manche, toutes différentes
comme `#nextSeed`) et les recopie dans le modèle, avec les graines notées à côté.

## 7. Textes de la fiche

- **Accroche** : Deux claviers face à une tour : chaque lettre est datée chez le joueur, mais c'est
  le serveur qui *tranche*.
- **Nom de la machine** : Banc de duel
- **Titre de la figure** : Banc de duel à tour d'arbitrage
- **Consigne pointeur** : Cliquez le clavier A ou tapez une lettre : elle file vers la tour.
- **Consigne toucher** : Touchez le clavier A : chaque appui envoie une lettre à la tour.
- **Format du relevé** :
  - en manche : `manche {n}/{max} · {t} s · A {a}–{b} B`, avec `{t}` à une décimale et virgule
    française ;
  - juste après une frappe, pendant 1,2 s, le dernier segment devient `« {c} » acceptée à {at} ms`
    ou `refusée : {motif}`, le motif parmi « avant le départ », « datée après son arrivée »,
    « hors d'ordre », « après la fin » ;
  - en pause : `pause · reprise dans {s} s` ;
  - au forfait : `forfait : plus de 40 frappes en 1 s` ;
  - en fin de duel : `fin · A gagne 2–1 · +20 TP`, puis `Or II → Or I · bouclier` ;
  - en Défi : `défi · {t} s · A {a}–{b} B`, et `fin · A gagne` sans TP.
- **Relevé au repos** : `manche 2/3 · 18,6 s · A 1–0 B`
- **Légende** : Chaque frappe part datée du clavier, par lots de 50 ms. La tour la refuse si sa date
  précède le départ, suit son arrivée, recule, ou dépasse les 30 s de la manche (400 ms de
  tolérance). Elle juge la manche au score puis à la précision, et le premier à deux manches
  gagnées fait bouger les TP ; le MMR, lui, reste caché.
- **Libellé accessible** : Banc de duel en vue isométrique : deux claviers aux extrémités d'un long
  banc, reliés par deux câbles à une tour d'arbitrage centrale. Par la fenêtre de la tour, un
  guichet à quatre volets contrôle la date de chaque frappe. Sur ses côtés, deux paires de lampes
  comptent les manches gagnées, et un mât porte le rang de chaque joueur.
- **Titre SEO** : typomaniac — banc de duel, serveur autoritaire en WebSocket · Louis Pocheron
- **Description SEO** : Anatomie de typomaniac, jeu de dactylo en duel : clients React 19,
  WebSocket et serveur Bun + Elysia qui date, filtre et juge chaque frappe, en Bo3 classé.

## 8. Notes pour la construction (#22)

- Le modèle est pur et testable : il porte les journaux de frappes scriptés de A et B, et rejoue
  les fonctions citées. Aucun chiffre n'est écrit à la main dans le mouvement.
- Pièces de révolution et câbles : `kit/lathe.mjs` pour les lampes, le bouton moleté, les
  passe-câbles et les connecteurs ; `kit/tube.mjs` avec `rings` pour la tresse des câbles. Audit du
  kit à zéro.
- Les câbles restent dans la goulotte et remontent à la tour par les passe-câbles, sans croiser le
  guichet. Chaque extrémité finit sur un connecteur.
- Le contenu du guichet est masqué deux fois : dans son plan, et par l'ouverture de la fenêtre.
- Le texte des bandeaux et les chiffres des compteurs sont des affichages de machine : ils tiennent
  dans leur fenêtre à leur chaîne la plus large et y sont découpés. Le bandeau de B est vu de dos,
  dans son plan : le visiteur est A.
- Budget de la spec : SVG au repos ≤ 250 Ko brut, mouvement ≤ 20 Ko minifié.
