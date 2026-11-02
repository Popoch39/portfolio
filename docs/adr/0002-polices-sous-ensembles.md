# 0002 · Polices en sous-ensembles maison

- Statut : acceptée
- Date : 2026-11-02

## Contexte

La maquette D · Éditorial repose sur Archivo, variable en graisse (400 à 900) et en chasse (62 à 100 %, pour le titre, les intertitres et la marquee), son italique pour un seul mot de l'accroche, et Fragment Mono pour les libellés et la statusline. Le projet veut des polices auto-hébergées en woff2, réduites aux glyphes utiles, en `swap`, avec une seule police préchargée, et 100 au Lighthouse mobile.

Le fournisseur Google de l'API Fonts d'Astro sait restreindre les glyphes (`experimental.glyphs`), mais Google ne coupe pas les axes : l'Archivo variable pèse 95 Ko, plage de chasse réduite ou non.

## Décision

- Les trois fichiers sont produits une fois par `scripts/fonts.sh` (fonttools) depuis les sources de google/fonts et commités dans `src/assets/fonts/`, licences OFL à côté :
  - `archivo-variable.woff2` : axes réduits à `wdth 62–100` et `wght 400–900`, 51 Ko ;
  - `archivo-italic-400.woff2` : une seule instance (chasse 100, graisse 400), 12 Ko ;
  - `fragment-mono-400.woff2` : 22 Ko.
- Jeu de glyphes : latin de base, Latin-1, œ/Œ/Ÿ, ponctuation typographique française, €, → et ↗.
- Astro les sert par son API Fonts avec le fournisseur `local` : `@font-face` en `swap`, replis aux métriques ajustées, et préchargement de la seule Archivo droite, qui dessine le titre (élément LCP).

## Options écartées

- **Fournisseur Google d'Astro** : téléchargement au build, mais 95 Ko pour la seule Archivo droite, et une dépendance réseau à chaque build.
- **Sous-ensemble calculé au build** : demanderait fonttools (Python) dans la chaîne de build pour un résultat qui ne change que si le texte gagne un caractère nouveau.

## Conséquences

- Budget polices : 85 Ko pour les trois fichiers, vérifié par un test (90 Ko au plus).
- Un caractère hors du jeu de glyphes s'affiche dans la police de repli : on l'ajoute à `GLYPHS` dans `scripts/fonts.sh` et on relance le script.
- Archivo n'a pas ↗ : la flèche des liens en Archivo vient de la police de repli, comme dans la maquette ; en Fragment Mono, elle est dessinée.
