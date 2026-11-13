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
export const cafe: Dictionary['cafe'] = {
	aside: 'we put it together, then we talk',
	titleLines: ['Let’s talk about', 'your project', 'over a coffee.'],
	steps: [
		'0/6 · in pieces',
		'0/6 · the boiler',
		'1/6 · the funnel and the coffee',
		'2/6 · the filter',
		'3/6 · the gasket',
		'4/6 · screwing on the top, one turn',
		'5/6 · the lid',
		'6/6 · on the stove',
	],
	figure:
		'A Moka Express in pieces above a gas burner, put back together piece by piece as you scroll before the flame is lit.',
	tags: { name: 'the lid', email: 'the top', when: 'the filter', message: 'the boiler' },
	call: { title: 'coffee · on video', count: '2 participants', you: 'you' },
	text: (city: string) =>
		`In ${city}, or on a video call if you are further away. Like a moka pot: the pieces go together in order, nothing forced. And no strings attached: at worst, we’ll have had a coffee.`,
	propose: 'Suggest a coffee',
	proposeSubject: 'A coffee?',
	visio: 'Rather on video',
	visioSubject: 'A video call?',
	flavours: {
		cafe: { heading: 'A coffee, in Besançon.', switch: 'rather on video', confirm: 'Sent. See you soon over a coffee.' },
		visio: { heading: 'A video call, wherever you are.', switch: 'rather a coffee', confirm: 'Sent. See you soon on video.' },
	},
	fields: { name: 'Name', email: 'E-mail', when: 'When?', message: 'Message', trap: 'Website' },
	messagePlaceholder: 'optional',
	chips: {
		'Cette semaine': 'This week',
		'La semaine prochaine': 'Next week',
		'Plus tard': 'Later',
	},
	send: 'Send',
	sending: 'sending…',
	noCommitment: 'no strings attached',
	close: 'esc · close',
	again: 'start again',
	counts: ['in pieces', 'one piece in place', 'halfway up', 'nearly assembled', 'ready to heat'],
	figureOpen: (back: number, visio: boolean) =>
		`A Moka Express taken apart above its unlit burner${visio ? ', inside a screen’s frame' : ''}: ${back} of 4 pieces back in place.`,
	missingNames: { name: 'your name', email: 'your e-mail', when: 'when' },
	missing: (names: string[]) => `still up in the air: ${names.join(', ')}`,
	failed: (address: string) => `not sent: try again, or write to ${address}`,
};
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
