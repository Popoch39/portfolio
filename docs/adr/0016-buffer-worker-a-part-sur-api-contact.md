# Buffer : un Worker à part sur `/api/contact`, et un envoi natif d'abord

_Premier jet (ticket #117) : la fenêtre `contact.md` et le script du Buffer viennent avec les tickets suivants de la spec #116._

Le site reste statique sur Cloudflare Pages, avec ses `_headers` et ses Early Hints. Le mail du Buffer part d'un **Worker séparé** (`worker/contact.ts`, configuré par `worker/wrangler.jsonc`), déployé à part avec `pnpm worker:deploy` et routé sur `<domaine>/api/contact`, le même domaine que le site : une route de Worker passe avant Pages sur sa zone, et le reste du domaine n'est pas touché. Même origine, donc ni CORS, ni requête preflight, ni connexion TLS de plus.

Le Worker n'accepte que `POST /api/contact` venu de l'origine du site (`Origin` exigé et égal à `SITE_ORIGIN`) ; il lit un corps urlencoded ou multipart, valide les champs avec les codes du Buffer (E1 type, E2 email, E3 message, E4 tout autre champ invalide ou trop long), répond « succès » sans rien envoyer à un robot (pot de miel `site` rempli, ou délai `delai` fourni et sous 3 s), limite les envois par IP (`CF-Connecting-IP`, binding Rate Limiting, 2 par période de 60 s, comptés après la validation), puis écrit à Louis par le binding `send_email` et son API structurée (`to`, `from`, `replyTo`, `subject`, `text`) : objet `[portfolio] <type> — <nom>` (l'adresse quand le nom manque), Reply-To du visiteur, texte brut façon `contact.md`. Une limite atteinte ou un envoi refusé donne E5. Le binding est restreint à l'adresse vérifiée de Louis (`destination_address`) : pas d'accusé de réception au visiteur.

Le Buffer est du **HTML d'abord** : un vrai `form` en POST vers `/api/contact`, des radios natives pour le type et le budget, un libellé par champ. Sans JS, le Worker répond par une redirection **303** vers l'ancre de la section Contact (`#contact-ok`, `#contact-e1` à `#contact-e5`), dans la Version de la page (racine ou `/en/`, ADR 0002) ; le message visé, déjà dans le HTML, s'affiche par `:target`. Le script, chargé plus tard au premier focus, demandera `Accept: application/json` et recevra `{ ok, code? }`.

Le destinataire, l'expéditeur, l'origine admise et la route sont des réglages de `wrangler.jsonc`, provisoires comme `site` d'`astro.config.mjs` ; la route reste commentée tant que le domaine n'est pas choisi. En local, `pnpm worker:dev` lance le Worker sur le port 8787 avec l'origine `http://localhost:4321`, et le serveur de dev d'Astro relaie `/api` vers lui (`vite.server.proxy`) : le Buffer poste sur la même origine qu'en ligne, et wrangler simule `send_email` en écrivant le mail sur la console et dans un fichier.

## Considered Options

- **Migrer le site vers un Worker avec static assets** : écarté. Les static assets d'un Worker ne servent pas les Early Hints que Pages tire des `_headers` (spec #46).
- **Un sous-domaine `api.`** : écarté. Une autre origine impose CORS, une requête preflight pour l'envoi en JSON et une connexion de plus.
- **Un formulaire en JS seulement** (la planche D · :wq) : écarté. Sans JS, ou avant que le script n'arrive, le visiteur ne pourrait pas écrire ; le natif ne coûte que quelques centaines d'octets de HTML.
- **Un défi anti-robot tiers (Turnstile)** : écarté. Un script tiers sur l'accueil pour un risque que le pot de miel, le délai et la limite par IP couvrent.
- **Un seul message d'erreur sans JS** : écarté. Une ancre par code dit au visiteur quoi corriger, pour une ligne de HTML chacune.

## Consequences

`wrangler` entre en devDependency, seule nouvelle dépendance. Le Worker est un module sans import, que les tests (`tests/worker-contact.test.mjs`) importent sous Node avec une vraie `Request` et un `env` simulé. L'accueil gagne le HTML du Buffer et ses messages (moins d'un kilo-octet en Brotli) et reste sous son budget de 90 Ko. La mise en ligne (domaine sur Cloudflare, Email Routing, adresse vérifiée, route) est une étape à part.
