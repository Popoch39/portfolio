# Concept : claude-status-line — Rampe à cadran

Fiche de concept de l'anatomie (ticket #17, spec #10). Il n'y a ni géométrie ni code ici. Le document sert à la revue (#21), puis d'entrée à la construction (#24).

## Référence de code

- Dépôt : [Popoch39/claude-status-line](https://github.com/Popoch39/claude-status-line), branche par défaut `main`.
- **Commit lu : `f77fa09f17d4781dbdefbff2542ae951852b67d0`**. C'est celui de la spec (`f77fa09f17d4`).
- Le code tient dans un seul fichier, `statusline.ts` (304 lignes). Autour : `install.sh`, `scripts/build-all.sh` et la CI de release, qui ne servent qu'à la distribution.
- Base des permaliens : `https://github.com/Popoch39/claude-status-line/blob/f77fa09f17d4781dbdefbff2542ae951852b67d0/statusline.ts#Lx-Ly`

## Décisions de la revue (#21)

Validé par Louis le 2026-10-25. Les renvois visent la page de revue : ressemblances R1 à R15, incohérences I1 et I2, décisions ouvertes n° 1 à 39 (n° 14 à 19 pour cette fiche).

- **Capsule de cache au lieu du tiroir (R5).** Le tiroir est la machine et le geste de 05. Le cache devient une capsule vissée sous la tête d'aiguillage, pièce tournée sans glissière, qui garde sa fenêtre témoin et son tampon d'écriture. Identifiant `cartouche-cache` → `capsule-cache`.
- **Plus de volet « — » (R6).** Le volet qui tombe est la pièce maîtresse de 02. Une fenêtre sans pourcentage garde ses dix lames baissées et sa fenêtre de tambour affiche « — ». Les deux volets (anciennes pièces 41 et 42) sont retirés.
- **Croix de Malte au lieu de l'échappement (R7).** La roue d'échappement et l'ancre disaient « période » comme celles de 02. Le volant tourne en continu et entraîne le doigt d'une croix de Malte ; la croix avance d'un cran sec par tour du doigt, soit un rendu de la status line par cran.
- **Élévation 12° (R14).** La vue descend de 16° à environ 12° pour s'écarter de 02, qui garde 16° ; les lames se découpent encore mieux sur le papier. Cela remplace les 16° de la décision n° 18, dont le principe (vue rasante plutôt que 30°) tient.
- **Ce qui reste à 03 seul.** La fenêtre vitrée (R2 : mode de dessin « fenêtre », 01 passe à une porte ouverte), le glisser linéaire (R3 : 04 passe à un geste angulaire), l'amortissement critique (R12), les tambours de reset (R11) et la plaque « v1.0.0 », qui dit la version (R15). Format inchangé, environ 2,7 : 1 (R13).
- **Décisions n° 14 à 19.** L'option de la fiche est retenue partout : `refreshInterval` supposé en secondes et vérifié dans la doc de Claude Code à la construction, entrées d'exemple du README dites dans la légende, format du code plutôt que du README, trois zones de ton sans nouvelle couleur, vue rasante (à 12°, voir R14), cadran à au moins 22 % de la hauteur et recadrage à 110–118 % à 390 px.
- **Comptes.** 64 → 62 pièces dessinées ; nomenclature inchangée, 8 pièces, une seule pièce maîtresse.

## Ce que fait le projet

Claude Code lance la status line et lui passe un JSON sur stdin. Le binaire répond par **une seule ligne**, faite de quatre segments séparés par « · » : modèle, dossier (branche), fenêtre `5h`, fenêtre `sem`. Chaque fenêtre s'écrit comme une barre de 10 cases, un pourcentage coloré et le délai avant reset.

Les limites (`rate_limits`) n'arrivent sur stdin qu'après la première réponse de la session. Avant, le binaire interroge l'API avec le jeton OAuth (1 jeton, 2,5 s au plus), puis se rabat sur un cache disque. Tout se décide à chaque rendu, sans état en mémoire.

## Machine et fiche d'identité visuelle

**Machine : une rampe à cadran.** C'est une longue règle d'instrument, un profilé d'aluminium fin, bridée au chant d'une tablette (la zone de saisie de Claude Code, sous laquelle vit la status line). On la lit de gauche à droite, dans l'ordre où `render()` pousse ses segments :

- une **tête d'aiguillage**, où arrivent les trois sources possibles ;
- les plaques du modèle et du dossier ;
- les **peignes** de la fenêtre 5 h, puis de la fenêtre hebdomadaire, avec leurs tambours de reset ;
- un **cadran** rond à deux aiguilles ;
- un **volant** qui fait avancer le temps.

Deux tiges de pourcentage courent dans la rampe, de l'aiguillage jusqu'au cadran. On les voit par une fenêtre vitrée longitudinale.

**Ce qui bouge = ce que ça signifie.** Quand on tourne le volant, le temps avance. Le volant entraîne une croix de Malte : chacun de ses crans secs est un rendu de la status line, et les tambours décomptent jusqu'au reset. La course de chaque tige est le pourcentage lu. Ses cames lèvent une lame du peigne à chaque dixième arrondi. Les aiguilles amorties portent ce pourcentage sur un cadran à trois zones, aux seuils 50 et 80.

| Axe | Ligne de la grille | Ce que fixe le concept |
|---|---|---|
| Machine | Rampe à cadran | Retenue telle quelle. Le code raconte bien une ligne unique (`Claude Code n'affiche que la première`, L252), lue de gauche à droite, avec un instrument de mesure au bout. |
| Silhouette | longue et fine | Profilé d'environ 640 × 16 × 22 unités, soit un rapport de plus de 25:1. Les seuls reliefs sont le cadran rond à droite, les deux peignes de lames dressées et la tête d'aiguillage à gauche. Format de carte large, viewBox d'environ 880 × 330 (2,7 : 1, gardé par la revue, R13). |
| Vue | rasante, le long de la rampe | Azimut d'environ 70°, élévation d'environ 12° (au lieu des 30° par défaut, et sous les 16° de 02, R14). L'œil frôle le dessus de la rampe depuis le bout du cadran. Les dessus deviennent de minces bandes, et les **lames levées se lisent en silhouette** sur le papier, comme une ligne d'horizon : c'est la raison d'être de cette vue. Cadran, tambours et fenêtre vitrée sont dans le plan de la face avant verticale, bien en vue. |
| Mode | en fonctionnement, instrument de mesure | **Fenêtre vitrée** : instrument de mesure fermé, en fonctionnement. Pas d'éclaté, de coupe, de porte ni de capot : une seule ouverture, la fenêtre vitrée longitudinale sur les tiges (R2). |
| Mouvement | aiguille amortie | Aiguilles à amortissement critique (pas de dépassement, environ 0,6 s pour s'établir), entraînées par un amortisseur à huile visible sous le cadran : c'est le seul amortissement critique de la série (R12). Les lames basculent d'un cran sec, sans rebond. La croix de Malte avance d'un cran sec à chaque rendu, puis reste verrouillée. Les tambours roulent chiffre par chiffre. Le levier d'aiguillage claque sur ses crans. Rythme calme : seul le volant tourne en continu. |
| Geste | faire avancer le temps | Tourner le volant, par glisser au pointeur ou au doigt, ou au clavier. |

**Ce qui la distingue des cinq autres lignes.**

- Typomaniac (banc large, bas et symétrique, en 3/4) : ici, rien de symétrique, et un seul axe très long.
- L'annonciateur (haut, mural, vu de face, volets qui tombent, échappement à la seconde) : ici, les lames se **lèvent** sur le dessus et se lisent en silhouette rasante, pas sur une façade ; aucun volet, et la période est battue par une croix de Malte, pas par une ancre.
- Le scanner (plongée, geste angulaire) : c'est la vue opposée, et ici le glisser est linéaire, comme le temps.
- Le meuble à fiches (cube massif) et la carotte (colonne en coupe) : c'est la silhouette opposée. Le cache n'est pas un tiroir : c'est une capsule vissée, sans glissière.

**Pas de base sur pieds.** La rampe n'a ni pieds ni règle graduée. Elle tient par deux brides en C au chant d'une tablette mince, dont on ne voit qu'une bande. Les seules graduations appartiennent aux instruments : l'échelle de 0 à 100 % du cadran et les 60 crans du volant.

## Nomenclature (8 pièces)

Une seule pièce maîtresse : le **cadran**.

| # | Identifiant | Pièce | Rôle dans la machine | Code (permalien au SHA lu) |
|---|---|---|---|---|
| 1 | `aiguillage` | Tête d'aiguillage | Boisseau rotatif à levier et trois crans : stdin, API, cache. Il choisit d'où viennent les limites à chaque rendu. | [`statusline.ts` L211–L227](https://github.com/Popoch39/claude-status-line/blob/f77fa09f17d4781dbdefbff2542ae951852b67d0/statusline.ts#L211-L227) `resolveRateLimits` |
| 2 | `sonde-api` | Sonde API | Plongeur à ressort avec une bague de temporisation de 2,5 s. Il part demander un jeton et revient avec les en-têtes `anthropic-ratelimit-unified-*`. | [`statusline.ts` L157–L209](https://github.com/Popoch39/claude-status-line/blob/f77fa09f17d4781dbdefbff2542ae951852b67d0/statusline.ts#L157-L209) `readOAuthToken`, `windowFromHeaders`, `fetchFreshRateLimits` |
| 3 | `capsule-cache` | Capsule de cache | Capsule tournée, vissée sous la tête, sans glissière : frappée d'un tampon à chaque écriture, elle montre son contenu par une fenêtre témoin et n'est relue qu'en dernier recours. | [`statusline.ts` L115–L145](https://github.com/Popoch39/claude-status-line/blob/f77fa09f17d4781dbdefbff2542ae951852b67d0/statusline.ts#L115-L145) `CACHE_PATH`, `readCache`, `writeCache`, `hasFreshData` |
| 4 | `rampe` | Rampe | Profilé qui porte les segments dans l'ordre (plaques modèle et dossier, deux fenêtres), séparés par trois goujons « · ». Il sort une seule ligne. | [`statusline.ts` L231–L254](https://github.com/Popoch39/claude-status-line/blob/f77fa09f17d4781dbdefbff2542ae951852b67d0/statusline.ts#L231-L254) `render` |
| 5 | `peignes` | Peignes à dix lames | Un module par fenêtre (`5h`, puis `sem`) : une fente de libellé, un peigne de 10 lames et une fenêtre de tambour. Sans pourcentage, les dix lames restent baissées et la fenêtre de tambour affiche « — ». | [`statusline.ts` L103–L109](https://github.com/Popoch39/claude-status-line/blob/f77fa09f17d4781dbdefbff2542ae951852b67d0/statusline.ts#L103-L109) `windowSegment` |
| 6 | `cadran` ★ | **Cadran à deux aiguilles** (pièce maîtresse) | Échelle de 0 à 100 % en trois zones de ton : sous 50, de 50 à 80, au-delà de 80. Aiguille longue pour 5 h, courte pour la semaine. Il borne, arrondit et juge chaque pourcentage. | [`statusline.ts` L52–L69](https://github.com/Popoch39/claude-status-line/blob/f77fa09f17d4781dbdefbff2542ae951852b67d0/statusline.ts#L52-L69) `colorFor`, `BAR_WIDTH`, `bar` |
| 7 | `tambours` | Tambours de reset | Compteurs à tambours dans la face avant de chaque module. Ils affichent le délai avant reset en jours, en heures-minutes ou en minutes. | [`statusline.ts` L73–L85](https://github.com/Popoch39/claude-status-line/blob/f77fa09f17d4781dbdefbff2542ae951852b67d0/statusline.ts#L73-L85) `fmtReset` |
| 8 | `volant` | Volant du temps et croix de Malte | Volant moleté à manivelle au bout de la rampe. Par un pignon multiplicateur (1 : 60), il fait tourner le doigt d'une croix de Malte, qui avance d'un cran sec par tour du doigt et entraîne l'arbre du temps : un rendu par cran, soit 60 crans par tour de volant. | [`statusline.ts` L280–L285](https://github.com/Popoch39/claude-status-line/blob/f77fa09f17d4781dbdefbff2542ae951852b67d0/statusline.ts#L280-L285) `settings.statusLine` (`refreshInterval: 60`) |

## Pièces dessinées (62)

Vis, crans et graduations ne sont pas des pièces de nomenclature (glossaire), mais ce sont bien des pièces dessinées. Les numéros entre crochets renvoient à la nomenclature. Par groupe : socle 9, structure 17, mécanisme 22, commandes 6, sujet 8.

**Socle : la tablette et ses brides (9).** La rampe n'a pas de base propre.

1. Tablette mince, vue en bande, avec un chanfrein de 0,8.
2. Chant avant de la tablette, en bande plus claire.
3. Rainure du dessus, à 4 du chant.
4. Bride en C gauche.
5. Bride en C droite.
6. Vis de serrage à poignée en T, gauche.
7. Vis de serrage à poignée en T, droite.
8. Patins rotulés sous les deux vis.
9. Vis de fixation de la tablette, quatre points annelés.

**Structure (17)**

10. Profilé de la rampe [4], extrudé et chanfreiné.
11. Rainure en T sur le dessus du profilé [4].
12. Fenêtre vitrée longitudinale sur la face avant, avec son cadre.
13. Joncs de vitre, haut et bas, qui bouclent aux coins du cadre.
14. Embout gauche, avec quatre vis.
15. Corps de la tête d'aiguillage [1].
16. Plaque du modèle [4], dont les filets figurent le texte imprimé.
17. Plaque du dossier [4], avec une étiquette de branche pendante.
18. Trois goujons séparateurs « · » [4].
19. Carter du module 5 h [5].
20. Carter du module semaine [5].
21. Guides de lames, deux peignes de guidage fendus [5].
22. Carter rond du cadran, pièce tournée [6].
23. Lunette du cadran, anneau tourné, avec quatre vis [6].
24. Boîte de la croix de Malte, avec un hublot [8].
25. Paliers de l'arbre du temps : quatre semelles sous la rampe.
26. Plaque gravée « v1.0.0 » sur l'embout droit : la seule inscription du dessin (`VERSION`, L22).

**Mécanisme (22)**

27. Raccord stdin : tube venu de derrière la tablette, avec bride et collier [1].
28. Boisseau rotatif de l'aiguillage [1].
29. Bille et ressort de détente, trois crans [1].
30. Plongeur de la sonde [2].
31. Ressort hélicoïdal de la sonde, coupé en moitiés arrière et avant [2].
32. Bague de temporisation 2,5 s, avec cinq graduations de 0,5 s [2].
33. Capsule de cache : corps tourné vissé sous la tête d'aiguillage, filet visible au collet, sans glissière [3].
34. Fenêtre témoin de la capsule [3].
35. Tampon d'écriture : un marteau qui frappe la capsule à chaque `writeCache` [3].
36. Tige de pourcentage 5 h, avec ses dix cames à 5, 15, …, 95 %.
37. Tige de pourcentage semaine, avec ses dix cames.
38. Dix lames du peigne 5 h, chacune avec son pivot [5].
39. Dix lames du peigne semaine, chacune avec son pivot [5].
40. Ressorts de rappel des lames, en rangée sous les guides [5].
41. Tambours de reset du module 5 h : quatre tambours, pour « 2h14 », dont une face porte « — » pour une fenêtre sans pourcentage [7].
42. Tambours de reset du module semaine, avec la même face « — » [7].
43. Pignons d'entraînement des tambours, sur l'arbre [7].
44. Arbre du temps, sous la rampe [8].
45. Croix de Malte à six fentes, sur l'arbre du temps [8].
46. Plateau menant à doigt et son disque de verrouillage, entraînés par le pignon multiplicateur du volant [8].
47. Crémaillères et pignons qui relient les tiges à l'axe des aiguilles [6].
48. Amortisseur à huile : cylindre, tige et chape sous le cadran [6].

**Commandes (6)**

49. Volant moleté [8].
50. Manivelle et poignée tournante [8].
51. Rayons du volant, quatre bras.
52. Couronne de 60 crans sur la jante du volant, un majeur tous les 15.
53. Index fixe du volant, sur la boîte de la croix de Malte.
54. Levier d'aiguillage à boule [1].

**Sujet : le cadran (8).** C'est la seule partie éclairée.

55. Fond du cadran, dans le plan de la face avant.
56. Graduation de 0 à 100 % : un trait tous les 5, un majeur tous les 10, le zéro en ton fort.
57. Zone de 50 à 80, en ton moyen.
58. Zone au-delà de 80, en ton plein.
59. Aiguille 5 h, longue : l'accent éclairé.
60. Aiguille semaine, courte.
61. Moyeu et contrepoids des aiguilles.
62. Glace bombée du cadran, avec un reflet.

## Vrais chiffres et leur source

Toutes les lignes renvoient à `statusline.ts` au SHA lu.

| Chiffre | Valeur | Source |
|---|---|---|
| Fenêtres lues | `five_hour` et `seven_day`, affichées sous les libellés `5h` et `sem` | L35–L38, L248–L249 |
| Unités reçues | `used_percentage` en %, `resets_at` en epoch Unix (secondes) | L26–L29 |
| Cases de la barre | `BAR_WIDTH = 10` | L62 |
| Bornage | `clamped = max(0, min(100, pct))` | L65 |
| Lames levées | `filled = round(clamped / 100 × 10)` : la lame k se lève dès **10k − 5 %**. Exemples : 68 % donne 7 lames, 41 % en donne 4, 75 % en donne 8. | L66 |
| Pourcentage affiché | `round(clamped)` | L68 |
| Seuils | vert sous 50 %, jaune de 50 à 80 % inclus, rouge au-delà de 80 % (`pct > 80`, `pct >= 50`) | L52–L57 |
| Subtilité des seuils | Le jugement porte sur la valeur brute, l'affichage sur la valeur arrondie : 80,4 % s'affiche « 80% » en rouge. | L64–L68 |
| Délai de reset | 1 jour ou plus : « Nj » (jours entiers). De 1 h à moins de 24 h : « HhMM ». Sous 1 h : « Mm ». Échu : « 0m ». Sans `resets_at`, pas de parenthèse. | L74–L85, L106–L107 |
| Segment d'une fenêtre | `5h ███████░░░ 68% (reset dans 2h14)`. Sans pourcentage : `5h —`. | L103–L109 |
| Séparateur | ` · ` | L251 |
| Une seule ligne | Claude Code n'affiche que la première. | L252 |
| Donnée « fraîche » | `five_hour.used_percentage` présent (la semaine ne compte pas) | L143–L145 |
| Ordre des sources | 1. stdin frais : on écrit le cache, sans réseau. 2. Sinon l'API, puis on écrit le cache. 3. Sinon le cache, ou à défaut stdin tel quel. | L211–L227 |
| Temporisation de la sonde | `FETCH_TIMEOUT_MS = 2500` | L158 |
| Requête de la sonde | `max_tokens: 1`, modèle `claude-opus-4-8`, system prompt « You are Claude Code… » imposé par le jeton d'abonnement | L196–L201, L154–L155 |
| En-têtes lus | `anthropic-ratelimit-unified-{5h,7d}-utilization` (fraction de 0 à 1, × 100) et `-reset` (epoch) | L173–L178 |
| Fichiers | cache `~/.claude/.statusline-cache.json`, jeton `~/.claude/.credentials.json` | L120, L157 |
| Rafraîchissement | `refreshInterval: 60`, `padding: 2` | L283–L284 |
| Version gravée | `1.0.0` | L22 |

**Hypothèses et écarts, énoncés une fois.**

- **Unité de `refreshInterval`.** Le code ne la dit pas. La figure suppose des secondes : un rendu par minute, donc un cran de croix de Malte par minute et 60 par tour de volant. À vérifier dans la documentation de Claude Code au moment de la construction.
- **README et code.** L'exemple du README (`68% (2h14)`) omet le « reset dans » que le code écrit (L107). La figure suit le code.
- **Couleurs.** Vert, jaune et rouge sont des codes ANSI (L43–L50). La palette du site est monochrome avec une seule couleur, le bleu de la pièce maîtresse. Les trois verdicts deviennent donc trois zones de ton sur le cadran, du clair au plein, sans nouvelle couleur.
- **Entrées d'exemple.** La status line ne calcule pas l'usage, elle le lit. Les pourcentages et les instants de reset que reçoit la figure sont donc des **entrées d'exemple**, celles du README : 68 % (2h14) et 41 % (3j). Tout ce que la figure en fait est le vrai traitement du code : source, bornage, arrondi en 10 cases, seuils et format du délai.

## Scénario d'interaction

Le modèle de la figure est une fonction pure du temps simulé *t*, en minutes depuis le lancement de la session. Chaque minute, il appelle les vraies règles (`resolveRateLimits`, `bar`, `colorFor`, `fmtReset`) sur les entrées d'exemple ci-dessous. Revenir en arrière rejoue donc exactement le même état. Le rendu du code est lui-même sans état en mémoire, à l'exception du cache.

| *t* | Entrée stdin (exemple) | Ce que fait la machine | Ce que montre le relevé |
|---|---|---|---|
| 0 | Pas de `rate_limits`, premier rendu | Le levier claque sur **API**. La sonde part, sa bague fait un tour en 2,5 s au plus, puis elle revient avec 0,68 et 0,41 et deux `-reset` : *t* = 135 min pour 5 h, *t* = 3 j 6 h pour la semaine. Le marteau frappe la capsule. Les tiges avancent, les aiguilles montent en s'amortissant, 7 puis 4 lames se lèvent de gauche à droite, et les tambours roulent jusqu'à « 2h15 » et « 3j ». | `API · 5h 68 % · reset 2h15 · sem 41 % · 3j` |
| 1 | Première réponse : 68 %, 41 %, resets inchangés | Le levier passe sur **stdin**. La sonde reste rentrée, sans réseau, et le marteau frappe à chaque rendu. C'est la **pose au repos**. | `stdin · 5h 68 % · reset 2h14 · sem 41 % · 3j` |
| 1 → 41 | La session travaille : 5 h gagne 0,5 point par minute, la semaine 0,05, jusqu'à 88 % et 43 % | À 75 % (*t* = 15), la 8ᵉ lame se lève. À 80,5 % (*t* = 26), l'aiguille 5 h entre dans la zone pleine : jugé rouge, affiché « 81% ». À 85 % (*t* = 35), la 9ᵉ lame se lève. | `stdin · 5h 88 % · reset 1h34 · sem 43 % · 3j` |
| 41 → 75 | La session s'arrête : valeurs inchangées | Seuls le volant, la croix de Malte et les tambours bougent. | … `reset 1h00` |
| 76 | — | Le délai passe sous l'heure : le tambour des heures s'efface et le format passe de « 1h00 » à « 59m ». | … `reset 59m` |
| 135 | — | `resets_at` est atteint : le tambour affiche « 0m » (`delta <= 0`). | … `reset 0m` |
| 136 | La fenêtre 5 h repart : 2 %, reset 5 h plus tard | La tige recule, l'aiguille redescend en s'amortissant, les 9 lames retombent (round(0,2) = 0). Le tambour affiche « 5h00 », puis « 4h59 » au cran suivant, par arrondi inférieur. | `stdin · 5h 2 % · reset 5h00 · sem 43 % · 3j` |
| boucle | Nouvelle session, hors ligne | Le levier passe sur API, mais la sonde fait un tour complet de bague sans réponse : la temporisation de 2,5 s est écoulée. Le levier passe alors sur **cache**, et les aiguilles reprennent les dernières valeurs écrites. Puis retour à la pose au repos. | `cache · 5h 2 % · …` |

**Commandes**

- **Pointeur** : on glisse horizontalement, sur le volant ou n'importe où dans la scène. Vers la droite, le temps avance d'environ une minute par pixel ; vers la gauche, il recule. Le volant suit avec un suivi amorti, jamais d'un saut. Le survol d'une pièce l'éclaire, par le mécanisme commun de mise en avant.
- **Toucher** : même glisser au doigt, horizontal (`touch-action: pan-y`, pour laisser la page défiler verticalement). Un toucher bref avance d'un cran, soit une minute.
- **Clavier**, une fois la scène focalisée (aucun écouteur global) :
  - `→` et `←` : un cran, soit ±1 min ;
  - `Page suivante` et `Page précédente` : un tour de volant, soit ±1 h ;
  - `Fin` : jusqu'au prochain événement (lame, seuil, changement de format, reset) ;
  - `Début` : pose au repos ;
  - `Espace` : lance ou arrête le tour.
- **Tour au repos** : après 4 s sans action, la machine rejoue le scénario de *t* = 0 jusqu'à la boucle hors ligne. Le volant tourne seul à environ 5 min/s, ralentit près de chaque événement pour qu'on voie la lame, le seuil ou le tambour, puis reprend. Toute action le suspend.
- **Arrêt** hors écran. En **mouvement réduit**, la figure reste immobile dans la pose au repos. Les commandes sautent directement à l'état visé, sans amortissement ni roulement des tambours.

## Textes de la fiche

- **Accroche** : L'usage de votre abonnement Claude Code, *mesuré* sur une seule ligne, sous la zone de saisie.
- **Titre de la figure** : Rampe à cadran — fenêtre de 5 h et semaine
- **Consigne au pointeur** : Glissez vers la droite pour faire avancer le temps
- **Consigne au toucher** : Glissez le doigt vers la droite pour faire avancer le temps
- **Format du relevé** : `{source} · 5h {p5} % · reset {r5} · sem {p7} % · {r7}`
  - `source` vaut `stdin`, `API` ou `cache` ;
  - les pourcentages sont arrondis comme en L68, avec une espace fine insécable avant « % » ;
  - les délais sont au format de `fmtReset` ;
  - une fenêtre sans pourcentage s'écrit `5h —` ;
  - au repos : `stdin · 5h 68 % · reset 2h14 · sem 41 % · 3j`.
- **Légende** : Tant que Claude Code n'a pas encore fourni ses limites sur stdin, l'aiguillage interroge l'API (un jeton, 2,5 s au plus) ou relit le cache. Chaque pourcentage est ensuite borné à 0–100 et arrondi en dix cases : une lame se lève dès 5, 15, …, 95 %. Le cadran le juge sous 50, de 50 à 80 ou au-delà, et les tambours écrivent le délai de reset en jours, en heures-minutes ou en minutes. Les pourcentages sont un exemple, le traitement est celui du code.
- **Libellé accessible** : Rampe à cadran. Une longue règle d'instrument, bridée au bord d'une tablette, montre l'usage d'abonnement Claude Code. À gauche, un aiguillage choisit la source des limites : stdin, API ou cache. Le long de la rampe, deux peignes de dix lames marquent la fenêtre de 5 heures et la fenêtre hebdomadaire, chacune avec un compte à rebours jusqu'au reset. À droite, un cadran à deux aiguilles indique les pourcentages en trois zones, et un volant fait avancer le temps. Au clavier, les flèches avancent ou reculent d'une minute, Page suivante et Page précédente d'une heure.
- **Titre SEO** : claude-status-line — l'usage Claude Code en status line
- **Description SEO** : Binaire Bun qui affiche l'usage d'abonnement Claude Code, fenêtre de 5 h et semaine, dans la status line. Anatomie : sources, seuils, reset.

## Notes pour la construction (#24)

- **Taille.** C'est une « Figure » du skill, en SVG seul : 62 pièces dessinées, dans la fourchette de 40 à 80.
- **Pièces tournées.** Le carter du cadran, la lunette, le volant, la bague de temporisation, le boisseau, la capsule de cache et le cylindre de l'amortisseur viennent de `kit/lathe.mjs`. Le raccord stdin vient de `kit/tube.mjs`. L'audit est donc obligatoire et doit finir à zéro.
- **Dessins dans le plan de la face avant** (`sideMatrix`) : le cadran, les tambours, la fenêtre vitrée et les fentes de libellé. Les chiffres des tambours sont découpés dans leurs fenêtres et dimensionnés pour la chaîne la plus large, « 23h59 » ; le tiret « — » d'une fenêtre sans pourcentage y tient aussi.
- **Croix de Malte.** Elle se voit par le hublot de sa boîte : le doigt fait un tour par rendu, la croix avance d'un sixième de tour d'un coup sec puis reste verrouillée par le disque. À 5 min/s dans le tour, cela fait cinq crans par seconde, ce qui reste lisible.
- **Ordre de peinture.** Les lames sont triées par profondeur le long de la rampe, avec la vue rasante. Le ressort de la sonde est coupé en deux moitiés, arrière et avant.
- **Lisibilité à 390 px.** Le format très large réduit la hauteur. Le cadran doit faire au moins 22 % de la hauteur de la figure. Si besoin, appliquer le recadrage à 110–118 % du skill, sans couper la tête d'aiguillage ni le volant.
