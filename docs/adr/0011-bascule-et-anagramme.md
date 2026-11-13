# 0011 · Bascule : l'anglais sous `/en/`, l'Anagramme calculée au build

- Statut : acceptée
- Date : 2026-11-13
- Planche : « 06 · Anagramme » (canvas des transitions de langue, artifact TrAPqid4WtLKTq3hd79TpC, `project/Anagramme.dc.html`)
- Spec : #121, ticket #125

## Contexte

Le site n'existait qu'en français. Il doit exister en entier en anglais, sans toucher aux URL françaises déjà partagées, et le changement de langue, la **Bascule**, doit être un geste dessiné, l'**Anagramme**, et non un rechargement qui rejoue l'Intro. Le site reste statique (CLAUDE.md : tout ce qui peut être calculé au build l'est) et sans dépendance d'i18n.

## Décision

- **La langue est l'URL, et rien d'autre.** Routage i18n natif d'Astro : `fr` par défaut sans préfixe (`/`), `en` sous `/en/` (`prefixDefaultLocale: false`). Aucune redirection selon `Accept-Language`, aucun cookie, aucune préférence retenue : un lien partagé montre toujours ce qu'il dit.
- **Une page, un composant, la langue en prop.** `HomePage.astro` et `NotFoundPage.astro` sont rendus par `src/pages/index.astro` et `src/pages/en/index.astro`, `404.astro` et `en/404.astro`. Le Layout reçoit la langue et en tire `<html lang>`, `og:locale`, la canonique et les `hreflang` `fr`, `en` et `x-default` (vers `/`), par `getAbsoluteLocaleUrl`. La 404 n'en porte pas : elle est `noindex`, sans canonique.
- **Un dictionnaire typé par langue.** `src/i18n/fr.ts` définit le type ; `en.ts` doit le satisfaire, donc une chaîne anglaise manquante casse le typecheck. Ni bibliothèque i18n, ni content collection.
- **Le contrôle de Bascule est fait de deux liens.** « FR / EN » dans l'en-tête, à droite des Sections, chacun vers la même page dans sa langue (`hreflang`, `lang`), la langue courante soulignée en signal et marquée `aria-current`. Sur la 404, il mène à l'accueil de l'autre langue. Sans JS, c'est une navigation ordinaire.
- **La 404 anglaise par Cloudflare.** `not_found_handling: "404-page"` sert le `404.html` le plus proche de l'URL demandée : il faut donc un `dist/en/404.html`. Le format de build par défaut (`directory`) l'écrit `en/404/index.html`, que Cloudflare ignore. D'où `build.format: 'preserve'`, qui écrit `en/404.html` et laisse les pages d'index en répertoires, et `trailingSlash: 'always'`, sans lequel `preserve` ferait perdre leur barre finale aux URL d'`astro:i18n` (`/en` au lieu de `/en/`). Vérifié avec `wrangler dev` : `/en/inconnue` et `/en/a/b` reçoivent la 404 anglaise en 404, `/inconnue` la française.
- **L'Anagramme calculée au build**, ce qui impose une Accroche en Fragment Mono à colonnes fixes par palier : la place de chaque lettre est sa colonne × `1ch` (l'avance réelle, 0,618 em, pas les 0,6 em de la planche), les coupures se font au build, et le build apparie lettre à lettre les deux langues pour chaque bloc animé, chaque version de l'Accroche et chaque palier. Le navigateur ne mesure rien ; il ne joue que des transitions CSS sur `transform` et `opacity`.
- **La view transition après l'animation sortante.** L'Anagramme joue sur la page qui s'en va ; la navigation passe ensuite par une view transition cross-document sans fondu vers une page déjà à son État final. Une arrivée par Bascule vient d'une autre page du site : l'Intro ne joue pas, et un rechargement de `/en/` la rejoue comme sur `/`.

## L'Anagramme construite (#127)

