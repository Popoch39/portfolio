# Français à la racine, anglais sous /en/, sans redirection

Le site a deux versions de chaque page. La version française reste à la racine, aux URL d'aujourd'hui ; la version anglaise vit sous `/en/`, avec des segments traduits (`/en/projects/<slug>/` pour `/projets/<slug>/`). Le site ne redirige jamais selon la langue du navigateur : chaque URL sert toujours la même version, et le visiteur change de langue par un lien. Les `hreflang` de chaque page déclarent `fr`, `en` et `x-default`, et `x-default` désigne la version anglaise. On garde ainsi toutes les URL déjà partagées, deux versions que les moteurs explorent sans condition, et l'anglais pour qui ne lit aucune des deux langues.

## Considered Options

- **Les deux langues préfixées** (`/fr/` et `/en/`) : écartées. En site statique, la racine ne peut devenir qu'une redirection par meta refresh, et toutes les URL existantes changent.
- **Redirection selon `Accept-Language`** : écartée. Googlebot explore sans cet en-tête, depuis les États-Unis, et risque de ne voir qu'une seule langue ; une URL partagée ne montrerait pas la même page à tous.
- **`x-default` vers le français** : écarté. Les visiteurs qui ne parlent ni français ni anglais sont la cible internationale du site (recruteurs, équipes en remote), que l'anglais sert mieux.

## Consequences

Le routage i18n d'Astro est configuré avec `fr` par défaut, sans préfixe, et `en` préfixée. Les segments traduits ne sont pas gérés par Astro : une seule fonction de routes, dans le module i18n, donne l'adresse de chaque page dans chaque langue, et tous les liens internes, la canonique, les `hreflang` et le sitemap en dérivent.
