/**
 * The Anagramme at build time (ADR 0011): for the page's language, every animated block of the top of
 * the page, paired letter by letter with the other language's, each line already broken, for every
 * width its host can have. What the page receives as data (`anagram.ts` turns it into plans), and the
 * rules that pick, by media or container query, which layout each overlay follows.
 */
import { getRelativeLocaleUrl } from 'astro:i18n';
import { contentOf } from '../data/profile';
import { dictionary, languages, type Lang } from '../i18n';
import { line, restingOn, slotStarts } from '../lede/buffer';
import { COLUMNS, lineStarts } from '../lede/lines';
import type { AnagramData, Block, Decoration, Placement, Variant } from './anagram';

/**
 * Left to right through the target, each letter takes the nearest free occurrence of itself in the
 * source, by its place in its text from 0 to 1 (the board's `pairUp`). Returns `[source, target]`
 * indices of the letters that travel.
 */
export function pairUp(source: string, target: string): [number, number][] {
	const at = (text: string, index: number) => index / Math.max(1, text.length - 1);
	const free = [...source].flatMap((char, index) => (/\s/.test(char) ? [] : [index]));
	const used = new Set<number>();
	const pairs: [number, number][] = [];
	[...target].forEach((char, to) => {
		if (/\s/.test(char)) return;
		let best = -1;
		let distance = Infinity;
		for (const from of free) {
			if (used.has(from) || source[from] !== char) continue;
			const d = Math.abs(at(source, from) - at(target, to));
			if (d < distance - 1e-9) {
				distance = d;
				best = from;
			}
		}
		if (best < 0) return;
		used.add(best);
		pairs.push([best, to]);
	});
	return pairs;
}

/** A block's layouts, each under the CSS condition it holds in; the first one has none. */
interface Layouts {
	variants: Variant[];
	when: (string | null)[];
}

const single = (from: Placement = {}, to: Placement = {}): Layouts => ({ variants: [{ from, to }], when: [null] });

/**
 * Wrapped by the browser on a box whose width follows the window: one layout per span of columns where
 * both texts break alike, each picked by a container query in the host's own `ch`.
 */
function byColumns(from: string, to: string, min: number, max: number): Layouts {
	const groups: { key: string; widest: number; variant: Variant }[] = [];
	for (let columns = max; columns >= min; columns--) {
		const b = [lineStarts(from, columns), lineStarts(to, columns)];
		const key = JSON.stringify(b);
		if (groups.at(-1)?.key === key) continue;
		groups.push({ key, widest: columns, variant: { from: { b: b[0] }, to: { b: b[1] } } });
	}
	return {
		variants: groups.map((group) => group.variant),
		when: groups.map((group, i) => (i === 0 ? null : `@container (width < ${group.widest + 1}ch)`)),
	};
}

/** The Accroche's tiers (`lines.ts`), with the media queries `Lede.astro` breaks them on. */
function byTier(from: string, to: string): Layouts {
	return {
		variants: [
			{ from: { b: lineStarts(from, COLUMNS.desk) }, to: { b: lineStarts(to, COLUMNS.desk) } },
			{ from: { b: lineStarts(from, COLUMNS.phone) }, to: { b: lineStarts(to, COLUMNS.phone) } },
		],
		when: [null, '@media (max-width: 600px)'],
	};
}

interface Spec extends Omit<Block, 'pairs' | 'variants' | 'from' | 'to'> {
	text: Record<Lang, string>;
	layouts: (from: string, to: string) => Layouts;
}

/** The sun's tokens that are not letters, by their private character. */
const SUN_UNITS = {
	'': 'svg:nth-of-type(1)',
	'': '[data-sun="rise"]',
	'': 'svg:nth-of-type(2)',
	'': '[data-sun="set"]',
};
/** An icon, then the row's 7px gap. */
const ICON: [number, number] = [0, 20];
/** A time, five columns (`07:52`), then its 6px margin (every span after an icon has it) and the gap. */
const TIME: [number, number] = [5, 13];

