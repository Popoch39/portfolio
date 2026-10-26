// Les deux langues du site et l'adresse de chaque page dans chacune (ADR 0002). Sans import :
// la config d'Astro et les scripts Node le lisent tel quel.

export const locales = ['fr', 'en'] as const;

export type Locale = (typeof locales)[number];

/** Le français, à la racine : ses URL sont celles d'avant l'anglais. */
export const defaultLocale: Locale = 'fr';

/** Une valeur par langue : le typecheck refuse un texte qui n'a pas ses deux langues. */
export type Localized<T> = Record<Locale, T>;

/**
 * La langue d'une page, d'après `Astro.currentLocale`. Astro la déduit du préfixe de l'URL et
 * retombe sur la langue par défaut sans préfixe : une autre valeur est une erreur de config.
 */
export function localeOf(currentLocale: string | undefined): Locale {
	const locale = locales.find((candidate) => candidate === currentLocale);
	if (!locale) throw new Error(`Langue inconnue : ${currentLocale}. L'i18n d'astro.config.mjs doit reprendre \`locales\`.`);
	return locale;
}

/** Une page du site, sans sa langue. `slug` est le segment de la fiche, commun aux deux langues. */
export type Page = { kind: 'home' } | { kind: 'fiche'; slug: string };

export const home: Page = { kind: 'home' };

export const fiche = (slug: string): Page => ({ kind: 'fiche', slug });

/** Segment des fiches : Astro ne traduit pas les segments, ce module s'en charge. */
const ficheSegment: Localized<string> = { fr: 'projets', en: 'projects' };

/**
 * L'adresse d'une page dans une langue, slash final compris : c'est son URL canonique. Seule source
 * des liens internes, de la canonique, des `hreflang` et du sitemap, pour qu'ils ne divergent jamais.
 */
export function pathOf(page: Page, locale: Locale): string {
	const prefix = locale === defaultLocale ? '/' : `/${locale}/`;
	return page.kind === 'home' ? prefix : `${prefix}${ficheSegment[locale]}/${page.slug}/`;
}

/** Les formats de chaque langue : `Intl`, `og:locale`, et `lang` du document comme des `hreflang`. */
export const formats: Localized<{ intl: string; ogLocale: string; lang: string }> = {
	fr: { intl: 'fr-FR', ogLocale: 'fr_FR', lang: 'fr' },
	en: { intl: 'en-GB', ogLocale: 'en_GB', lang: 'en' },
};

/** La copie d'interface des composants (titres de section, mentions, libellés ARIA, boutons). */
export const ui = {} satisfies Record<string, Localized<string>>;
