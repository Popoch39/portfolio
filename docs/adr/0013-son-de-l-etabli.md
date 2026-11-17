# 0013 · Son de l'Établi : coupé par défaut, chargé à l'allumage, en Web Audio

- Statut : acceptée
- Date : 2026-11-17

## Contexte

Louis veut qu'on entende un clavier mécanique « butterysmooth » au survol et au clic des touches de l'Établi (ADR 0012), et précisément le son des touches de Typomaniac. C'est le premier son du site. Jusque-là, les touches n'avaient qu'un enfoncement CSS de 2,5 px au survol de la souris, rien au clic, et elles ne réagissaient pas au doigt.

## Décision

- **Coupé par défaut, allumé par le visiteur.** Un bouton « Son : coupé / allumé » (`aria-pressed`) se trouve sous le clavier, à côté de « Rejouer ». Il reste affiché en mouvement réduit, où « Rejouer » disparaît, parce que la Frappe y existe encore. Le choix est gardé dans `localStorage` (`son`) d'une visite à l'autre, comme la Pause. Un son qui part tout seul surprend en open space ou en réunion. Et le navigateur interdit de toute façon le son avant le premier geste du visiteur sur la page : au retour d'un visiteur qui l'a allumé, le bouton s'affiche donc allumé et le son part à son premier geste. L'Intro d'arrivée reste muette.
- **Aucun octet tant que le Son est coupé.** Les frappes (`src/assets/sound/tactile/`) ne sont demandées qu'à l'allumage, ou, au retour d'un visiteur qui l'avait laissé allumé, une fois la page posée (`openingEnded`). Elles sont décodées hors de tout contexte vivant (`OfflineAudioContext`) : prêtes avant le premier geste, ce geste n'a plus qu'à créer le contexte, et sa première frappe s'entend. En cas d'échec (hors ligne, refus), le clavier reste muet et l'appel suivant réessaie. Le contexte audio n'est créé qu'après un geste du visiteur (`navigator.userActivation`) ; sinon le navigateur le crée suspendu et lève un avertissement. Il est mis en veille (`suspend`) dès que plus rien ne joue. Une souris qui bouge sur les touches le garde éveillé 2 s de plus pour la frappe suivante, qu'un contexte qui se réveille ferait entendre en retard. Une page au repos ne garde donc aucun thread audio éveillé.
- **L'allumage s'entend.** Allumer le Son joue un appui, sur le clic du visiteur : il sait tout de suite que le clavier sonne et à quel volume.
- **Web Audio, pas des balises `<audio>`.** Les frappes se chevauchent, et « Rejouer » en joue 61 en 0,6 s. Elles doivent partir sans latence et se caler à la milliseconde sur l'impact du clip (72 % des 0,34 s de `cap-clip`, planifié depuis `animationstart`, sans minuterie). Rien entre les frappes et la sortie : ni compresseur ni filtre, qui écrasaient les attaques.
- **Les frappes Tactile de Typomaniac.** Ce sont les douze frappes du pack par défaut de Typomaniac, l'autre projet de Louis : « Keyboard_Tactile » de StavSounds sur Freesound (766628 à 766640, **CC0**, licence vérifiée son par son, crédits dans `src/assets/sound/tactile/CREDITS.md`). Chacune est en MP3 mono 44,1 kHz, normalisée à −3 dBFS, et pèse 3 Ko environ, 38 Ko en tout. Elles sont jouées comme Typomaniac les joue : une frappe tirée au sort, jamais la même que la précédente, désaccordée au hasard de ±50 cents. Les touches larges (plus d'une touche et demie, marquées au build par `data-wide`) jouent l'espace de Typomaniac, `key-05` baissée de 300 cents. Trois fichiers ne commencent pas sur leur attaque (`key-02` à 110 ms, `key-08` à 31 ms, `key-05` à 15 ms) : ils sont joués depuis elle, pour que la frappe tombe avec l'appui.
- **Frappe et Effleurement.** Chaque fichier contient une frappe entière, appui et relâche. À la souris, elle sonne au `pointerdown`. Au doigt, elle sonne au `pointerup`, car un doigt qui commence un défilement sur le clavier reçoit `pointercancel` et ne doit rien faire entendre. Dans les deux cas, la touche descend en fin de course (5 px) tant qu'elle est tenue, que le son soit allumé ou non. Le relâche n'a pas de son à part : découper les fichiers ne tient pas, la moitié n'ayant pas de relâche qui se détache de la traîne de l'appui. `touch-action` reste à `auto`, pas `pan-y` : le défilement suffit à annuler la frappe, et `pan-y` interdirait de zoomer à deux doigts sur le clavier. Le survol de la souris joue une frappe à 0,2 de volume, au plus une toutes les 40 ms : balayer le clavier ne fait pas une rafale. Les clips de « Rejouer » sont arrêtés si leur animation est annulée (« Rejouer » pressé en cours de route).
- **Le Son et la Pause sont indépendants.** La Pause (WCAG 2.2.2) fige ce qui bouge seul ; le Son ne répond qu'aux gestes du visiteur.
- **Le vrai clavier du visiteur reste hors périmètre.** Les touches de l'Établi n'ont pas de légende, sauf h j k l, et un écouteur global entrerait en conflit avec la navigation au clavier.

## Conséquences

- La boîte du clavier ne capte plus le pointeur, seules les faces des touches le captent (`.bench { pointer-events: none }`). Au téléphone, ses marges négatives la faisaient passer par-dessus les boutons placés dessous, qui ne recevaient plus le tap.
- Sur iPhone, le mode silencieux coupe Web Audio. On ne force pas `audioSession` en lecture : un téléphone en silencieux reste silencieux.
- Le JS de l'Établi grossit d'un module : écouteurs délégués sur le clavier, rien qui tourne au repos.

## Options écartées

- **Synthèse Web Audio** (bruit filtré et enveloppe) : aucun fichier, mais ça sonne vite « clic de jeu vidéo », rarement thocky.
- **Son actif dès le premier geste** : spectaculaire, mais il surprend.
- **Interrupteur dans la statusline** à côté de la Pause : Louis l'a voulu près du clavier, là où le visiteur regarde.
- **L'enregistrement de MaroonSounds** (Keychron Q2 lubrifié, pile la cible) : il est sous licence CC BY-NC, donc exclu sans l'accord de son auteur.
- **« Typing on a rainy 75 » de Techrul** (CC0), découpé en sprite WAV de quatre appuis et quatre relâches : choisi d'abord, sur son spectre le plus grave, sans avoir été écouté. À l'oreille, Louis l'a trouvé complètement sourd. La prise elle-même était étouffée, et le compresseur en sortie et le rééchantillonnage à 32 kHz l'aplatissaient encore.
