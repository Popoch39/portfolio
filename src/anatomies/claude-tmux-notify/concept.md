# Concept — claude-tmux-notify.nvim

Fiche de concept de l'anatomie du projet 02, avant tout dessin (ticket #16, spec #10). Elle sert à la revue (#21), puis d'entrée à la construction (#23).

- **Dépôt** : [Popoch39/claude-tmux-notify.nvim](https://github.com/Popoch39/claude-tmux-notify.nvim), branche par défaut `master`.
- **Commit lu** : `12ae624f6c095e66e4f494b253e16612499fe32f` (identique à la référence de la spec, `12ae624f6c09`).
- **Slug** : `claude-tmux-notify` · fiche `/projets/claude-tmux-notify/`.
- **Taille** : « Figure » du skill `anatomy`, SVG seul, 74 pièces dessinées.

Le dépôt tient en deux fichiers de code : `lua/claude-tmux-notify/init.lua` (309 lignes) et `scripts/tmux-notify.sh` (60 lignes). Tous les liens ci-dessous sont figés sur le commit lu.

## 1. Le vrai flux

1. Claude Code, dans une autre fenêtre tmux, déclenche son crochet `Notification` (il attend une réponse) ou `Stop` (il a fini son tour).
2. Le script `tmux-notify.sh` lit l'événement sur son entrée standard, demande à tmux la fenêtre où il tourne (`#{window_id}|#{window_index}:#{window_name}|#{session_name}`), et ajoute une ligne JSON de cinq champs au bout du fichier `~/.cache/claude-tmux-notify.jsonl`. Il sort toujours en 0, pour ne jamais bloquer Claude.
3. Dans Neovim, un `fs_poll` de libuv surveille le fichier toutes les 1000 ms. Quand la taille dépasse le décalage mémorisé, le plugin lit les octets nouveaux, avance le décalage et décode chaque ligne.
4. Pour chaque événement, le plugin demande à tmux si la fenêtre de Claude est au premier plan (`#{window_active}` vaut `1`). Si oui, il se tait. Sinon il lève un toast titré `Claude — <index>:<nom>`, en niveau `warn` pour `Notification` et `info` pour `Stop`, par Snacks s'il est là, sinon par `vim.notify`.
5. Au démarrage, le plugin tronque le fichier s'il dépasse 1 Mio et se place à sa fin : aucun vieux toast en rafale.

Ce que le plugin ne fait pas : il ne garde aucun état par fenêtre (sa seule mémoire est le décalage) et ne gère pas l'effacement du toast, laissé au notifieur.

## 2. La machine

**Tableau d'annonciateur à volets**, comme ceux des standards téléphoniques et des offices d'hôtel : un meuble mural en bois, une colonne de cinq volets (un par fenêtre tmux), une sonnette sur le chapeau. À droite, une colonne au capot déposé montre d'où viennent les appels : une bande perforée 8 pistes, perforée par le crochet et lue par un échappement qui bat la seconde.

**Ce qui bouge = ce que ça signifie.** Un volet qui tombe, c'est une session Claude Code qui vous attend (ou qui a fini) dans une autre fenêtre tmux, et Neovim qui lève son toast ; le relever, c'est aller voir cette fenêtre.

Les mouvements secondaires disent le reste du flux, chacun une seule chose :

| Ce qui bouge | Ce que ça signifie |
|---|---|
| Le perforateur frappe une rangée de trous, la bande avance | le crochet ajoute une ligne au fichier de cache (un octet = une rangée) |
| Le bras danseur descend, la boucle tampon s'allonge | des octets sont écrits mais pas encore lus (`stat.size − state.offset`) |
| L'échappement bat une fois par seconde | le `fs_poll` regarde le fichier toutes les 1000 ms |
| À ce battement, la tête de lecture avale la boucle, le bras remonte | `read_new` lit jusqu'à la fin et avance le décalage |
| Le curseur se tient devant une fenêtre, son doigt couvre le crochet du volet | cette fenêtre est au premier plan : son volet ne peut pas tomber, le toast est supprimé |
| La sonnette vibre longtemps (trembleur) | toast `warn` : Claude attend une réponse |
| La sonnette frappe un seul coup | toast `info` : Claude a fini son tour |
| Le massicot coupe la bande, à la mise en route seulement | fichier tronqué s'il dépasse 1 Mio |

## 3. Fiche d'identité visuelle

Elle suit sa ligne de la grille sans la contester.

| Axe | claude-tmux-notify.nvim |
|---|---|
| Machine | tableau d'annonciateur à volets, mural |
| Silhouette | haute et plate, accrochée au mur : planche murale 236 × 420, caisse 196 × 330 sur 36 de profondeur, sonnette au-dessus. Format portrait, viewBox d'environ 420 × 600 |
| Vue | presque de face : azimut 18°, élévation 16° (voir plus bas) |
| Mode de dessin | façade nue en fonctionnement, capot de la colonne de bande déposé : on voit la feuillure et les pattes du capot absent, pas une coupe |
| Caractère du mouvement | sec et mécanique : déclics à la seconde, chutes avec rebond sur butée, vibration de la sonnette. Seul le curseur glisse, amorti |
| Geste | acquitter une fenêtre : relever son volet, ce qui amène le curseur de premier plan devant elle |

**La vue.** Dans le kit, la caméra regarde depuis la direction `(cos A, sin A)`. La façade du tableau est le plan y–z, tournée vers +x. Avec un azimut de 18°, elle se présente presque de face : le flanc gauche n'apparaît que sur 36 × sin 18° ≈ 11 unités, juste assez pour lire l'épaisseur de la caisse. Avec une élévation de 16° (et non 30°), la façade garde 96 % de sa hauteur, et le dessus de tout ce qui dépasse se lit : volets tombés, chapeau, chariot du curseur, bobines. Le skill conseille 35° à 60° pour montrer un long côté ; ici, c'est la face qu'il faut montrer, et le kit accepte tout azimut.

**Pas de base par réflexe.** Pas de socle sur pieds ni de règle graduée : le tableau est suspendu à un tasseau à crémaillère. Les seules marques sont les cinq crans du curseur et un repère unique, 1 Mio, sur le palpeur de la bobine réceptrice.

**Ce qui le distingue des cinq autres lignes.**

| Projet | Silhouette | Vue | Mode et mouvement | Geste |
|---|---|---|---|---|
| 01 typomaniac | large et basse | 3/4 classique | en fonctionnement, frappes | taper une lettre |
| **02 claude-tmux-notify** | **haute et plate, murale, portrait** | **presque de face** | **façade nue, capot déposé ; chutes, déclics, vibration** | **acquitter une fenêtre** |
| 03 claude-status-line | longue et fine | rasante | aiguille amortie | faire avancer le temps |
| 04 pointcloud-viewer | haute et grêle | plongée | balayage continu | orienter la tête |
| 05 trekker | cube massif | 3/4 bas | éclaté partiel, coulissement | tirer un tiroir |
| 06 ma_parcelle | colonne verticale | coupe | descente du carottier | descendre dans les couches |

Seul tableau accroché au mur, seule vue frontale, seul mouvement discret (tout ou rien, à la seconde) : rien n'y coulisse en continu, rien ne s'amortit en aiguille.

## 4. Nomenclature

Sept pièces. Base des liens : `https://github.com/Popoch39/claude-tmux-notify.nvim/blob/12ae624f6c095e66e4f494b253e16612499fe32f/`.

| N° | Identifiant | Pièce | Rôle | Code |
|---|---|---|---|---|
| 1 | `perforateur` | Perforateur | Le crochet Claude Code : lit l'événement, demande à tmux sa fenêtre et perfore une ligne JSON de cinq champs au bout de la bande. Sort toujours en 0. | [`scripts/tmux-notify.sh` L9-L59](https://github.com/Popoch39/claude-tmux-notify.nvim/blob/12ae624f6c095e66e4f494b253e16612499fe32f/scripts/tmux-notify.sh#L9-L59) |
| 2 | `bobine` | Bobine et massicot | Le fichier de cache : à la mise en route, il est tronqué au-delà de 1 Mio, puis la lecture part de sa fin. | [`lua/claude-tmux-notify/init.lua` L149-L162](https://github.com/Popoch39/claude-tmux-notify.nvim/blob/12ae624f6c095e66e4f494b253e16612499fe32f/lua/claude-tmux-notify/init.lua#L149-L162) |
| 3 | `echappement` | Échappement à la seconde | Le `fs_poll` de libuv, qui regarde le fichier toutes les 1000 ms. | [`lua/claude-tmux-notify/init.lua` L164-L170](https://github.com/Popoch39/claude-tmux-notify.nvim/blob/12ae624f6c095e66e4f494b253e16612499fe32f/lua/claude-tmux-notify/init.lua#L164-L170) |
| 4 | `lecture` | Tête de lecture et boucle tampon | Lit les octets au-delà du décalage, avance le décalage et décode chaque ligne JSON. | [`lua/claude-tmux-notify/init.lua` L104-L142](https://github.com/Popoch39/claude-tmux-notify.nvim/blob/12ae624f6c095e66e4f494b253e16612499fe32f/lua/claude-tmux-notify/init.lua#L104-L142) |
| 5 | `curseur` | Curseur de premier plan | Demande à tmux si la fenêtre de l'événement est active ; si oui, son doigt retient le volet. | [`lua/claude-tmux-notify/init.lua` L64-L74](https://github.com/Popoch39/claude-tmux-notify.nvim/blob/12ae624f6c095e66e4f494b253e16612499fe32f/lua/claude-tmux-notify/init.lua#L64-L74) |
| 6 | `volet` | **Volet** (pièce maîtresse) | Le toast : titre `Claude — <fenêtre>`, message de Claude, niveau selon l'événement. | [`lua/claude-tmux-notify/init.lua` L86-L102](https://github.com/Popoch39/claude-tmux-notify.nvim/blob/12ae624f6c095e66e4f494b253e16612499fe32f/lua/claude-tmux-notify/init.lua#L86-L102) |
| 7 | `sonnette` | Sonnette trembleuse | Le notifieur : Snacks s'il est chargé, sinon `vim.notify` au niveau `warn` ou `info`. | [`lua/claude-tmux-notify/init.lua` L76-L84](https://github.com/Popoch39/claude-tmux-notify.nvim/blob/12ae624f6c095e66e4f494b253e16612499fe32f/lua/claude-tmux-notify/init.lua#L76-L84) |

**Pièce maîtresse : le volet.** L'identifiant `volet` porte les cinq volets, qui sont un même mécanisme (`emit`, appelé une fois par événement) : ce sont eux, et eux seuls, qui prennent le bleu au repos.

**Crochets dans le SVG.** `perforateur` : bloc, poinçons, matrice et guide-bande. `bobine` : bobine débitrice, bobine réceptrice, palpeur, massicot et la bande elle-même. `echappement` : roue d'échappement, ancre, balancier à spiral et raquette. `lecture` : tête de lecture, roue d'entraînement, bras danseur, poulie lestée et ressort. `curseur` : tige, paliers, chariot, doigt, poignée et levier de verrou. `volet` : les cinq volets avec leurs languettes. `sonnette` : timbre, marteau, électro-aimant, armature, vis de contact et sélecteur.

Hors nomenclature, le bornier à deux bornes du chapeau correspond aux deux crochets que pose `:ClaudeTmuxNotifyInstallHook` ([`init.lua` L224-L269](https://github.com/Popoch39/claude-tmux-notify.nvim/blob/12ae624f6c095e66e4f494b253e16612499fe32f/lua/claude-tmux-notify/init.lua#L224-L269)) : une installation unique, pas un temps du flux rejoué.

## 5. Pièces dessinées

74 pièces, quantités comprises. Tons : socle `lo`, structure et mécanisme `mid`, volets `hi` et en bleu de pièce maîtresse. Unités monde ≈ 1 px ; x sort du mur, y court le long du mur (vers la gauche à l'écran), z monte.

### Socle — fixation murale (11)

| # | Pièce | Qté | Détail |
|---|---|---|---|
| 1 | Planche murale | 1 | 236 × 420 × 8, chanfrein 1,6, rainure périphérique à 4 du bord |
| 2 | Tasseau haut à crémaillère | 1 | biseau visible sur le dessus, au ras du chapeau |
| 3 | Tasseau bas | 1 | cale le pied de la caisse contre la planche |
| 4 | Vis de fixation de la planche | 4 | tête fendue avec rondelle, aux quatre coins |
| 5 | Rosace murale d'arrivée | 1 | en haut à droite, d'où sort le câble « des autres fenêtres » |
| 6 | Câble tressé à deux conducteurs | 1 | de la rosace au bornier, tresse en anneaux qui suivent la section |
| 7 | Pontets de câble | 2 | brident le câble sur la planche, le câble est interrompu sous chacun |

### Structure — caisse (10)

| # | Pièce | Qté | Détail |
|---|---|---|---|
| 8 | Montant gauche | 1 | le flanc visible, 36 de profondeur |
| 9 | Montant droit | 1 | |
| 10 | Chapeau à corniche | 1 | deux moulures empilées, chanfreins qui accrochent la lumière |
| 11 | Plinthe moulurée | 1 | |
| 12 | Panneau de façade | 1 | fond de la colonne des volets, rainure à 4 du bord |
| 13 | Meneau | 1 | sépare la colonne des volets de la colonne de bande |
| 14 | Plaque du fabricant | 1 | quatre vis ; seule inscription gravée du dessin : `claude-tmux-notify` |
| 15 | Équerre de sonnette | 1 | console sur le chapeau, deux vis |
| 16 | Bornier d'entrée | 1 | deux bornes à écrou moleté, Notification et Stop |
| 17 | Platine de colonne et feuillure du capot déposé | 1 | la feuillure et ses trous de vis disent que le capot a été retiré |

### Mécanisme (43)

Bande et lecture :

| # | Pièce | Qté | Détail |
|---|---|---|---|
| 18 | Bobine débitrice de bande vierge | 1 | flasques ajourés, moyeu à trois rayons |
| 19 | Perforateur | 1 | bloc à huit poinçons et poinçon d'entraînement, frappe une rangée par octet |
| 20 | Matrice et guide-bande | 1 | sous les poinçons |
| 21 | Bande perforée | 1 | 8 pistes et piste d'entraînement ; les trous sont des points |
| 22 | Galet de renvoi | 1 | renvoie la bande vers la boucle |
| 23 | Bras danseur et poulie lestée | 1 | pivote sur la platine ; sa hauteur suit les octets non lus |
| 24 | Ressort de rappel du bras danseur | 1 | spirale coupée en moitiés avant et arrière autour de sa tige |
| 25 | Tête de lecture et son index | 1 | huit palpeurs ; l'index marque le décalage |
| 26 | Roue d'entraînement de lecture | 1 | dents dans la piste d'entraînement |
| 27 | Roue d'échappement et ancre | 1 | trente dents, l'ancre bascule à chaque battement |
| 28 | Balancier à spiral | 1 | une période d'une seconde |
| 29 | Massicot | 1 | lame et contre-lame entre la lecture et la bobine réceptrice |
| 30 | Bobine réceptrice et palpeur | 1 | le palpeur repose sur le diamètre, un seul repère à 1 Mio |

Curseur de premier plan :

| # | Pièce | Qté | Détail |
|---|---|---|---|
| 31 | Tige de guidage verticale | 1 | à gauche de la colonne des volets |
| 32 | Paliers de tige | 2 | haut et bas, vissés au panneau |
| 33 | Chariot à deux bagues | 1 | coulisse sur la tige, flèche d'index vers la fenêtre |
| 34 | Doigt de verrou | 1 | s'avance au-dessus du crochet du volet de la fenêtre active |
| 35 | Barre à cinq crans et bille à ressort | 1 | le chariot s'arrête net devant chaque fenêtre |

Volets, un bloc par fenêtre tmux (`1:nvim`, `2:api-server`, `3:front`, `4:docs`, `5:infra`) :

| # | Pièce | Qté | Détail |
|---|---|---|---|
| 36 | Enjoliveur et fenêtre chanfreinée | 5 | 52 × 44, quatre vis en coin |
| 37 | Crochet d'armature | 5 | retient le haut du volet ; l'électro-aimant le tire |
| 38 | Carte d'indicateur et voyant de niveau | 5 | lignes de texte libres (le libellé), voyant bicolore plein pour `warn`, annulaire pour `info` |

Sonnette et câblage :

| # | Pièce | Qté | Détail |
|---|---|---|---|
| 39 | Timbre | 1 | dôme Ø 60 au profil lisse, écrou central |
| 40 | Marteau sur lame-ressort | 1 | boule au bout d'une lame fine |
| 41 | Électro-aimant double | 1 | deux bobines sur culasse |
| 42 | Armature | 1 | |
| 43 | Vis de contact et contre-écrou | 1 | l'interrupteur qui fait vibrer le trembleur |
| 44 | Bornes de sonnette | 2 | |
| 45 | Peigne de fils lecture → volets | 1 | cinq fils le long du meneau, chacun finit sur la borne de son volet |
| 46 | Fil commun volets → sonnette | 1 | monte le long du montant droit jusqu'aux bornes |

### Commandes (5)

| # | Pièce | Qté | Détail |
|---|---|---|---|
| 47 | Poignée moletée du curseur | 1 | celle qu'on saisit pour « aller » dans une fenêtre |
| 48 | Levier de verrou | 1 | sur le chariot : `suppress_focused`, engagé par défaut |
| 49 | Raquette avance-retard | 1 | sur le balancier, index sur `poll_interval` |
| 50 | Commutateur rotatif marche-arrêt | 1 | moleté, au pied de la colonne : `setup` démarre, `VimLeavePre` arrête |
| 51 | Sélecteur trembleur / coup simple | 1 | petit couteau sur la sonnette, basculé par le niveau de l'événement |

### Sujet (5)

| # | Pièce | Qté | Détail |
|---|---|---|---|
| 52 | Volet à charnière basse | 5 | 46 × 34 × 2, charnon et axe en bas, languette de relevage en haut ; tombe vers le lecteur et repose à plat sur sa butée. Bleu au repos |

Total : 11 + 10 + 43 + 5 + 5 = 74.

## 6. Scénario d'interaction

Tout part de la scène focalisable. La fenêtre `1:nvim` est celle de Neovim : c'est là que le tableau est accroché, et le curseur y est au repos. Les quatre autres abritent chacune une session Claude Code.

Chaque événement suit le même enchaînement, avec les vrais délais :

1. le perforateur frappe la ligne (140 rangées pour une `Notification` de `2:api-server`) ; la boucle s'allonge d'autant ;
2. la boucle attend le prochain battement de l'échappement, entre 0 et 1000 ms selon la phase ;
3. au battement, la tête avale la boucle, l'index avance, le bras remonte ;
4. si le curseur est devant la fenêtre, son doigt retient le volet et rien ne sonne ; sinon le volet tombe et la sonnette vibre (`warn`) ou frappe un coup (`info`).

**Pointeur.**
- Survol d'une fenêtre : le relevé nomme la fenêtre.
- Clic sur une fenêtre au volet levé : la session Claude de cette fenêtre réclame une réponse (`Notification`). Sur `1:nvim`, Claude tourne dans un panneau de la fenêtre active : l'événement est lu mais supprimé, ce qui montre le verrou.
- Clic sur un volet tombé : acquitter. Le curseur glisse jusqu'à cette fenêtre (vous y passez), son doigt relève le volet, la sonnette se tait. Deux secondes plus tard, il revient sur `1:nvim` (retour dans Neovim).

**Toucher.** Mêmes gestes au doigt : toucher une fenêtre pour appeler, toucher un volet tombé pour l'acquitter. Pas de survol.

**Clavier** (focus sur la scène, aucun écouteur global) :
- `↑` `↓` ou `1` à `5` : choisir une fenêtre, comme `préfixe` + chiffre dans tmux ; la fenêtre choisie prend un contour de focus ;
- `Entrée` ou `Espace` : appeler depuis la fenêtre choisie (`Notification`), ou l'acquitter si son volet est tombé ;
- `F` : la session de la fenêtre choisie termine son tour (`Stop`) ;
- `Tab` sort de la scène normalement.

**Tour au repos** (environ 16 s, en boucle tant que personne ne touche) :
1. 0 s, une seule fois au premier passage : mise en route. Le massicot reste ouvert (fichier sous 1 Mio) et l'index saute à la fin de la bande : l'arriéré est ignoré.
2. 1 s : `3:front` termine son tour (`Stop`, 106 rangées). Au battement suivant, son volet tombe, voyant annulaire, un seul coup de sonnette.
3. 4 s : `2:api-server` attend une permission (`Notification`, 140 rangées). Son volet tombe, voyant plein, la sonnette vibre.
4. 7 s : acquittement de `2:api-server`. Le curseur y monte, relève le volet.
5. 9 s : `2:api-server`, désormais au premier plan, réclame encore une réponse. La ligne est perforée puis lue, l'index avance, mais le doigt retient le volet : rien ne sonne.
6. 12 s : acquittement de `3:front`, puis retour du curseur sur `1:nvim`.

**Mouvement réduit.** Pose au repos immobile, échappement arrêté ; chaque geste donne directement l'état final (volet tombé ou relevé, curseur à destination), sans vibration ni rebond. **Hors écran** : tout s'arrête.

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
- **Consigne pointeur** : Cliquez une fenêtre pour faire attendre Claude, un volet tombé pour l'acquitter
- **Consigne toucher** : Touchez une fenêtre pour faire attendre Claude, un volet tombé pour l'acquitter
- **Format du relevé** :
  - au repos : `1:nvim au premier plan · sondage 1000 ms`
  - ligne écrite, pas encore lue : `+140 o non lus · lecture dans 640 ms`
  - toast : `warn · Claude — 2:api-server` ou `info · Claude — 3:front`
  - événement supprimé : `supprimé · 2:api-server au premier plan`
  - après un acquittement : `2:api-server au premier plan`
  - survol : `2:api-server · volet levé` ou `2:api-server · volet tombé`
- **Légende** : Le crochet Notification ou Stop de Claude Code ajoute une ligne JSON au fichier de cache ; toutes les 1000 ms, Neovim lit ce qui dépasse son décalage et lève un toast, sauf si la fenêtre tmux de Claude est déjà au premier plan.
- **Libellé accessible** : Tableau d'annonciateur mural. Cinq volets, un par fenêtre tmux, tombent quand une session Claude Code attend ou a fini ; une bande perforée reçoit les événements, un échappement la lit chaque seconde, une sonnette tinte, et un curseur retient le volet de la fenêtre au premier plan. Flèches ou chiffres pour choisir une fenêtre, Entrée pour appeler ou acquitter, F pour une fin de tour.
- **Titre SEO** : claude-tmux-notify.nvim — anatomie d'un toast Neovim pour Claude Code
- **Description SEO** (157 caractères) : Comment claude-tmux-notify.nvim prévient Neovim qu'une session Claude Code attend dans une autre fenêtre tmux : crochet, fichier JSONL, sondage à 1 s, toast.
