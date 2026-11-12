# 0008 · Terminateur : la nuit sur le hero et sur le site

- Statut : acceptée
- Date : 2026-11-09
- Planche : « 06 · Terminateur — la nuit tombe sur Besançon » (canvas Q8EduXtu1ZTfUbA52Cwkv5)

## Contexte

La planche coupe le hero en deux le long du **terminateur**, la ligne où le soleil se couche à Besançon à l'heure de la visite : à l'ouest le jour, à l'est la nuit, entre les deux les crépuscules civil, nautique et astronomique en hachures. La statusline donne le lever et le coucher du jour et propose `:set bg=auto|light|dark`. Louis veut pouvoir choisir le jour ou la nuit à toute heure, que la nuit forcée gagne tout le site et qu'en `auto` le reste du site suive le soleil (sombre du coucher au lever). Le tout fluide et léger.

La charte reste « Encre seule » (ADR 0006) : la nuit est la même encre retournée, pas une nouvelle palette.

## Décision

- **Deux thèmes par jetons.** Les couleurs de la charte vivent sur `:root` et sur `.theme-light` ; leur retournement sur `:root[data-theme='dark']` et `.theme-dark` (`global.css`). La carte du hero, la statusline et l'Intro gardent le jour (`.theme-light`) quel que soit le thème de la page ; la copie de nuit du hero garde la nuit (`.theme-dark`). L'aplat de la Frise et le signal ne changent pas.
- **La nuit est une copie du hero, coupée.** La carte du hero (`HeroSheet.astro`) est rendue deux fois au build : de jour dans la carte, et en copie de nuit sous `.sky`, `aria-hidden`, `inert`, `data-nosnippet`, sans `h1`, sans id, sans rien que l'Intro anime. L'Accroche tape dans les deux (`typist.ts`). Le survol, l'appui et le focus des actions du jour se reflètent sur la copie par `:has()`.
- **L'heure n'est qu'un décalage.** La courbe du terminateur dépend du jour (déclinaison), pas de l'heure : l'heure ne fait que la glisser sur la carte. `.sky` (la ligne, son liseré signal, les hachures, les étiquettes) glisse d'un `translate`, la copie de nuit glisse d'autant en sens inverse et reste en place. Deux `translate` sur la même courbe : le compositeur les déplace, rien n'est repeint, les `clip-path` restent fixes pour la journée. Le mode forcé pousse la ligne hors de la carte d'un côté ou de l'autre, avec la même transition (1,4 s) : la nuit tombe ou se retire.
- **Calculé avant la première peinture.** `paintSky` (`src/sky/sky.ts`) fait l'éphéméride (simplification NOAA) et écrit sur la racine `data-theme`, `data-sky` et les propriétés du terminateur. Elle est imprimée telle quelle dans un script inline du `<head>` (`SkyTrigger.astro`, `Function.prototype.toString`) et réutilisée par le module : une seule éphéméride, pas de flash de jour la nuit. Elle n'écrit que ce qui change : une propriété sur la racine restyle toute la page.
- **Le temps qui passe.** Une minuterie vers le prochain lever ou coucher retourne le thème de la page ; le retour d'un onglet repeint. La ligne avance d'une minute à l'autre (quelques pixels) seulement quand la carte est à l'écran et l'Intro finie : scène enregistrée, `watchOffScreen`, et le décalage écrit sur `.sky`, pas sur la racine. L'Intro se joue de jour : la nuit tombe à sa fin.
- **`:set bg=`** est un groupe de radios natives dans la statusline (flèches, nom de groupe), caché sans JS, coché avant la première peinture sur le choix retenu (`localStorage`, comme la Pause). Changer de fond retourne la page dans une view transition (fondu GPU), sauf en mouvement réduit, où tout bascule d'un coup.

## Conséquences

- La copie double le DOM du hero (~70 nœuds) et la frappe de l'Accroche. Hors de la carte toute la journée, la nuit passe en `visibility: hidden` : rien n'est peint.
- Le script inline pèse environ 6 Ko non minifiés (2 Ko compressés) sur chaque page.
- Sans JS : jour partout, pas de nuit, pas de sélecteur. En mouvement réduit : la nuit est juste, mais ne glisse pas et n'avance pas d'elle-même.
- Le minuit et le lendemain réutilisent le lever du jour (une minute d'écart au plus) jusqu'au prochain rafraîchissement.

## Options écartées

- **Un mélange (`mix-blend-mode: difference`) ou `backdrop-filter: invert()`** sur un seul hero : couleurs fausses (gris au lieu du papier, signal bleu), filtre recalculé à chaque image du défilement.
- **Animer le `clip-path`** du polygone d'une heure à l'autre : repeint à chaque image.
- **Une animation CSS de 24 h** pour faire avancer la ligne : le compositeur travaillerait en continu, page au repos comprise.
- **La copie de nuit clonée en JS** : flash de jour avant le script, et la copie à resynchroniser.

## Mise à jour (2026-11-12)

`:set bg=` est retiré de la statusline : le Nuancier (ADR 0009) choisit le papier, avec un quatrième, le Cyanotype, et une révélation en cercle à la place du fondu.
