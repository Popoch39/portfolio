# Logos des pastilles

Logos monochromes des outils de la Stack, portés par les pastilles de l’Atome (ADR 0004). Chaque fichier vient tel quel de [simple-icons](https://simpleicons.org) et garde le nom de son slug ; le tracé (`d`) a été comparé octet par octet aux versions publiées sur jsDelivr le 2026-11-02.

- **Licence** : CC0 1.0 (`"license": "CC0-1.0"` dans le `package.json` de simple-icons). La licence couvre les fichiers SVG, pas les marques : chaque logo reste la marque de son titulaire, utilisé ici pour nommer l’outil (usage nominatif).
- **Rendu** : le build les assemble en un sprite de symboles inline, en `currentColor` (encre) ; leur `<title>` et leur `role` sont retirés, le nom de l’outil étant déjà dans la liste de la Stack.

| fichier | outil | slug simple-icons | version |
|---|---|---|---|
| `typescript.svg` | TypeScript | `typescript` | 16.36.0 |
| `rust.svg` | Rust | `rust` | 16.36.0 |
| `php.svg` | PHP | `php` | 16.36.0 |
| `go.svg` | Go | `go` | 16.36.0 |
| `lua.svg` | Lua | `lua` | 16.36.0 |
| `nestjs.svg` | NestJS | `nestjs` | 16.36.0 |
| `laravel.svg` | Laravel | `laravel` | 16.36.0 |
| `nodedotjs.svg` | Node | `nodedotjs` | 16.36.0 |
| `graphql.svg` | GraphQL | `graphql` | 16.36.0 |
| `react.svg` | React | `react` | 16.36.0 |
| `nextdotjs.svg` | Next.js | `nextdotjs` | 16.36.0 |
| `vuedotjs.svg` | Vue | `vuedotjs` | 16.36.0 |
| `vite.svg` | Vite | `vite` | 11.0.0 à 16.0.0 (ancien logo, redessiné depuis) |
| `tailwindcss.svg` | Tailwind | `tailwindcss` | 16.36.0 |
| `openlayers.svg` | OpenLayers | `openlayers` | 16.36.0 |
| `maplibre.svg` | MapLibre GL | `maplibre` | 16.36.0 |
| `threedotjs.svg` | Three.js | `threedotjs` | 16.36.0 |
| `postgresql.svg` | PostgreSQL | `postgresql` | 16.36.0 |
| `redis.svg` | Redis | `redis` | 16.36.0 |
| `prisma.svg` | Prisma | `prisma` | 16.36.0 |
| `drizzle.svg` | Drizzle | `drizzle` | 16.36.0 |
| `docker.svg` | Docker | `docker` | 16.36.0 |
| `cloudflare.svg` | Cloudflare | `cloudflare` | 16.36.0 |
| `sentry.svg` | Sentry | `sentry` | 16.36.0 |
| `bun.svg` | Bun | `bun` | 16.36.0 |
| `git.svg` | Git | `git` | 11.0.0 à 16.0.0 (tracé redessiné depuis) |
| `neovim.svg` | Neovim | `neovim` | 16.36.0 |
| `tmux.svg` | tmux | `tmux` | 16.36.0 |

**Sans logo.** AWS n’a pas de pastille : simple-icons a retiré l’icône Amazon Web Services à la demande du titulaire de la marque (absente depuis la 15.0.0), elle n’est donc pas reprise. AWS reste dans l’étiquette DevOps. Les autres outils sans pastille (SQL, Axum, Elysia, REST, PostGIS, Turf.js, DWG/DXF, CI/CD, Monorepo, Agile/Scrum) n’ont pas d’icône dans simple-icons.
