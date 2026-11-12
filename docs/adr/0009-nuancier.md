# 0009 · Nuancier : quatre papiers dans un éventail

- Statut : acceptée
- Date : 2026-11-12
- Planche : « 03 · Nuancier — un éventail de papiers », version téléphone (canvas 4G4SyuZgZ4GiFvoTRsxZ47)

## Contexte

`:set bg=auto|light|dark` (ADR 0008) choisissait le jour ou la nuit dans la statusline. Louis veut quatre papiers, dont un nouveau, le **Cyanotype** (tirage bleu), choisis dans un nuancier d'imprimeur riveté dans le coin de la fenêtre : la bande choisie s'envole, le nouveau papier gagne la page en cercle depuis elle, cerclé du signal, puis l'éventail se referme et se rouvre avec cette bande devant. Le tout fluide au téléphone.

## Décision

- **L'éventail remplace `:set bg=`.** Fixé en bas à droite au-dessus de la statusline, sur toutes les pages (`Nuancier.astro`, dans le `Layout`). La statusline n'affiche plus que le papier en cours (`papier EN-04 · auto · nuit`, le nom seul sous 861 px), lu sur la racine en CSS.
- **Quatre radios natives** (`name="bg"`, groupe nommé « Papier du site ») : flèches, nom, état sans script. Chaque bande est imprimée dans son propre papier, pareille sur tous les thèmes. Cachées sans JS ; cochées, et la bande choisie mise devant, par un script inline avant la première peinture. Le choix reste dans `localStorage` (`bg`), comme avant (voir la dernière révision : `sessionStorage`, pour la visite).
- **Le Cyanotype est un thème à part entière** (`data-theme='cyan'`, jetons dans `global.css`), forcé seulement : le soleil n'y mène jamais. La carte du hero passe au bleu avec la page et ne porte pas de nuit (comme le jour forcé). La statusline prend le bleu nuit du tirage. `paintSky` pose aussi `data-sun` (`up`/`down`), que la bande Auto lit pour annoncer le prochain lever ou coucher.
- **La révélation est une view transition.** L'ancienne page est un instantané, la nouvelle est vivante sous un `clip-path: circle()` animé sur `::view-transition-new(root)` depuis le centre de la bande, jusqu'au coin le plus éloigné. La page se restyle une fois, dans la mise à jour de la transition, jamais pendant. L'anneau est un élément de la page mis à l'échelle avec le cercle : il court juste à l'intérieur du nouveau papier. L'éventail a son propre groupe (`view-transition-name`, posé seulement pendant la bascule) : ses bandes bougent en direct au-dessus. Les taps traversent la transition (`pointer-events: none`) : un nouveau choix saute l'animation en cours et repart de là.
- **Les bandes ne bougent qu'en `rotate` et `transform`.** La chorégraphie (envol, fermeture, réouverture) tient en deux minuteries ponctuelles, effacées à chaque choix.
- **Cibles de 24 px (WCAG 2.5.8).** Les bandes de la planche (34×100 px à −30/−20/−10/+2°) ne laissaient dépasser que 13 à 15 px : au téléphone, elles passent à 40×124 px, à −47/−28/−13/0°. Au bureau, l'éventail ouvert passe à −45/−25/−10/+4°. Sous la souris, il reste presque fermé au repos et s'ouvre au survol ; une fois survolé, tout l'éventail tient le pointeur, sinon l'ouverture déroberait la bande et le refermerait. Le clavier l'ouvre aussi ; un tap ou un clic, non.
- **Mouvement réduit, ou pas de view transitions** : le papier change d'un coup, la bande passe devant sans bouger.

## Conséquences

- Mesuré en CPU ×4 (Pixel 7) : une image de 33 à 50 ms au tap (capture et restyle de la page, avant le départ du cercle), puis toutes à la cadence. Lighthouse mobile 100 partout.
- L'éventail couvre en permanence environ 150 × 160 px du coin bas droit au téléphone (220 × 220 au bureau), hors des bandes cliquable à travers.
- L'étiquette de la nuit sur le hero dit `nuit · papier EN-02` au lieu de `nuit · :set bg=dark`.

