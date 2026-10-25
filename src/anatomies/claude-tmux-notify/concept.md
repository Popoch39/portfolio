# Concept — claude-tmux-notify.nvim

Fiche de concept de l'anatomie du projet 02, avant tout dessin (ticket #16, spec #10). Elle sert à la revue (#21), puis d'entrée à la construction (#23).

- **Dépôt** : [Popoch39/claude-tmux-notify.nvim](https://github.com/Popoch39/claude-tmux-notify.nvim), branche par défaut `master`.
- **Commit lu** : `12ae624f6c095e66e4f494b253e16612499fe32f` (identique à la référence de la spec, `12ae624f6c09`).
- **Slug** : `claude-tmux-notify` · fiche `/projets/claude-tmux-notify/`.
- **Taille** : « Figure » du skill `anatomy`, SVG seul, 50 pièces dessinées (pièces distinctes, quantités groupées).

Le dépôt tient en deux fichiers de code : `lua/claude-tmux-notify/init.lua` (309 lignes) et `scripts/tmux-notify.sh` (60 lignes). Tous les liens ci-dessous sont figés sur le commit lu.

## Décisions de la revue (#21)

Validé par Louis le 2026-10-25. Les renvois visent la page de revue : ressemblances R1 à R15, incohérences I1 et I2, décisions ouvertes n° 1 à 39 (n° 8 à 13 pour cette fiche).

- **Fiche à cordon au lieu du chariot (R9).** La tige verticale, ses paliers, le chariot à bagues, le doigt et la barre à crans répétaient le chariot sur mât de 06 (et celui de 01). Le curseur de premier plan devient une fiche à cordon de standard téléphonique : acquitter, c'est brancher la fiche dans le jack de la fenêtre, et la fiche branchée retient le volet. Le geste, les consignes, le libellé accessible et le tour suivent. Identifiant `curseur` → `cordon`.
- **Format (R13).** Portrait moins étroit, environ 0,80 : viewBox de 480 × 600 ; la rosace et le câble donnent la largeur.
- **Vue gardée (R14).** Azimut 18°, élévation 16° : c'est 03 qui descend à 12°.
- **Ce qui reste à 02 seul.** La bande sur deux bobines (R4 : 04 passe à un disque), l'échappement à roue et ancre (R7 : 03 passe à une croix de Malte), le volet qui tombe (R6 : 03 n'a plus de volet, 01 a des bras de barrière).
- **Plaque du fabricant retirée (R15).** Elle ne faisait que répéter le nom du projet. Le dessin n'a plus d'inscription gravée.
- **Comptes en pièces distinctes (I1).** Une ligne par pièce, quantités groupées, comme les autres fiches : 74 (quantités comprises) → 50 entrées numérotées, après R9 et R15.
- **Décisions n° 8 à 13.** L'option de la fiche est retenue partout : licence du volet tombé jusqu'à l'acquittement, retour automatique sur `1:nvim` deux secondes après (c'est désormais la fiche qui revient dans son jack), vue de face hors de la plage conseillée par le skill, exemples de fenêtres et longueurs de lignes, niveau `warn` / `info` écrit dans le relevé à la place des icônes, bornier des deux crochets dessiné hors nomenclature.

## 1. Le vrai flux

1. Claude Code, dans une autre fenêtre tmux, déclenche son crochet `Notification` (il attend une réponse) ou `Stop` (il a fini son tour).
2. Le script `tmux-notify.sh` lit l'événement sur son entrée standard, demande à tmux la fenêtre où il tourne (`#{window_id}|#{window_index}:#{window_name}|#{session_name}`), et ajoute une ligne JSON de cinq champs au bout du fichier `~/.cache/claude-tmux-notify.jsonl`. Il sort toujours en 0, pour ne jamais bloquer Claude.
3. Dans Neovim, un `fs_poll` de libuv surveille le fichier toutes les 1000 ms. Quand la taille dépasse le décalage mémorisé, le plugin lit les octets nouveaux, avance le décalage et décode chaque ligne.
4. Pour chaque événement, le plugin demande à tmux si la fenêtre de Claude est au premier plan (`#{window_active}` vaut `1`). Si oui, il se tait. Sinon il lève un toast titré `Claude — <index>:<nom>`, en niveau `warn` pour `Notification` et `info` pour `Stop`, par Snacks s'il est là, sinon par `vim.notify`.
5. Au démarrage, le plugin tronque le fichier s'il dépasse 1 Mio et se place à sa fin : aucun vieux toast en rafale.