/** Sunrise and sunset as the statusline lays them out: `[icon] lever 07:52 [icon] coucher 16:58`. */
function sunText(lang: Lang) {
	const { rise, set } = dictionary(lang).sky;
	return `${rise} ${set} `;
}

/** The words are not drawn under 1041px (`Statusline.astro`): they take no room and do not show. */
function sunPlacement(text: string, words: boolean): Placement {
	const w: [number, number, number][] = [];
	const h: number[] = [];
	[...text].forEach((char, index) => {
		if (char === '' || char === '') w.push([index, ...ICON]);
		else if (char === '') w.push([index, ...TIME]);
		// The last time keeps its margin too: the row's end is past it.
		else if (char === '') w.push([index, 5, 6]);
		else if (!words) {
			w.push([index, 0, 0]);
			h.push(index);
		}
	});
	return { w, h };
}

/** The button's label, its gap (10px, the button's), then its mark: `Écrire :wq`. */
const label = (lang: Lang) => `${dictionary(lang).hero.write} :wq`;
const MARK = ':wq';
const BUTTON_GAP = 10;
const BUTTON_PADDING = 40;
/** The label's size, px (`HeroSheet.astro`). */
const LABEL_SIZE = 15;

function labelPlacement(text: string): Placement {
	return { w: [[text.length - MARK.length - 1, 0, BUTTON_GAP]] };
}

/** Each section link's shift in the other language, columns: right-aligned on a desk, left-aligned on a phone. */
function navShifts(from: string[], to: string[]) {
	const delta = from.map((text, i) => text.length - to[i].length);
	return {
		desk: delta.map((_, i) => delta.slice(i).reduce((sum, d) => sum + d, 0)),
		phone: delta.map((_, i) => -delta.slice(0, i).reduce((sum, d) => sum + d, 0)),
	};
}

function ledeDecorations(lang: Lang, version: number): Decoration[] {
	const { lede } = contentOf(lang);
	const state = restingOn(lede, version);
	const starts = slotStarts(lede, state);
	return [
		['u', starts.what, starts.what + state.what.length],
		['u', starts.whose, starts.whose + state.whose.length],
		['c', state.cursor, state.cursor + 1],
	];
}

function blockOf(spec: Spec, from: Lang, to: Lang): { block: Block; when: (string | null)[] } {
	const { text, layouts, ...rest } = spec;
	const { variants, when } = layouts(text[from], text[to]);
	// The board pairs once, English as the target, and plays it both ways: going back undoes the way out.
	const pairs = from === 'en' ? pairUp(text.fr, text.en).map(([fr, en]) => [en, fr]) : pairUp(text.fr, text.en);
	return { block: { ...rest, from: text[from], to: text[to], pairs: pairs.flat(), variants }, when };
}

const byLang = <T>(of: (lang: Lang) => T) => Object.fromEntries(languages.map((lang) => [lang, of(lang)])) as Record<Lang, T>;