## Options écartées

- **Deux couches de page, comme la planche**, l'une coupée en cercle : il faudrait dupliquer tout le DOM.
- **Garder `:set bg=` avec l'éventail** : deux sélecteurs à tenir synchronisés.
- **L'éventail dans le hero seulement** : rien de masqué en lisant, mais un second sélecteur pour le reste de la page et la 404.
- **Les angles de la planche** : 97 en accessibilité, des cibles de 13 px au doigt.

## Révision : huit papiers, un livret fermé au repos (2026-11-12)

Louis ajoute quatre papiers, forcés seulement comme le Cyanotype, chacun avec sa seule encre et l'accent gardé : **Kraft** (`kraft`, EN-05), **Calque** (`tracing`, EN-06), **Sanguine** (`sanguine`, EN-07) et **Phosphore** (`phosphor`, EN-08). Leurs jetons sont dans `global.css`, contrastes AA vérifiés ; sur les papiers clairs, `--color-accent-display` fonce pour garder 3:1. La carte du hero prend le papier sans nuit, la statusline prend l'encre la plus profonde du papier.

- **Un seul livret, fermé au repos.** Seule la bande du papier en cours se voit ; les sept autres sont repliées derrière elle, en `opacity: 0` et sans pointeur, mais restent dans le groupe de radios pour les flèches et les lecteurs d'écran. Le livret s'ouvre au survol de la souris, au clavier (focus visible) ou au tap (`data-open`), en quart de cercle de −91° à 0° au téléphone (13° entre bandes) et de −80° à +4° au bureau (12°). Un choix le referme, la bande choisie devant ; un tap sur le papier en cours ou à côté du livret le referme aussi. Sous une souris restée dessus, il se rouvre. L'ordre des bandes alterne clairs et sombres pour que chaque tranche se détache de la suivante.
- **Au doigt, le livret ouvert grandit ×1,6 autour du rivet.** À 1 ou ×1,4, ce qui dépasse des deux bandes du fond est un coin trop mince : l'ajustement tactile de Chromium donnait le tap à la bande voisine. À ×1,6, chacune des huit bandes prend son tap.
- **Lighthouse ne mesure que le livret fermé** : une seule cible, 100 en accessibilité. Ouvert, les boîtes englobantes des bandes pivotées se recouvrent, comme dans tout éventail de huit bandes.
- **Écartés.** Un éventail de huit bandes ouvert en permanence : `target-size` à 97 sur l'accueil et 95 sur la 404, et des taps perdus au fond. Deux livrets de quatre côte à côte (fusionnés dans la PR #107) : Louis veut un seul sélecteur. Un livret à plat, bandes droites décalées de 24 px : on perdait la rotation sur le rivet.
- **Conséquences** : au repos, l'éventail n'occupe plus que la bande en cours (environ 40 × 140 px au téléphone). Il faut un geste de plus au doigt, un tap pour ouvrir. Ouvert, il couvre environ 260 × 230 px du coin le temps du choix.

## Révision : un papier tiré au sort à chaque visite (2026-11-12)

Louis veut un papier au hasard à chaque venue sur le site, et que l'Intro le montre.

- **Le tirage se fait avant la première peinture**, dans le script inline du `<head>` (`SkyTrigger.astro`), parmi les huit papiers, Auto compris, jamais deux fois le même de suite. Une visite commence en arrivant d'ailleurs ou sur un rechargement (qui rejoue l'Intro) ; une navigation interne ou un retour par l'historique garde le papier de la visite.
- **Le choix du Nuancier ne vaut plus que pour la visite** : il passe de `localStorage` à `sessionStorage` (`bg`), et la visite suivante tire à nouveau, même après un choix. Stockage bloqué : chaque visite tire quand même, mais les pages suivantes de la visite reviennent à Auto.
- **L'Intro joue sur le papier tiré** (`.intro-layer`, `global.css`) : voile, HUD, globe (encre, signal, sphère ombrée du côté éclairé des volumes du papier à une nuance sous lui) et étiquette. Le HUD nomme le papier comme la statusline. Sur Auto, elle reste au jour et la nuit tombe à la fin (ADR 0008) ; sur la Nuit forcée, elle joue de nuit.
- **Écarté** : tirer seulement sans choix enregistré. Louis préfère que chaque visite tire.