Ce que le plugin ne fait pas : il ne garde aucun état par fenêtre (sa seule mémoire est le décalage) et ne gère pas l'effacement du toast, laissé au notifieur.

## 2. La machine

**Tableau d'annonciateur à volets**, comme ceux des standards téléphoniques et des offices d'hôtel : un meuble mural en bois, une colonne de cinq volets (un par fenêtre tmux), chacun avec son jack, une fiche à cordon branchée dans le jack de la fenêtre au premier plan, une sonnette sur le chapeau. À droite, une colonne au capot déposé montre d'où viennent les appels : une bande perforée 8 pistes, perforée par le crochet et lue par un échappement qui bat la seconde.

**Ce qui bouge = ce que ça signifie.** Un volet qui tombe, c'est une session Claude Code qui vous attend (ou qui a fini) dans une autre fenêtre tmux, et Neovim qui lève son toast ; brancher la fiche dans le jack de cette fenêtre, ce qui relève son volet, c'est aller voir cette fenêtre.

Les mouvements secondaires disent le reste du flux, chacun une seule chose :

| Ce qui bouge | Ce que ça signifie |
|---|---|
| Le perforateur frappe une rangée de trous, la bande avance | le crochet ajoute une ligne au fichier de cache (un octet = une rangée) |
| Le bras danseur descend, la boucle tampon s'allonge | des octets sont écrits mais pas encore lus (`stat.size − state.offset`) |
| L'échappement bat une fois par seconde | le `fs_poll` regarde le fichier toutes les 1000 ms |
| À ce battement, la tête de lecture avale la boucle, le bras remonte | `read_new` lit jusqu'à la fin et avance le décalage |
| La fiche est branchée dans le jack d'une fenêtre, sa pointe verrouille le crochet du volet | cette fenêtre est au premier plan : son volet ne peut pas tomber, le toast est supprimé |
| La sonnette vibre longtemps (trembleur) | toast `warn` : Claude attend une réponse |
| La sonnette frappe un seul coup | toast `info` : Claude a fini son tour |
| Le massicot coupe la bande, à la mise en route seulement | fichier tronqué s'il dépasse 1 Mio |

## 3. Fiche d'identité visuelle

Elle suit sa ligne de la grille sans la contester.

| Axe | claude-tmux-notify.nvim |
|---|---|
| Machine | tableau d'annonciateur à volets, mural |
| Silhouette | haute et plate, accrochée au mur : planche murale 236 × 420, caisse 196 × 330 sur 36 de profondeur, sonnette au-dessus. Format portrait d'environ 0,80, viewBox de 480 × 600 (R13) : la rosace et son câble, en haut à droite, donnent la largeur |
| Vue | presque de face : azimut 18°, élévation 16° (voir plus bas), gardée par la revue (R14) |
| Mode de dessin | capot déposé : façade nue en fonctionnement, capot de la colonne de bande retiré ; on voit la feuillure et les pattes du capot absent, pas une coupe |
| Caractère du mouvement | sec et mécanique : déclics à la seconde, chutes avec rebond sur butée, vibration de la sonnette. Seule la fiche voyage : elle quitte son jack, suit l'arc de son cordon et s'enfonce d'un coup sec dans le jack visé |
| Geste | acquitter une fenêtre : brancher la fiche dans son jack, ce qui relève son volet et l'y retient |

**La vue.** Dans le kit, la caméra regarde depuis la direction `(cos A, sin A)`. La façade du tableau est le plan y–z, tournée vers +x. Avec un azimut de 18°, elle se présente presque de face : le flanc gauche n'apparaît que sur 36 × sin 18° ≈ 11 unités, juste assez pour lire l'épaisseur de la caisse. Avec une élévation de 16° (et non 30°), la façade garde 96 % de sa hauteur, et le dessus de tout ce qui dépasse se lit : volets tombés, chapeau, corps de la fiche, bobines. Le skill conseille 35° à 60° pour montrer un long côté ; ici, c'est la face qu'il faut montrer, et le kit accepte tout azimut.

