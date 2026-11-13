/**
 * The Anagramme's data (ADR 0011): what the build hands the page, and the arithmetic that turns it into
 * each letter's plan. The build pairs the letters and breaks the lines; the page only adds columns up:
 * a letter's place is `columns × 1ch + px`, the `ch` of its own font, which is the advance the browser
 * draws the mono with (rounded to a whole pixel where it rounds them). Nothing is ever measured.
 *
 * Timings, curves and the pairing are the board's (06 · Anagramme, `project/Anagramme.dc.html`).
 */

/** One text's layout in one variant of its block. Defaults: one line, every token one column wide. */
export interface Placement {
	/** Where each line after the first starts, in the text. */
	b?: number[];
	/** Tokens whose width is not one column: `[index, columns, px]`. */
	w?: [number, number, number][];
	/** Tokens this variant does not draw. */
	h?: number[];
	/** Added to every position: `[columns, px]`, where the host itself sits elsewhere in that language. */
	o?: [number, number];
}

/** A layout of both texts under one CSS condition; the first variant of a block has none. */
export interface Variant {
	from: Placement;
	to: Placement;
}

/** How a glyph is drawn at rest, by ranges of the text: `m` the mark, `u` a slot's underline, `c` the cursor. */
export type Decoration = [kind: 'm' | 'u' | 'c', start: number, end: number];

export interface Block {
	/** `data-ag-key` of its overlays: what its variants' rules select. */
	key: string;
	/** `data-ag-host` of the elements the overlay goes into, the day's and the night's. */
	host: string;
	delay: number;
	align: 'left' | 'right';
	/** Line height, em. */
	lh: number;
	/** The type size the board's hop is figured on, px. */
	size: number;
	from: string;
	to: string;
	/** `[from, to]` text indices of the letters that travel, flat. */
	pairs: number[];
	variants: Variant[];
	deco?: { from?: Decoration[]; to?: Decoration[] };
	/** Tokens that are not letters, by their private character: a selector of the element cloned, in the host. */
	units?: Record<string, string>;
	/** The host's language-dependent shift that CSS gives (`--ag-shift`), on the target side. */
	shifted?: boolean;
	/** The ink the button is drawn on scales by this much, from the left: the label's box gets shorter or longer. */
	scale?: number;
	/** What stands after the host on its row, and moves with its end: `[scope, element, px]`, both selectors. */
	follow?: [string, string, number];
}

export interface AnagramData {
	/** The other language's page: where the Bascule leads, and where the arrival is checked. */
	to: string;
	/** Blocks that do not depend on the Accroche's version. */
	blocks: Block[];
	/** The Accroche and its audience, for each version. */
	versions: Block[][];
	/** The paper segment's change in length, columns, by paper and by width (`w` wide, `n` narrow): the sun's shift. */
	paper: Record<string, number>;
	/** The paper segment itself, by paper (`auto-day`, `auto-night` or the Nuancier's key): the page's one is played. */
	papers: Record<string, Block>;
}

/** The board's timings, ms; its curves are in the stylesheet (`Anagramme.astro`). */
const TRAVEL = 860;
const SINK = 280;
const RISE = 380;

/** Fragment Mono's advance, em, for the hop's size only: positions are in `ch`. */
const ADVANCE = 0.618;
/** How far a letter sinks or rises from, em. */
const SINK_EM = 0.4;

export type Kind = 'pair' | 'out' | 'in';

interface Spot {
	row: number;
	cols: number;
	px: number;
	hidden: boolean;
}

/** Every token's place in a text under a placement, by its index. */
export function place(text: string, placement: Placement, align: Block['align']): Spot[] {
	const starts = [0, ...(placement.b ?? []), text.length];
	const widths = new Map((placement.w ?? []).map(([index, cols, px]) => [index, [cols, px] as const]));
	const hidden = new Set(placement.h);
	const [shiftCols, shiftPx] = placement.o ?? [0, 0];
	const spots: Spot[] = [];
	for (let row = 0; row < starts.length - 1; row++) {
		let cols = 0;
		let px = 0;
		// A right-aligned line ends on its last letter: trailing spaces hang, as in CSS.
		let endCols = 0;
		let endPx = 0;
		for (let index = starts[row]; index < starts[row + 1]; index++) {
			spots[index] = { row, cols, px, hidden: hidden.has(index) };
			const [wCols, wPx] = widths.get(index) ?? [1, 0];
			cols += wCols;
			px += wPx;
			if (!/\s/.test(text[index])) [endCols, endPx] = [cols, px];
		}
		for (let index = starts[row]; index < starts[row + 1]; index++) {
			const spot = spots[index];
			if (align === 'right') {
				spot.cols -= endCols;
				spot.px -= endPx;
			}
			spot.cols += shiftCols;
			spot.px += shiftPx;
		}
	}
	return spots;
}

/** The non-space tokens of a text, in reading order: the board's `seq` is a letter's rank here. */
export function glyphs(text: string) {
	return [...text].flatMap((char, index) => (/\s/.test(char) ? [] : [index]));
}

export interface GlyphPlan {
	kind: Kind;
	char: string;
	/** Its index in the source text (`out`, `pair`) and in the target text (`in`, `pair`). */
	from?: number;
	to?: number;
	delay: number;
	duration: number;
	/** Per variant, the CSS values of its custom properties. */
	variants: Record<string, string>[];
}

