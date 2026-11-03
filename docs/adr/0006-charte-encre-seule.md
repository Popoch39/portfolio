# 0006 · Charte « Encre seule »

- Statut : acceptée
- Date : 2026-11-03

## Contexte

La charte de la maquette D (encre sur papier, accent bleu `#2433ff` en aplat et en texte) est remplacée par la planche « 05 · Encre seule » du canvas des chartes couleurs, avec la typographie de la planche « 01 · Vermillon riso ». La consigne : changer les couleurs et la police, rien d'autre (mise en page, scènes, animations).

## Décision

- **Palette** : papier `#efeee9`, encre `#141412`, encre douce `#5e5d58`, filet `#d5d4cd`, cendre `#b3b1a9` (petit texte sur l'encre), et un seul signal `#ff5b14`, porté par `--color-accent`.
- **Le signal ne porte jamais de texte sur le papier** (2,7:1) : curseurs, carrés des numéros de section, points de la Frise, calques des bagues, ombre du bouton au survol, soulignement du mot qui change dans l'accroche. Sur le signal, le texte est à l'encre (5,9:1 : mode de la statusline, bloc du curseur Vim). Ce qui était du texte en accent passe à l'encre (étiquette SIG de l'Atome) ; les liens survolés passent à l'encre douce et le focus s'entoure d'encre. Seule exception, le `:wq` géant du contact reste orange : sa descendante passe sous l'accroche, qui se confondrait avec un `q` à l'encre. Il prend un cran plus foncé, `#eb5210` (`--color-accent-display`), qui tient 3,1:1 sur le papier (seuil du gros texte) et laisse 5:1 à l'encre posée dessus.
- **Aplat de la Frise** : `#1c1b19` (`--color-dark`), un cran au-dessus de l'encre pour se distinguer de la marquee et de la statusline ; texte au papier, lignes secondaires en cendre (8:1).
- **Police** : toujours Archivo et Fragment Mono, mais les titres d'affichage passent de 800 à 900 et la marquee de 700 à 800, comme sur la planche Vermillon. Le fichier variable couvre déjà 400 à 900 : aucun fichier de police ne change (ADR 0002).

## Conséquences

- Le compteur de l'Intro reste à 800 : il est en Fragment Mono, qui n'a qu'une graisse (gras synthétique, identique à 800 et 900).
- Le bouton au survol devient papier, contour encre et ombre portée signal, dessinés en `box-shadow` pour que sa boîte ne bouge pas.
- L'image Open Graph (`src/assets/og.png`) reprend sa composition aux nouvelles couleurs, titre en 900 ; « SIG & cartographie » y passe en encre/papier comme la sélection de l'accroche. Elle se redessine avec `node scripts/og.mjs` (Playwright et ImageMagick), à relancer si le nom, l'accroche ou la palette changent.