**Pas de base par réflexe.** Pas de socle sur pieds ni de règle graduée : le tableau est suspendu à un tasseau à crémaillère. Les seules marques sont les cinq jacks, un par fenêtre, et un repère unique, 1 Mio, sur le palpeur de la bobine réceptrice.

**Ce qui le distingue des cinq autres lignes.**

| Projet | Silhouette | Vue | Mode et mouvement | Geste |
|---|---|---|---|---|
| 01 typomaniac | large et basse | 3/4 classique | porte ouverte ; frappes | taper une lettre |
| **02 claude-tmux-notify** | **haute et plate, murale, portrait** | **presque de face, à hauteur du tableau** | **capot déposé ; chutes, déclics, vibration** | **acquitter une fenêtre : y brancher la fiche** |
| 03 claude-status-line | longue et fine | rasante, le long de la rampe | fenêtre vitrée ; aiguille amortie | faire avancer le temps |
| 04 pointcloud-viewer | haute et grêle | plongée | extérieur pur ; balayage continu | viser avec la tête |
| 05 trekker | cube massif | presque de face, depuis le bas | éclaté partiel, coulissement | tirer un tiroir |
| 06 ma_parcelle | colonne verticale | plongée dans l'écorché | écorché ; descente du carottier | descendre dans les couches |

Seul tableau accroché au mur, seul mouvement discret (tout ou rien, à la seconde), seule pièce qu'on branche : rien n'y coulisse sur un guide, rien ne s'amortit en aiguille. La vue frontale est proche de celle de 05 depuis la revue (R1) : 02 regarde un mur à hauteur d'homme, flanc gauche à peine visible, 05 regarde un meuble posé au sol, flanc droit visible.

## 4. Nomenclature

Sept pièces. Base des liens : `https://github.com/Popoch39/claude-tmux-notify.nvim/blob/12ae624f6c095e66e4f494b253e16612499fe32f/`.