const length = (cols: number, px: number) => `calc(${round(cols)}ch + ${round(px)}px)`;
const round = (value: number) => Math.round(value * 1000) / 1000;

/**
 * Each glyph's plan for a block, from its source to its target: the board's `plan`, its delays and its
 * hop, written as the custom properties the stylesheet reads (`--bx`, `--ax`: x before and after; `--by`,
 * `--ay`: y; `--h`: the hop, em; `--t`: the tint's strength; `--z`; `--dp`: shown or not).
 */
export function planBlock(block: Block): GlyphPlan[] {
	const fromGlyphs = glyphs(block.from);
	const toGlyphs = glyphs(block.to);
	const fromSeq = new Map(fromGlyphs.map((index, seq) => [index, seq]));
	const toSeq = new Map(toGlyphs.map((index, seq) => [index, seq]));
	const pairs: [number, number][] = [];
	for (let i = 0; i < block.pairs.length; i += 2) pairs.push([block.pairs[i], block.pairs[i + 1]]);
	const paired = { from: new Set(pairs.map(([from]) => from)), to: new Set(pairs.map(([, to]) => to)) };
	const items: { kind: Kind; from?: number; to?: number }[] = [
		...pairs.map(([from, to]) => ({ kind: 'pair' as const, from, to })),
		...toGlyphs.filter((index) => !paired.to.has(index)).map((to) => ({ kind: 'in' as const, to })),
		...fromGlyphs.filter((index) => !paired.from.has(index)).map((from) => ({ kind: 'out' as const, from })),
	];
	const stagger = Math.min(14, 320 / Math.max(1, items.length));
	// A slot's underline runs under its spaces too: they leave and come like letters, nothing but the line drawn.
	const underlined = (text: string, deco: Decoration[] | undefined) =>
		[...text].flatMap((char, index) =>
			/\s/.test(char) && (deco ?? []).some(([kind, start, end]) => kind === 'u' && index >= start && index < end) ? [index] : [],
		);
	const rankOf = (glyphIndices: number[], index: number) => glyphIndices.filter((glyph) => glyph < index).length;
	for (const from of underlined(block.from, block.deco?.from)) {
		items.push({ kind: 'out', from });
		fromSeq.set(from, rankOf(fromGlyphs, from));
	}
	for (const to of underlined(block.to, block.deco?.to)) {
		items.push({ kind: 'in', to });
		toSeq.set(to, rankOf(toGlyphs, to));
	}
	const layouts = block.variants.map((variant) => ({
		from: place(block.from, variant.from, block.align),
		to: place(block.to, variant.to, block.align),
	}));
	const shift = block.shifted ? ' + var(--ag-shift, 0px)' : '';

	return items.map(({ kind, from, to }) => {
		const char = kind === 'in' ? block.to[to!] : block.from[from!];
		let delay: number;
		let duration: number;
		if (kind === 'pair') {
			delay = Math.round(block.delay + 40 + toSeq.get(to!)! * stagger);
			duration = TRAVEL;
		} else if (kind === 'in') {
			delay = Math.round(block.delay + TRAVEL * 0.55 + toSeq.get(to!)! * 12);
			duration = RISE;
		} else {
			delay = Math.round(block.delay + fromSeq.get(from!)! * 8);
			duration = SINK;
		}
		const variants = layouts.map((layout) => {
			const source = from === undefined ? undefined : layout.from[from];
			const target = to === undefined ? undefined : layout.to[to];
			const start = source ?? target!;
			const end = target ?? source!;
			const bx = length(start.cols, start.px);
			const ax = target ? `calc(${length(end.cols, end.px)}${shift})` : bx;
			const by = start.row * block.lh + (kind === 'in' ? SINK_EM : 0);
			const ay = end.row * block.lh + (kind === 'out' ? SINK_EM : 0);
			let hop = 0;
			if (kind === 'pair') {
				const dx = (end.cols - start.cols) * ADVANCE + (end.px - start.px) / block.size;
				const dy = (end.row - start.row) * block.lh;
				if (dx !== 0 || dy !== 0) {
					const magnitude = Math.min(0.55, Math.max(0.22, Math.abs(dx) * 0.06 + Math.abs(dy) * 0.3));
					// Rightward letters pass over, leftward ones under: crossing paths never collide.
					hop = dx >= 0 ? -magnitude : magnitude;
				}
			}
			return {
				bx,
				ax,
				by: `${round(by)}em`,
				ay: `${round(ay)}em`,
				h: String(round(hop)),
				t: hop === 0 ? '0' : '1',
				z: hop === 0 ? '1' : '2',
				dp: start.hidden || lineEndSpace(kind === 'in' ? layout.to : layout.from, (to ?? from)!, char) ? 'none' : 'block',
			};
		});
		return { kind, char, from, to, delay, duration, variants };
	});
}

/** A space that ends its line: the browser underlines nothing there. */
function lineEndSpace(spots: Spot[], index: number, char: string) {
	return /\s/.test(char) && spots[index + 1]?.row !== spots[index].row;
}

/** The Anagramme's length for a set of plans, ms: when the last letter has landed. */
export function totalOf(plans: GlyphPlan[]) {
	return Math.max(0, ...plans.map((plan) => plan.delay + plan.duration));
}

/** The session key the version crosses the navigation under (ADR 0011): read once, then removed. */
export const ARRIVAL_KEY = 'bascule';
