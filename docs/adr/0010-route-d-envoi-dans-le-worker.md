# 0010 · Route d'envoi : `send_email` dans le Worker du site

- Statut : acceptée
- Date : 2026-11-12
- Planche : « A · Le démontage » (canvas « Café · Montage → formulaire », artifact BY5NSpN54ft3aQ9Qw71AGN)
- Spec : #111, ticket #112

## Contexte

Les deux actions du Café, « Proposer un café » et « Plutôt en visio », n'étaient que des liens `mailto` : le visiteur quittait le site pour son client mail, devant une page blanche. Le Formulaire du Café les remplace sur place, et son message doit réellement partir chez Louis. Le site est statique (Astro, sortie `static`) et servi par un Worker Cloudflare réduit à ses assets ; il n'avait jusque-là aucune logique serveur. CLAUDE.md exclut tout script tiers sans accord et veut des pages statiques.

## Décision

- **Une route, dans le Worker qui sert déjà le site.** `worker/index.ts` devient le `main` du Worker. Les assets passent en premier pour toute URL, sauf `/api/*` (`run_worker_first: ["/api/*"]`) : les pages ne réveillent jamais le script, la 404 garde son statut (`not_found_handling: "404-page"`). Une autre URL qui arriverait au script est rendue aux assets (`env.ASSETS.fetch`).
- **`POST /api/contact`**, corps JSON `{ mode: "cafe" | "visio", nom, email, quand, message?, site? }`, `quand` parmi `Cette semaine`, `La semaine prochaine`, `Plus tard`. Réponses : `200` envoyé ; `400` champ manquant, invalide ou trop long, corps illisible ou champ piège rempli ; `429` limite de débit ; `405` autre méthode (avec `Allow: POST`) ; `502` si le binding refuse. Jamais en cache (`no-store`).
- **Le mail par le binding `send_email`**, sa méthode structurée `send()` : texte brut, de `contact@louis-pocheron.com` vers l'adresse de Louis, le visiteur en Reply-To, un sujet par mode (« Un café ? · Nom », « Une visio ? · Nom »). Le binding est épinglé à cette destination et à cet expéditeur dans `wrangler.jsonc`. Pas de MIME écrit à la main, pas d'import `cloudflare:email` : le gestionnaire se teste sous `bun test` avec des bindings simulés.
- **Les robots, sans script tiers.** Un champ piège (`site`), hors de la vue et hors de portée du clavier et des lecteurs d'écran, et le binding Rate Limiting : 5 envois par minute et par IP (`CF-Connecting-IP`), comptés avant toute lecture du corps. Les longueurs sont bornées : nom 100, e-mail 254, message 4 000 caractères, corps 16 Ko ; le nom ne porte aucun caractère de contrôle (il passe dans le sujet). L'e-mail est vérifié par l'expression du standard HTML pour `type=email` : la route accepte ce que le navigateur laisse passer.
- **Le navigateur appelle sa propre origine.** La CSP gagne `connect-src 'self'` explicite ; `form-action 'self'` reste, le formulaire n'est jamais soumis nativement.

## Conséquences

- Premiers tests unitaires du dépôt : `bun test` (ou `bun run test:unit`), limité à `worker/` par `bunfig.toml`, puisque bun ramasserait aussi les `*.spec.ts` de Playwright.
- `astro preview` ne fait pas tourner le Worker : les tests Playwright interceptent `/api/contact` (`page.route`).
- Prérequis côté Louis, hors du dépôt : Email Routing activé sur le domaine, adresse de destination vérifiée, adresse expéditrice `contact@louis-pocheron.com` acceptée par Email Service.
- Rien n'est enregistré au-delà du mail : pas de base, pas de journal des messages (les journaux du Worker ne gardent que les échecs d'envoi).
- La limite de débit est comptée par emplacement Cloudflare et reste approximative : elle freine, elle ne garantit pas.

## Options écartées

- **Garder les `mailto`** : la page blanche du client mail au moment de passer à l'acte, et rien sans client mail configuré.
- **Un service de formulaires tiers** (Formspree, etc.) : un tiers dans la CSP et dans le chemin des données des visiteurs, pour ce que le Worker du site fait déjà.
- **Un adaptateur serveur Astro** (rendu à la demande) : toutes les pages passeraient par le script, pour une seule route.
- **`EmailMessage` et un MIME écrit à la main** : l'API historique, qu'il faut assembler et échapper soi-même ; la méthode structurée la remplace.
- **Un captcha** : un script tiers, et une épreuve pour chaque visiteur à cause de quelques robots.
