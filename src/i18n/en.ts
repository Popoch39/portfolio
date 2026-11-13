/**
 * Every text the visitor reads or hears, in English. It must satisfy the French dictionary's type
 * (`Dictionary`): a key missing here is a type error.
 *
 * Laid out like `fr.ts`, one named export per section, for the same reason: a client script imports
 * the one it needs. Until the English is written (#123), every section but the locale is the French one.
 */
import * as fr from './fr';
import type { Dictionary } from './fr';

export const meta: Dictionary['meta'] = { ...fr.meta, locale: 'en-GB' };
export const content: Dictionary['content'] = fr.content;
export const header: Dictionary['header'] = fr.header;
export const geo: Dictionary['geo'] = fr.geo;
export const hero: Dictionary['hero'] = fr.hero;
export const ledeLine: Dictionary['ledeLine'] = fr.ledeLine;
export const intro: Dictionary['intro'] = fr.intro;
export const sky: Dictionary['sky'] = fr.sky;
export const statusline: Dictionary['statusline'] = fr.statusline;
export const nuancier: Dictionary['nuancier'] = fr.nuancier;
export const frise: Dictionary['frise'] = fr.frise;
export const stackSection: Dictionary['stackSection'] = fr.stackSection;
export const contact: Dictionary['contact'] = fr.contact;
export const cafe: Dictionary['cafe'] = fr.cafe;
export const notFound: Dictionary['notFound'] = fr.notFound;

export const en: Dictionary = {
	meta,
	content,
	header,
	geo,
	hero,
	ledeLine,
	intro,
	sky,
	statusline,
	nuancier,
	frise,
	stackSection,
	contact,
	cafe,
	notFound,
};
