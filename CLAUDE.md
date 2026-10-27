## Performance : priorité absolue

Ce site doit **toujours** être le plus performant possible. Chaque changement se juge d'abord à son coût en perf, avant l'esthétique ou le confort de code.

- **Le moins de JS possible** : HTML et CSS d'abord ; JS uniquement quand le CSS ne peut pas le faire, sous forme de `<script>` léger ou d'îlot hydraté le plus tard possible (`client:visible`, `client:idle`).
- **Premier rendu immédiat** : FCP, LCP, CLS et INP au vert. Rien ne bloque le rendu ; polices, images et CSS critiques sont optimisés (dimensions fixées, formats modernes, lazy hors écran, préchargement de ce qui est au-dessus de la ligne de flottaison).
- **FPS max** : animations sur `transform` et `opacity` uniquement, sans recalcul de layout ; JS d'animation calé sur `requestAnimationFrame` ; `prefers-reduced-motion` respecté.
- **SEO irréprochable** : HTML sémantique, `title` et `description` uniques par page, canonical, hreflang, métadonnées de partage.
- **Mesurer** : tout changement qui touche au rendu, aux animations ou au poids de page est mesuré avant/après (Lighthouse, trace de performance). Une régression se signale à Louis avant d'être commitée.

## Documentation Astro

Avant d'écrire ou de modifier du code Astro (composants, routing, config, content collections, intégrations…), consulter la doc à jour via le MCP `astro-docs` (outil `search_astro_docs`) plutôt que de se fier à sa mémoire : l'API d'Astro évolue vite.

Si le MCP n'est pas disponible dans la session, l'ajouter puis redémarrer Claude Code :

```
claude mcp add --transport http astro-docs https://mcp.docs.astro.build/mcp
```