export function anagramOf(lang: Lang): { data: AnagramData; rules: string } {
	const other = languages.find((code) => code !== lang)!;
	const rules = new Map<string, (string | null)[]>();
	const add = (spec: Spec) => {
		const { block, when } = blockOf(spec, lang, other);
		rules.set(block.key, when);
		return block;
	};

	const content = byLang(contentOf);
	const sections = byLang((code) => Object.values(dictionary(code).header.sections));
	const shifts = navShifts(sections[lang], sections[other]);
	const header = { size: 13, lh: 1.5, align: 'left' as const };
	const metaColumns = (from: string, to: string) => byColumns(from, to, 16, 60);

	const blocks = [
		add({ key: 'role', host: 'role', delay: 0, ...header, text: byLang((code) => content[code].jobTitle), layouts: metaColumns }),
		add({ key: 'spec-long', host: 'spec-long', delay: 40, ...header, text: byLang((code) => content[code].specialty), layouts: metaColumns }),
		add({
			key: 'spec-short',
			host: 'spec-short',
			delay: 40,
			...header,
			size: 12,
			align: 'right',
			text: byLang((code) => content[code].specialtyShort),
			layouts: () => single(),
		}),
		...sections[lang].map((_, i) =>
			add({
				key: 'nav',
				host: `nav-${i}`,
				delay: 80,
				size: 12,
				lh: 1.5,
				align: 'left',
				text: byLang((code) => sections[code][i]),
				layouts: () => ({
					variants: [
						{ from: {}, to: { o: [shifts.desk[i], 0] } },
						{ from: {}, to: { o: [shifts.phone[i], 0] } },
					],
					when: [null, '@media (max-width: 860px)'],
				}),
			}),
		),
		add({
			key: 'label',
			host: 'label',
			delay: 200,
			size: LABEL_SIZE,
			lh: 1.5,
			align: 'left',
			text: byLang(label),
			layouts: (from, to) => single(labelPlacement(from), labelPlacement(to)),
			deco: {
				from: [['m', label(lang).length - MARK.length, label(lang).length]],
				to: [['m', label(other).length - MARK.length, label(other).length]],
			},
			// The ink box from one label to the other, its padding and gap fixed, the label in columns.
			scale:
				(BUTTON_PADDING + BUTTON_GAP + (label(other).length - 1) * 0.618 * LABEL_SIZE) /
				(BUTTON_PADDING + BUTTON_GAP + (label(lang).length - 1) * 0.618 * LABEL_SIZE),
			// GitHub, after the button: it moves as much as the label's length changes. In px, from the
			// advance unrounded: up to a third of a pixel off where the browser rounds it.
			follow: ['.hero-actions', '.hero-github', (label(other).length - label(lang).length) * 0.618 * LABEL_SIZE],
		}),
		add({ key: 'file', host: 'file', delay: 140, size: 12, lh: 2.5, align: 'left', text: byLang((code) => dictionary(code).statusline.file), layouts: () => single() }),
		add({ key: 'bottom', host: 'bottom', delay: 220, size: 12, lh: 2.5, align: 'left', text: byLang((code) => dictionary(code).statusline.bottom), layouts: () => single() }),
		add({
			key: 'sun',
			host: 'sun',
			delay: 180,
			size: 12,
			lh: 2.5,
			align: 'right',
			text: byLang(sunText),
			units: SUN_UNITS,
			shifted: true,
			layouts: (from, to) => ({
				variants: [
					{ from: sunPlacement(from, true), to: sunPlacement(to, true) },
					{ from: sunPlacement(from, false), to: sunPlacement(to, false) },
				],
				when: [null, '@media (max-width: 1040px)'],
			}),
		}),
	];

	const versions = content[lang].lede.versions.map((_, version) => {
		const ledeText = byLang((code) => line(content[code].lede, restingOn(content[code].lede, version)));
		const audience = byLang((code) => dictionary(code).ledeLine.audience(content[code].lede.versions[version].audience));
		return [
			add({
				key: 'lede',
				host: 'lede',
				delay: 60,
				size: 30,
				lh: 1.22,
				align: 'left',
				text: ledeText,
				layouts: byTier,
				deco: { from: ledeDecorations(lang, version), to: ledeDecorations(other, version) },
			}),
			add({
				key: `audience-${version}`,
				host: 'audience',
				delay: 160,
				size: 12,
				lh: 1.5,
				align: 'left',
				text: audience,
				layouts: (from, to) => byColumns(from, to, 24, 100),
			}),
		];
	});

	const papers = Object.fromEntries(
		PAPERS.map((paper) => {
			const text = byLang((code) => paperText(code, paper));
			const prefix = (code: Lang) => paperText(code, paper).length - paperName(code, paper).length;
			const narrow = (code: Lang): Placement => {
				const hidden = [...Array(prefix(code)).keys()];
				return { w: hidden.map((index) => [index, 0, 0]), h: hidden };
			};
			return [
				paper,
				add({
					key: 'paper',
					host: 'paper',
					delay: 200,
					size: 12,
					lh: 2.5,
					align: 'right',
					text,
					deco: { from: [['m', 0, prefix(lang)]], to: [['m', 0, prefix(other)]] },
					layouts: () => ({
						variants: [
							{ from: {}, to: {} },
							{ from: narrow(lang), to: narrow(other) },
						],
						when: [null, '@media (max-width: 860px)'],
					}),
				}),
			];
		}),
	);

	return {
		data: { to: getRelativeLocaleUrl(other), blocks, versions, paper: paperShifts(lang, other), papers },
		rules: variantRules(rules),
	};
}