- **La place d'une lettre est `colonnes × 1ch + px`**, en CSS, dans la police de son bloc. `1ch` vaut exactement l'avance que le navigateur dessine en Fragment Mono, arrondie au pixel là où il l'arrondit (Chromium sous Linux : 8 px à 13 px, 19 px à 30 px) : vérifié lettre à lettre, les lettres de l'Anagramme tombent au pixel près sur le vrai texte, au départ comme à l'arrivée. Les pixels comptent ce qui n'est pas une lettre : l'écart du bouton, les icônes et les marges de la statusline.
- **Des données, pas des spans dans le HTML.** Le build écrit, pour chaque bloc et chaque version de l'Accroche, les deux textes, les paires `[source, cible]` et les coupures de ligne de chaque disposition (`#anagramme`, ~11 Ko bruts, ~3 Ko compressés). Le script n'y ajoute que des additions de colonnes et les formules de la planche (délais, sauts) : il crée les lettres (quelque 350, quatre boîtes chacune, deux fois pour le hero de jour et sa copie de nuit) à l'intention (survol, focus, appui) pour les blocs fixes, au clic pour l'Accroche, son public et le papier. Écrites dans le HTML, ces milliers de boîtes pèseraient sur chaque visite, Bascule ou non.
- **Une disposition par largeur, choisie en CSS.** Le rôle, la spécialité et le public de l'Accroche sont coupés par le navigateur sur une boîte dont la largeur suit la fenêtre : le build calcule une disposition pour chaque plage de colonnes où les deux textes se coupent pareil, et des requêtes de conteneur en `ch` (`@container (width < 39ch)`) choisissent la bonne. L'Accroche suit ses paliers (600 px), la nav et le soleil leurs points de rupture.
- **Un appariement, joué dans les deux sens**, comme la planche : l'anglais est toujours la cible ; la Bascule retour défait exactement l'aller.
- **La nav et le libellé du bouton passent en Fragment Mono**, comme la planche les dessine : en Archivo, leurs lettres n'ont pas de colonne. Écartés : lire les chasses d'Archivo au build (fonte variable, crénage, déjà écarté pour l'Accroche), mesurer au clic (interdit), ne faire que sombrer et naître ces blocs (la planche y fait voyager les lettres). La nav prend 12 px pour garder ses trois liens sur une ligne dans la cellule la plus étroite (180 px à 861 px) ; le bouton 15 px, `:wq` à la même taille. Son encre suit la longueur du libellé (`scaleX`) et GitHub le suit (`translateX`, au tiers de pixel près là où l'avance est arrondie).
- **Les hauteurs ne dépendent plus de la langue.** L'en-tête garde les lignes du plus long du rôle et de la spécialité dans les deux langues, l'Accroche les rangs de sa plus longue frappe dans les deux, son public les siennes, à chaque largeur : rien ne bouge sous eux à l'arrivée.
- **Ce qui change aussi sans être de la liste** : le papier de la statusline (`papier`/`paper`, `jour`/`day`) et `Bas`/`Bot` jouent l'Anagramme eux aussi, sans quoi ils sautaient à l'arrivée ; le soleil se décale d'autant que le papier raccourcit. Les coordonnées sont les mêmes dans les deux langues (sexagésimales) : rien n'y bouge.
- **L'arrivée.** Un script inline juste après le hero (attendu par `<link rel="expect" blocking="render">`) lit la version en `sessionStorage`, l'efface, pose l'Accroche au repos sur elle et marque la racine `data-arrived="bascule"`, qui ôte le fondu de la view transition. Une page prérendue (règles de spéculation, `moderate`) le fait à son activation (`prerenderingchange`) ; sa frappe attend jusque-là.

## Conséquences

- Le dictionnaire anglais est d'abord une copie du français qui satisfait le type ; l'anglais est rédigé à part (#123) et relu par Louis avant la fusion.
- Chaque script client embarque la section de dictionnaire de chaque langue (`forPage`), pas le dictionnaire entier.
- Une future page hors index s'écrirait `page.html` sous `preserve` : le sitemap, qui suppose des répertoires, serait à revoir.
- Le numéro de version de l'Accroche passe le saut en `sessionStorage`, lu une fois puis effacé : la seule valeur stockée.

## Options écartées

- **Détecter la langue** (en-tête `Accept-Language`, cookie, préférence retenue) : une même URL montrerait des pages différentes, et une redirection coûte un aller-retour.
- **Garder Archivo en lisant les chasses au build** : une nouvelle dépendance pour lire la police, et une dérive due au crénage entre le calcul et le rendu.
- **Lire les coupures au clic** : un calcul de mise en page côté client, au moment même où l'animation doit partir.
- **Un `view-transition-name` par lettre** : le navigateur interpole en ligne droite et en fondu ; l'arc et le passage en signal seraient perdus.
- **Copier `en/404/index.html` en `en/404.html` après le build**, ou **un Worker qui sert la 404 anglaise** : un script de plus pour ce qu'une option de build fait seule, et un Worker réveillé par chaque URL inconnue.