## Révision : cinq palettes connues à la place des papiers maison (2026-11-12)

Louis trouve le Cyanotype, le Kraft, le Calque, la Sanguine et le Phosphore peu beaux. Ils laissent la place à cinq colorschemes d'éditeur connus, à leur place dans l'éventail : **Solarized Light** (`solarized-light`, EN-03), **Nord** (`nord`, EN-05), **Gruvbox Light** (`gruvbox-light`, EN-06), **Catppuccin Mocha** (`catppuccin-mocha`, EN-07) et **Tokyo Night** (`tokyo-night`, EN-08). Le Jour, la Nuit et Auto restent la charte « Encre seule » (ADR 0006).

- **Les teintes officielles de chaque palette**, sans en inventer : fond, texte, texte discret, filets, aplat de la Frise, rangée de la statusline (le fond le plus sombre de la palette, comme son statusline dans l'éditeur).
- **Chaque palette garde son propre orange comme signal** (Solarized `#cb4b16`, Nord `#d08770`, Gruvbox `#af3a03`, Catppuccin peach `#fab387`, Tokyo Night `#ff9e64`) au lieu de `#ff5b14`. Le rôle ne change pas : un seul signal, posé en texte seulement en grand et à 3:1 au moins. Chaque bande du Nuancier montre l'orange de sa palette, celles du Jour, de la Nuit et d'Auto gardent `#ff5b14`.
- **AA d'abord.** Où une paire officielle ne tient pas 4,5:1, une autre teinte officielle de la palette la remplace : Solarized base01 pour le texte discret (base00 : 4,1:1 sur base3), Tokyo Night fg_gutter `#3b4261` sur l'encre (terminal_black : 4,2:1), Gruvbox bg1 `#3c3836` pour les segments de la statusline (bg2 : 4,05:1). Deux teintes seulement sortent des palettes, le texte posé sur l'orange : blanc sur l'orange Solarized (base3 : 4,3:1, blanc 4,6:1) et `#242933` sur l'orange Nord (nord0 : 4,4:1, `#242933` 5:1). Lighthouse mobile : 100 en accessibilité sur l'accueil et la 404 pour chacune des cinq.
- **Un papier disparu relance le tirage** : une visite commencée avant le déploiement qui garde `kraft` en `sessionStorage` tire un nouveau papier à sa page suivante, au lieu de poser un `data-bg` sans thème.
- **Le livret s'ouvre en rosace** (au survol, au clavier, au tap) : les huit bandes sur 360°, à 45° l'une de l'autre, celle du papier en cours debout. Chacune s'écarte de 40 px du rivet le long de son axe, ce qui laisse un cœur vide : pivotant par le pied, elles se cachaient les noms les unes les autres au centre. Leurs trous, qui ne tombent plus sur le rivet, s'effacent. La rosace ne tient pas dans le coin : le livret glisse vers l'intérieur en s'ouvrant (`translate`), jusqu'au milieu de la largeur au téléphone, et revient au coin en se refermant. Sous la souris, un disque invisible tient le survol sur tout le trajet, sinon le pointeur resté sur la bande fermée la perdrait. Plus de grossissement ×1,6 au doigt : à 45°, aucune bande n'en recouvre une autre.
- **Les noms en deux mots s'écrivent sur deux lignes**, la famille puis la variante, à la place du code hex ; en 10 px au bureau pour que « Catppuccin » tienne dans les 66 px du dos.
- **Écartés.** Garder `#ff5b14` sur toutes les palettes : moins fidèle, et il jure avec les bleus de Nord et de Tokyo Night. Prendre la couleur emblématique de chaque palette (bleu Nord, mauve Catppuccin) : le signal ne serait plus un. Des noms de papier francisés : la palette ne serait plus reconnue.
