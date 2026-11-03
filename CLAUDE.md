# Portfolio

Site vitrine statique sous Astro. Le site *est* la démonstration du savoir-faire : sa vitesse, son accessibilité et son référencement comptent autant que son contenu.

## Documentation Astro à jour

Le projet tourne sur une version d'Astro plus récente que ce que tu connais de mémoire. Le code existant fait foi pour tout ce qu'il utilise déjà. Pour toute API, directive, intégration ou option de config **absente du code**, lis d'abord la doc actuelle : outil MCP `search_astro_docs` (serveur `astro-docs`), sinon https://docs.astro.build. Vérifie au passage qu'Astro ne fournit pas déjà la fonctionnalité en natif avant d'ajouter une dépendance.

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)

## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Calculé au build

Tout ce qui peut être calculé au build l'est : récupération de données, transformation de contenu (Markdown, coloration syntaxique), dates formatées, listes triées et filtrées, SVG générés, métadonnées. Le navigateur reçoit le résultat en HTML, jamais le calcul. Le site reste en sortie statique ; un rendu à la demande se discute avant d'être ajouté.

## JavaScript

- Zéro JS client par défaut. Chaque script envoyé au navigateur répond à une interaction réelle que HTML et CSS ne couvrent pas (`<details>`, `popover`, `:has()`, animations CSS, scroll-driven animations, view transitions).
- Interaction nécessaire : un `<script>` Astro en vanilla d'abord ; un framework d'UI seulement si l'état le justifie, en île avec la directive la plus tardive possible (`client:visible`, `client:idle`).
- Aucun script tiers (analytics, widgets, embeds) sans accord explicite.
- **Exception assumée : GSAP.** GSAP + ScrollTrigger + ScrollSmoother sont chargés sur chaque page par le socle d'animation (`src/animation/base.ts`) : défilement lissé et toutes les scènes. Ce n'est pas une violation à corriger ; voir [ADR 0001](docs/adr/0001-gsap-pour-les-scenes.md). Une scène s'enregistre auprès du socle (`registerScene`), n'importe jamais `gsap` pour créer son propre smoother, n'anime que `transform` et `opacity`, et épingle avec `pin` (jamais `position: sticky` dans le contenu lissé ; seule exception, la Frise au doigt, tenue en `sticky` sans smoother parce que la bascule `fixed` de `pin` y produit du CLS, voir l'ADR). Les animations d'interface restent en CSS.
- **Toucher à GSAP = charger les skills GSAP d'abord.** Avant d'écrire ou de modifier du code GSAP (socle, scène, timeline, ScrollTrigger, ScrollSmoother), charge les skills concernés : `gsap-core`, `gsap-timeline`, `gsap-scrolltrigger`, `gsap-plugins`, `gsap-utils` selon le besoin, et `gsap-performance` à chaque fois.
- **Fuites mémoire.** Tout ce qu'une scène crée (tweens, timelines, ScrollTriggers, écouteurs, observers, `requestAnimationFrame`) est créé dans le contexte `matchMedia` du socle pour être annulé par son `revert()` ; ce qui vit hors du contexte renvoie sa fonction de nettoyage. Rien ne survit à un changement de préférence ou à une navigation : vérifie au besoin avec un instantané de tas (skill `memory-leak-debugging`).
- **FPS.** Une scène GSAP tient les 60 fps de la section Fluidité : pas de lecture de layout dans un `onUpdate`, pas de `will-change` permanent sur des dizaines d'éléments, `scrub` et `pin` mesurés par une trace de performance en mobile avant de conclure.

## Assets

- Images : `astro:assets` (`<Image>`, `<Picture>`) pour obtenir AVIF/WebP, dimensions explicites et zéro décalage de mise en page. L'image LCP passe en `loading="eager"` + `fetchpriority="high"`, les autres en lazy. `public/` est réservé aux fichiers dont l'URL doit rester fixe (favicon, `robots.txt`).
- Polices : auto-hébergées, woff2, sous-ensemble de glyphes utile, `font-display: swap`, préchargement de la seule police visible au premier affichage. Regarde dans la doc ce qu'Astro propose pour les polices avant de câbler à la main.
- CSS : styles scopés des composants, variables CSS pour le thème. Un framework CSS se discute avant d'être ajouté.

## SEO

Chaque page porte : `<html lang>`, un `<title>` et une `meta description` uniques, une URL canonique, les balises Open Graph et Twitter avec image, un seul `<h1>` et une structure de titres sans saut. Le site expose `robots.txt`, un sitemap et un JSON-LD `Person` sur l'accueil. Ces besoins demandent `site` renseigné dans `astro.config.mjs`.

## Accessibilité

Contraste AA, `alt` pertinent (vide pour le décoratif), focus visible, navigation clavier complète, HTML sémantique avant ARIA, animations désactivées ou réduites sous `prefers-reduced-motion`.

## Fluidité

Cible : **60 fps minimum partout** : défilement, animations, transitions et interactions, sur toutes les pages, en mobile comme en desktop. Une frame qui dépasse 16,7 ms se corrige ou se signale avec sa cause, comme une baisse de score Lighthouse.

## Lighthouse

Cible : **100 dans les quatre catégories, en mobile**, sur le build (`astro build` puis `astro preview`), jamais sur le serveur de dev. Tout changement qui touche au rendu (page, composant, asset, police, script) se termine par un audit Lighthouse mobile ; une baisse de score se corrige avant de conclure ou se signale avec sa cause.

## Agent skills

### Issue tracker

Issues tracked in GitHub Issues (Popoch39/portfolio) via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