/** The statusline's papers (`Statusline.astro`): `auto` by day or by night, then the Nuancier's own. */
const PAPERS = [
	'auto-day',
	'auto-night',
	'light',
	'dark',
	'solarized-light',
	'nord',
	'gruvbox-light',
	'catppuccin-mocha',
	'tokyo-night',
] as const;

type Paper = (typeof PAPERS)[number];

/** Each paper's code and, for the colour schemes, its name, as `Statusline.astro` writes them. */
const PAPER_CODES: Record<Paper, string> = {
	'auto-day': 'EN-04',
	'auto-night': 'EN-04',
	light: 'EN-01',
	dark: 'EN-02',
	'solarized-light': 'EN-03',
	nord: 'EN-05',
	'gruvbox-light': 'EN-06',
	'catppuccin-mocha': 'EN-07',
	'tokyo-night': 'EN-08',
};

function paperName(lang: Lang, paper: Paper) {
	const { papers } = dictionary(lang).nuancier;
	const name = (key: 'auto' | 'light' | 'dark') => papers[key].name.toLowerCase();
	if (paper === 'auto-day') return `${name('auto')} · ${name('light')}`;
	if (paper === 'auto-night') return `${name('auto')} · ${name('dark')}`;
	if (paper === 'light' || paper === 'dark') return name(paper);
	return papers[paper].name.toLowerCase();
}

/** The segment as a wide statusline shows it: `papier EN-04 · auto · jour`; a narrow one, the name alone. */
function paperText(lang: Lang, paper: Paper) {
	return `${dictionary(lang).statusline.paper} ${PAPER_CODES[paper]} · ${paperName(lang, paper)}`;
}

/** Each variant after the first takes over its glyphs' custom properties under its condition. */
function variantRules(rules: Map<string, (string | null)[]>) {
	const props = ['bx', 'ax', 'by', 'ay', 'h', 't', 'z', 'dp'];
	return [...rules]
		.flatMap(([key, when]) =>
			when.flatMap((condition, v) =>
				condition ? [`${condition}{[data-ag-key="${key}"]>.g{${props.map((p) => `--${p}:var(--${p}${v})`).join(';')}}}`] : [],
			),
		)
		.join('\n');
}

/**
 * How many columns shorter the statusline's paper segment gets from one language to the other, for each
 * paper and both widths (`Statusline.astro`): the sun, right of nothing but it and fixed segments, moves
 * right by as much. The code and the separators are the same in both languages.
 */
function paperShifts(from: Lang, to: Lang): Record<string, number> {
	const shifts: Record<string, number> = {};
	// The colour schemes' names are the same in every language: one of them stands for all (`named`).
	const papers: [string, Paper][] = [
		['auto-day', 'auto-day'],
		['auto-night', 'auto-night'],
		['light', 'light'],
		['dark', 'dark'],
		['named', 'nord'],
	];
	for (const [key, paper] of papers) {
		shifts[`${key}-n`] = paperName(from, paper).length - paperName(to, paper).length;
		shifts[`${key}-w`] = paperText(from, paper).length - paperText(to, paper).length;
	}
	return shifts;
}
