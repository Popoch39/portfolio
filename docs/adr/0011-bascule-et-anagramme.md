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
- **L'Anagramme calculée au build**, ce qui impose une Accroche en Fragment Mono à colonnes fixes par palier : la place de chaque lettre est sa colonne × 0,6 em, les coupures se font au build, et le build apparie lettre à lettre les deux langues pour chaque bloc animé, chaque version de l'Accroche et chaque palier. Le navigateur ne mesure rien ; il ne joue que des transitions CSS sur `transform` et `opacity`.
- **La view transition après l'animation sortante.** L'Anagramme joue sur la page qui s'en va ; la navigation passe ensuite par une view transition cross-document sans fondu vers une page déjà à son État final. Une arrivée par Bascule vient d'une autre page du site : l'Intro ne joue pas, et un rechargement de `/en/` la rejoue comme sur `/`.

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
