/**
 * The site's languages. A leaf module, free of any dictionary: client scripts import it to read the
 * page's language without bundling every text of the site.
 */

/** The first is the default one, served at `/`. */
export const languages = ['fr', 'en'] as const;

export type Lang = (typeof languages)[number];

export const defaultLang: Lang = languages[0];

/** The page's language, as `<html lang>` says it: what a client script picks its texts by. */
export function pageLang(): Lang {
	const lang = document.documentElement.lang;
	return languages.find((known) => known === lang) ?? defaultLang;
}

/**
 * A client script's texts for the page's language, from a table of one dictionary section per language:
 * importing only that section keeps the rest of the dictionaries out of the bundle.
 */
export function forPage<T>(byLang: Record<Lang, T>): T {
	return byLang[pageLang()];
}