| N° | Identifiant | Pièce | Rôle | Code |
|---|---|---|---|---|
| 1 | `perforateur` | Perforateur | Le crochet Claude Code : lit l'événement, demande à tmux sa fenêtre et perfore une ligne JSON de cinq champs au bout de la bande. Sort toujours en 0. | [`scripts/tmux-notify.sh` L9-L59](https://github.com/Popoch39/claude-tmux-notify.nvim/blob/12ae624f6c095e66e4f494b253e16612499fe32f/scripts/tmux-notify.sh#L9-L59) |
| 2 | `bobine` | Bobine et massicot | Le fichier de cache : à la mise en route, il est tronqué au-delà de 1 Mio, puis la lecture part de sa fin. | [`lua/claude-tmux-notify/init.lua` L149-L162](https://github.com/Popoch39/claude-tmux-notify.nvim/blob/12ae624f6c095e66e4f494b253e16612499fe32f/lua/claude-tmux-notify/init.lua#L149-L162) |
| 3 | `echappement` | Échappement à la seconde | Le `fs_poll` de libuv, qui regarde le fichier toutes les 1000 ms. | [`lua/claude-tmux-notify/init.lua` L164-L170](https://github.com/Popoch39/claude-tmux-notify.nvim/blob/12ae624f6c095e66e4f494b253e16612499fe32f/lua/claude-tmux-notify/init.lua#L164-L170) |
| 4 | `lecture` | Tête de lecture et boucle tampon | Lit les octets au-delà du décalage, avance le décalage et décode chaque ligne JSON. | [`lua/claude-tmux-notify/init.lua` L104-L142](https://github.com/Popoch39/claude-tmux-notify.nvim/blob/12ae624f6c095e66e4f494b253e16612499fe32f/lua/claude-tmux-notify/init.lua#L104-L142) |
| 5 | `cordon` | Fiche à cordon | Demande à tmux si la fenêtre de l'événement est active ; branchée dans le jack de cette fenêtre, la fiche retient son volet. | [`lua/claude-tmux-notify/init.lua` L64-L74](https://github.com/Popoch39/claude-tmux-notify.nvim/blob/12ae624f6c095e66e4f494b253e16612499fe32f/lua/claude-tmux-notify/init.lua#L64-L74) |
| 6 | `volet` | **Volet** (pièce maîtresse) | Le toast : titre `Claude — <fenêtre>`, message de Claude, niveau selon l'événement. | [`lua/claude-tmux-notify/init.lua` L86-L102](https://github.com/Popoch39/claude-tmux-notify.nvim/blob/12ae624f6c095e66e4f494b253e16612499fe32f/lua/claude-tmux-notify/init.lua#L86-L102) |
| 7 | `sonnette` | Sonnette trembleuse | Le notifieur : Snacks s'il est chargé, sinon `vim.notify` au niveau `warn` ou `info`. | [`lua/claude-tmux-notify/init.lua` L76-L84](https://github.com/Popoch39/claude-tmux-notify.nvim/blob/12ae624f6c095e66e4f494b253e16612499fe32f/lua/claude-tmux-notify/init.lua#L76-L84) |

**Pièce maîtresse : le volet.** L'identifiant `volet` porte les cinq volets, qui sont un même mécanisme (`emit`, appelé une fois par événement) : ce sont eux, et eux seuls, qui prennent le bleu au repos.

**Crochets dans le SVG.** `perforateur` : bloc, poinçons, matrice et guide-bande. `bobine` : bobine débitrice, bobine réceptrice, palpeur, massicot et la bande elle-même. `echappement` : roue d'échappement, ancre, balancier à spiral et raquette. `lecture` : tête de lecture, roue d'entraînement, bras danseur, poulie lestée et ressort. `cordon` : les cinq jacks, la fiche, le cordon, le passe-cordon, le ressort de garde et la clé de verrou. `volet` : les cinq volets avec leurs languettes. `sonnette` : timbre, marteau, électro-aimant, armature, vis de contact et sélecteur.

Hors nomenclature, le bornier à deux bornes du chapeau correspond aux deux crochets que pose `:ClaudeTmuxNotifyInstallHook` ([`init.lua` L224-L269](https://github.com/Popoch39/claude-tmux-notify.nvim/blob/12ae624f6c095e66e4f494b253e16612499fe32f/lua/claude-tmux-notify/init.lua#L224-L269)) : une installation unique, pas un temps du flux rejoué.

## 5. Pièces dessinées

50 pièces, comptées en pièces distinctes (I1) : une ligne par pièce, la colonne « Qté » dit combien d'exemplaires on dessine. Tons : socle `lo`, structure et mécanisme `mid`, volets `hi` et en bleu de pièce maîtresse. Unités monde ≈ 1 px ; x sort du mur, y court le long du mur (vers la gauche à l'écran), z monte.

### Socle — fixation murale (7)

| # | Pièce | Qté | Détail |
|---|---|---|---|
| 1 | Planche murale | 1 | 236 × 420 × 8, chanfrein 1,6, rainure périphérique à 4 du bord |
| 2 | Tasseau haut à crémaillère | 1 | biseau visible sur le dessus, au ras du chapeau |
| 3 | Tasseau bas | 1 | cale le pied de la caisse contre la planche |
| 4 | Vis de fixation de la planche | 4 | tête fendue avec rondelle, aux quatre coins |
| 5 | Rosace murale d'arrivée | 1 | en haut à droite, d'où sort le câble « des autres fenêtres » |
| 6 | Câble tressé à deux conducteurs | 1 | de la rosace au bornier, tresse en anneaux qui suivent la section |
| 7 | Pontets de câble | 2 | brident le câble sur la planche, le câble est interrompu sous chacun |

### Structure — caisse (9)

| # | Pièce | Qté | Détail |
|---|---|---|---|
| 8 | Montant gauche | 1 | le flanc visible, 36 de profondeur |
| 9 | Montant droit | 1 | |
| 10 | Chapeau à corniche | 1 | deux moulures empilées, chanfreins qui accrochent la lumière |
| 11 | Plinthe moulurée | 1 | porte le passe-cordon et la clé de verrou |
| 12 | Panneau de façade | 1 | fond de la colonne des volets, rainure à 4 du bord |
| 13 | Meneau | 1 | sépare la colonne des volets de la colonne de bande |
| 14 | Équerre de sonnette | 1 | console sur le chapeau, deux vis |
| 15 | Bornier d'entrée | 1 | deux bornes à écrou moleté, Notification et Stop |
| 16 | Platine de colonne et feuillure du capot déposé | 1 | la feuillure et ses trous de vis disent que le capot a été retiré |

### Mécanisme (29)

Bande et lecture :

| # | Pièce | Qté | Détail |
|---|---|---|---|
| 17 | Bobine débitrice de bande vierge | 1 | flasques ajourés, moyeu à trois rayons |
| 18 | Perforateur | 1 | bloc à huit poinçons et poinçon d'entraînement, frappe une rangée par octet |
| 19 | Matrice et guide-bande | 1 | sous les poinçons |
| 20 | Bande perforée | 1 | 8 pistes et piste d'entraînement ; les trous sont des points |
| 21 | Galet de renvoi | 1 | renvoie la bande vers la boucle |
| 22 | Bras danseur et poulie lestée | 1 | pivote sur la platine ; sa hauteur suit les octets non lus |
| 23 | Ressort de rappel du bras danseur | 1 | spirale coupée en moitiés avant et arrière autour de sa tige |
| 24 | Tête de lecture et son index | 1 | huit palpeurs ; l'index marque le décalage |
| 25 | Roue d'entraînement de lecture | 1 | dents dans la piste d'entraînement |
| 26 | Roue d'échappement et ancre | 1 | trente dents, l'ancre bascule à chaque battement |
| 27 | Balancier à spiral | 1 | une période d'une seconde |
| 28 | Massicot | 1 | lame et contre-lame entre la lecture et la bobine réceptrice |
| 29 | Bobine réceptrice et palpeur | 1 | le palpeur repose sur le diamètre, un seul repère à 1 Mio |

Fiche à cordon (premier plan) :

| # | Pièce | Qté | Détail |
|---|---|---|---|
| 30 | Jack de fenêtre | 5 | douille à collerette vissée dans le panneau, à gauche de chaque enjoliveur, à hauteur du crochet d'armature |
| 31 | Fiche | 1 | corps moleté qu'on saisit, manchon, bague isolante et pointe ; en entrant dans un jack, elle relève le volet et sa pointe verrouille le crochet d'armature. Branchée au repos dans le jack de `1:nvim` |
| 32 | Cordon tressé | 1 | du passe-cordon à la fiche, tresse en anneaux qui suivent la section ; il pend en chaînette le long des jacks, à gauche de la colonne, sans croiser une fenêtre. Tracé avec `kit/tube.mjs` et recalculé pendant le trajet de la fiche, audit du kit à zéro |
| 33 | Passe-cordon | 1 | œillet de laiton dans la plinthe, d'où sort le cordon |
| 34 | Ressort de garde du cordon | 1 | spirale au passe-cordon, coupée en moitiés avant et arrière autour du cordon |

Volets, un bloc par fenêtre tmux (`1:nvim`, `2:api-server`, `3:front`, `4:docs`, `5:infra`) :

| # | Pièce | Qté | Détail |
|---|---|---|---|
| 35 | Enjoliveur et fenêtre chanfreinée | 5 | 52 × 44, quatre vis en coin |
| 36 | Crochet d'armature | 5 | retient le haut du volet ; l'électro-aimant le tire, sauf si la fiche est branchée dans le jack voisin |
| 37 | Carte d'indicateur et voyant de niveau | 5 | lignes de texte libres (le libellé), voyant bicolore plein pour `warn`, annulaire pour `info` |

Sonnette et câblage :

| # | Pièce | Qté | Détail |
|---|---|---|---|
| 38 | Timbre | 1 | dôme Ø 60 au profil lisse, écrou central |
| 39 | Marteau sur lame-ressort | 1 | boule au bout d'une lame fine |
| 40 | Électro-aimant double | 1 | deux bobines sur culasse |
| 41 | Armature | 1 | |
| 42 | Vis de contact et contre-écrou | 1 | l'interrupteur qui fait vibrer le trembleur |
| 43 | Bornes de sonnette | 2 | |
| 44 | Peigne de fils lecture → volets | 1 | cinq fils le long du meneau, chacun finit sur la borne de son volet |
| 45 | Fil commun volets → sonnette | 1 | monte le long du montant droit jusqu'aux bornes |

### Commandes (4)

| # | Pièce | Qté | Détail |
|---|---|---|---|
| 46 | Clé de verrou à levier | 1 | clé de standard sur la plinthe : `suppress_focused`, engagée par défaut |
| 47 | Raquette avance-retard | 1 | sur le balancier, index sur `poll_interval` |
| 48 | Commutateur rotatif marche-arrêt | 1 | moleté, au pied de la colonne : `setup` démarre, `VimLeavePre` arrête |
| 49 | Sélecteur trembleur / coup simple | 1 | petit couteau sur la sonnette, basculé par le niveau de l'événement |

### Sujet (1)

| # | Pièce | Qté | Détail |
|---|---|---|---|
| 50 | Volet à charnière basse | 5 | 46 × 34 × 2, charnon et axe en bas, languette de relevage en haut ; tombe vers le lecteur et repose à plat sur sa butée. Bleu au repos |

Total : 7 + 9 + 29 + 4 + 1 = 50 pièces distinctes. Aucune inscription gravée : la plaque du fabricant est retirée (R15).

## 6. Scénario d'interaction

Tout part de la scène focalisable. La fenêtre `1:nvim` est celle de Neovim : c'est là que le tableau est accroché, et la fiche est branchée dans son jack au repos. Les quatre autres abritent chacune une session Claude Code.

Chaque événement suit le même enchaînement, avec les vrais délais :

1. le perforateur frappe la ligne (140 rangées pour une `Notification` de `2:api-server`) ; la boucle s'allonge d'autant ;
2. la boucle attend le prochain battement de l'échappement, entre 0 et 1000 ms selon la phase ;
3. au battement, la tête avale la boucle, l'index avance, le bras remonte ;
4. si la fiche est branchée dans le jack de la fenêtre, elle retient le volet et rien ne sonne ; sinon le volet tombe et la sonnette vibre (`warn`) ou frappe un coup (`info`).

**Pointeur.**
- Survol d'une fenêtre : le relevé nomme la fenêtre.
- Clic sur une fenêtre au volet levé : la session Claude de cette fenêtre réclame une réponse (`Notification`). Sur `1:nvim`, Claude tourne dans un panneau de la fenêtre active : l'événement est lu mais supprimé, ce qui montre le verrou.
- Clic sur un volet tombé, ou sur son jack : acquitter. La fiche quitte son jack, suit l'arc de son cordon jusqu'à cette fenêtre (vous y passez) et s'y enfonce d'un coup sec ; le volet se relève, la sonnette se tait. Deux secondes plus tard, la fiche revient dans le jack de `1:nvim` (retour dans Neovim).

**Toucher.** Mêmes gestes au doigt : toucher une fenêtre pour appeler, toucher un volet tombé ou son jack pour y brancher la fiche. Pas de survol.

**Clavier** (focus sur la scène, aucun écouteur global) :
- `↑` `↓` ou `1` à `5` : choisir une fenêtre, comme `préfixe` + chiffre dans tmux ; la fenêtre choisie prend un contour de focus ;
- `Entrée` ou `Espace` : appeler depuis la fenêtre choisie (`Notification`), ou l'acquitter si son volet est tombé (la fiche s'y branche) ;
- `F` : la session de la fenêtre choisie termine son tour (`Stop`) ;
- `Tab` sort de la scène normalement.

**Tour au repos** (environ 16 s, en boucle tant que personne ne touche) :
1. 0 s, une seule fois au premier passage : mise en route. Le massicot reste ouvert (fichier sous 1 Mio) et l'index saute à la fin de la bande : l'arriéré est ignoré.
2. 1 s : `3:front` termine son tour (`Stop`, 106 rangées). Au battement suivant, son volet tombe, voyant annulaire, un seul coup de sonnette.
3. 4 s : `2:api-server` attend une permission (`Notification`, 140 rangées). Son volet tombe, voyant plein, la sonnette vibre.
4. 7 s : acquittement de `2:api-server`. La fiche quitte `1:nvim` et se branche dans le jack de `2:api-server` ; le volet se relève.
5. 9 s : `2:api-server`, désormais au premier plan, réclame encore une réponse. La ligne est perforée puis lue, l'index avance, mais la fiche branchée retient le volet : rien ne sonne.
6. 12 s : acquittement de `3:front` (la fiche passe dans son jack), puis retour de la fiche dans le jack de `1:nvim`.

**Mouvement réduit.** Pose au repos immobile, échappement arrêté ; chaque geste donne directement l'état final (volet tombé ou relevé, fiche branchée dans le jack visé), sans trajet, vibration ni rebond. **Hors écran** : tout s'arrête.

**Licence assumée.** Le volet reste tombé jusqu'à l'acquittement. Dans la réalité, c'est le notifieur (Snacks ou `vim.notify`, hors du dépôt) qui efface le toast, et le passage dans la fenêtre est un geste tmux de l'utilisateur, pas du plugin. Ce que le dessin garde vrai : une fois la fenêtre au premier plan, ses nouveaux événements ne font plus de toast.

## 7. Chiffres et sources

Affichés dans le relevé ou portés par le mouvement :

| Chiffre | Valeur | Source |
|---|---|---|
| Période de sondage | 1000 ms | `poll_interval`, [`init.lua` L26](https://github.com/Popoch39/claude-tmux-notify.nvim/blob/12ae624f6c095e66e4f494b253e16612499fe32f/lua/claude-tmux-notify/init.lua#L26), utilisé en [L166](https://github.com/Popoch39/claude-tmux-notify.nvim/blob/12ae624f6c095e66e4f494b253e16612499fe32f/lua/claude-tmux-notify/init.lua#L166) |
| Délai entre la ligne et le toast | 0 à 1000 ms | une période au plus, [`README.md` L161-L162](https://github.com/Popoch39/claude-tmux-notify.nvim/blob/12ae624f6c095e66e4f494b253e16612499fe32f/README.md#L161-L162) |
| Seuil du massicot | 1 048 576 o (1 Mio) | `max_cache_size`, [`init.lua` L27](https://github.com/Popoch39/claude-tmux-notify.nvim/blob/12ae624f6c095e66e4f494b253e16612499fe32f/lua/claude-tmux-notify/init.lua#L27), appliqué en [L155-L159](https://github.com/Popoch39/claude-tmux-notify.nvim/blob/12ae624f6c095e66e4f494b253e16612499fe32f/lua/claude-tmux-notify/init.lua#L155-L159) |
| Décalage de départ | taille du fichier (fin) | [`init.lua` L161-L162](https://github.com/Popoch39/claude-tmux-notify.nvim/blob/12ae624f6c095e66e4f494b253e16612499fe32f/lua/claude-tmux-notify/init.lua#L161-L162) |
| Octets non lus | `stat.size − state.offset` | [`init.lua` L124-L137](https://github.com/Popoch39/claude-tmux-notify.nvim/blob/12ae624f6c095e66e4f494b253e16612499fe32f/lua/claude-tmux-notify/init.lua#L124-L137) |
| Longueur des lignes du tour | 140 o, 106 o, 121 o | dérivé : sortie de `jq -nc` sur les cinq champs ([`tmux-notify.sh` L45-L51](https://github.com/Popoch39/claude-tmux-notify.nvim/blob/12ae624f6c095e66e4f494b253e16612499fe32f/scripts/tmux-notify.sh#L45-L51)), plus le saut de ligne de [L57](https://github.com/Popoch39/claude-tmux-notify.nvim/blob/12ae624f6c095e66e4f494b253e16612499fe32f/scripts/tmux-notify.sh#L57). Lignes ci-dessous |
| Niveaux | `warn` (Notification), `info` (Stop) | [`init.lua` L30-L33](https://github.com/Popoch39/claude-tmux-notify.nvim/blob/12ae624f6c095e66e4f494b253e16612499fe32f/lua/claude-tmux-notify/init.lua#L30-L33) ; repli `info` pour un événement inconnu, [L96](https://github.com/Popoch39/claude-tmux-notify.nvim/blob/12ae624f6c095e66e4f494b253e16612499fe32f/lua/claude-tmux-notify/init.lua#L96) |
| Titre du toast | `Claude — <index>:<nom>` | [`init.lua` L91-L98](https://github.com/Popoch39/claude-tmux-notify.nvim/blob/12ae624f6c095e66e4f494b253e16612499fe32f/lua/claude-tmux-notify/init.lua#L91-L98) ; libellé tmux, [`tmux-notify.sh` L37](https://github.com/Popoch39/claude-tmux-notify.nvim/blob/12ae624f6c095e66e4f494b253e16612499fe32f/scripts/tmux-notify.sh#L37) |
| Test de premier plan | `#{window_active}` vaut `1` | [`init.lua` L69-L73](https://github.com/Popoch39/claude-tmux-notify.nvim/blob/12ae624f6c095e66e4f494b253e16612499fe32f/lua/claude-tmux-notify/init.lua#L69-L73) ; actif par défaut, [L28](https://github.com/Popoch39/claude-tmux-notify.nvim/blob/12ae624f6c095e66e4f494b253e16612499fe32f/lua/claude-tmux-notify/init.lua#L28) |

Les lignes du tour, au format exact du script (`window_id` et `session` sont des exemples ; `2:api-server` et son message viennent de [`README.md` L11-L14](https://github.com/Popoch39/claude-tmux-notify.nvim/blob/12ae624f6c095e66e4f494b253e16612499fe32f/README.md#L11-L14), le message de `Stop` de [`tmux-notify.sh` L24-L31](https://github.com/Popoch39/claude-tmux-notify.nvim/blob/12ae624f6c095e66e4f494b253e16612499fe32f/scripts/tmux-notify.sh#L24-L31)) :

```
{"event":"Notification","window_id":"@2","label":"2:api-server","session":"main","message":"Claude needs your permission to run a command"}   140 o
{"event":"Stop","window_id":"@3","label":"3:front","session":"main","message":"Claude finished its turn"}                                     106 o
{"event":"Notification","window_id":"@4","label":"4:docs","session":"main","message":"Claude is waiting for your input"}                      121 o
```

Portés par le dessin sans être affichés : deux crochets, `Notification` et `Stop` (les deux bornes du bornier, [`init.lua` L251](https://github.com/Popoch39/claude-tmux-notify.nvim/blob/12ae624f6c095e66e4f494b253e16612499fe32f/lua/claude-tmux-notify/init.lua#L251)) ; cinq champs par ligne ; huit pistes, car un octet fait une rangée. Le seuil de 1 Mio tient environ 7 490 lignes de 140 o (dérivé : 1 048 576 / 140).

Les icônes `⏳` et `✅` du code ([L31-L32](https://github.com/Popoch39/claude-tmux-notify.nvim/blob/12ae624f6c095e66e4f494b253e16612499fe32f/lua/claude-tmux-notify/init.lua#L31-L32)) ne passent pas dans le relevé, en Fragment Mono : le niveau, `warn` ou `info`, les remplace, et le voyant de la carte les dessine.

## 8. Textes de la fiche

- **Accroche** : Quand Claude Code vous *attend* dans une autre fenêtre tmux, un toast tombe dans Neovim.
- **Machine** : Tableau d'annonciateur
- **Titre de la figure** : Tableau d'annonciateur à volets
- **Consigne pointeur** : Cliquez une fenêtre pour faire attendre Claude, un volet tombé pour y brancher la fiche
- **Consigne toucher** : Touchez une fenêtre pour faire attendre Claude, un volet tombé pour y brancher la fiche
- **Format du relevé** :
  - au repos : `1:nvim au premier plan · sondage 1000 ms`
  - ligne écrite, pas encore lue : `+140 o non lus · lecture dans 640 ms`
  - toast : `warn · Claude — 2:api-server` ou `info · Claude — 3:front`
  - événement supprimé : `supprimé · 2:api-server au premier plan`
  - après un acquittement : `2:api-server au premier plan`
  - survol : `2:api-server · volet levé` ou `2:api-server · volet tombé`
- **Légende** : Le crochet Notification ou Stop de Claude Code ajoute une ligne JSON au fichier de cache ; toutes les 1000 ms, Neovim lit ce qui dépasse son décalage et lève un toast, sauf si la fenêtre tmux de Claude est déjà au premier plan.
- **Libellé accessible** : Tableau d'annonciateur mural. Cinq volets, un par fenêtre tmux, tombent quand une session Claude Code attend ou a fini ; une bande perforée reçoit les événements, un échappement la lit chaque seconde, une sonnette tinte, et une fiche à cordon, branchée dans le jack de la fenêtre au premier plan, retient son volet. Acquitter une fenêtre, c'est y brancher la fiche. Flèches ou chiffres pour choisir une fenêtre, Entrée pour appeler ou acquitter, F pour une fin de tour.
- **Titre SEO** : claude-tmux-notify.nvim — anatomie d'un toast Neovim pour Claude Code
- **Description SEO** (157 caractères) : Comment claude-tmux-notify.nvim prévient Neovim qu'une session Claude Code attend dans une autre fenêtre tmux : crochet, fichier JSONL, sondage à 1 s, toast.
