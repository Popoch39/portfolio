/**
 * The dictionaries, by language, for the build. Client scripts import a section of a dictionary and
 * `forPage` instead (`lang.ts`), so as not to bundle all of them.
 */
import type { Lang } from './lang';
import { type Dictionary, fr } from './fr';

export { defaultLang, languages, type Lang } from './lang';
export type { Dictionary };

const dictionaries: Record<Lang, Dictionary> = { fr };

export function dictionary(lang: Lang): Dictionary {
	return dictionaries[lang];
}
