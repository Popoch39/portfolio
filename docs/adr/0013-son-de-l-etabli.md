# 0013 · Son de l'Établi : coupé par défaut, chargé à l'allumage, en Web Audio

- Statut : acceptée
- Date : 2026-11-17

## Contexte

Louis veut qu'on entende un clavier mécanique « butterysmooth » (thock crémeux de switchs linéaires lubrifiés) au survol et au clic des touches de l'Établi (ADR 0012). C'est le premier son du site. Jusque-là, les touches n'avaient qu'un enfoncement CSS de 2,5 px au survol de la souris, rien au clic, et elles ne réagissaient pas au doigt.

## Décision

- **Coupé par défaut, allumé par le visiteur.** Un bouton « Son : coupé / allumé » (`aria-pressed`) se trouve sous le clavier, à côté de « Rejouer ». Il reste affiché en mouvement réduit, où « Rejouer » disparaît, parce que la Frappe y existe encore. Le choix est gardé dans `localStorage` (`son`) d'une visite à l'autre, comme la Pause. Un son qui part tout seul surprend en open space ou en réunion. Et le navigateur interdit de toute façon le son avant le premier geste du visiteur sur la page : au retour d'un visiteur qui l'a allumé, le bouton s'affiche donc allumé et le son part à son premier geste. L'Intro d'arrivée reste muette.
- **Aucun octet tant que le Son est coupé.** Le sprite (`src/assets/sound/keys.wav`) n'est demandé qu'à l'allumage, ou, au retour d'un visiteur qui l'avait laissé allumé, une fois la page posée (`openingEnded`). Il est décodé hors de tout contexte vivant (`OfflineAudioContext`) : prêt avant le premier geste, ce geste n'a plus qu'à créer le contexte, et sa première frappe s'entend. En cas d'échec (hors ligne, refus), le clavier reste muet et l'appel suivant réessaie. Le contexte audio n'est créé qu'après un geste du visiteur (`navigator.userActivation`) ; sinon le navigateur le crée suspendu et lève un avertissement. Il est mis en veille (`suspend`) dès que plus rien ne joue. Une souris qui bouge sur les touches le garde éveillé 2 s de plus pour la frappe suivante, qu'un contexte qui se réveille ferait entendre en retard. Une page au repos ne garde donc aucun thread audio éveillé.
- **L'allumage s'entend.** Allumer le Son joue un appui, sur le clic du visiteur : il sait tout de suite que le clavier sonne et à quel volume.
- **Web Audio, pas des balises `<audio>`.** Les frappes se chevauchent, et « Rejouer » en joue 61 en 0,6 s. Elles doivent partir sans latence et se caler à la milliseconde sur l'impact du clip (72 % des 0,34 s de `cap-clip`, planifié depuis `animationstart`, sans minuterie). Un compresseur en sortie empêche leur somme de saturer.
- **Un sprite de vrais enregistrements.** Il contient quatre appuis et quatre relâches, chacun dans une case de 0,1 s, découpés dans « Typing on a rainy 75 » de Techrul (https://freesound.org/people/Techrul/sounds/815614/, **CC0**). C'est un clavier gasket à switchs linéaires lubrifiés : son centroïde spectral est le plus grave des prises CC0 comparées (≈ 1,2 kHz, contre 3 à 4 kHz pour les autres). Le fichier est en WAV PCM 16 bits mono 32 kHz, 51 Ko. Le format se décode partout avec des décalages exacts, alors que le délai d'encodeur du MP3 décale les cases selon le navigateur. Chaque frappe tire une variante différente de la précédente, avec ±4 % de hauteur, et les touches larges (plus d'une touche et demie, marquées au build par `data-wide`) sonnent plus grave.
- **Frappe et Effleurement.** Au clic, l'appui sonne au `pointerdown` et le relâche au `pointerup`, et la touche descend en fin de course (5 px) tant qu'elle est tenue, que le son soit allumé ou non. Au doigt, les deux sons partent au `pointerup`, car un doigt qui commence un défilement sur le clavier reçoit `pointercancel` et ne doit rien faire entendre. `touch-action` reste à `auto`, pas `pan-y` : le défilement suffit à annuler la frappe, et `pan-y` interdirait de zoomer à deux doigts sur le clavier. Le survol de la souris joue un relâche à 0,2 de volume, au plus un toutes les 40 ms : balayer le clavier ne fait pas une rafale. Les clips de « Rejouer » sont arrêtés si leur animation est annulée (« Rejouer » pressé en cours de route).
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
