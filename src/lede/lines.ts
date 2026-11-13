/**
 * The Accroche's lines, in Fragment Mono: every letter has a column (its place is column × ADVANCE),
 * every breakpoint a fixed number of columns, and lines break word by word on that count alone. The
 * browser measures nothing: the build lays out each version, the typist each keystroke, with the same
 * pure functions. Free of any dictionary, so that the typist can bundle it.
 */

/**
 * Columns per tier, the values ADR 0011 records. `phone` is a window of 600px or less, `desk` any wider
 * (`Lede.astro` holds the media queries): 26 columns set the board's "Je construis les cartes de" on
 * one line; 18 is what a 320px window's lede (222px) holds above 20px of type.
 */
export const COLUMNS = { desk: 26, phone: 18 } as const;

/**
 * Fragment Mono's advance, in em: 618 units of 1000, not the 0.6 of the board. Without subpixel text
 * positioning (Chromium on Linux) the browser rounds it to a whole pixel, up to half a pixel more per
 * column: `Lede.astro` sizes the type to hold that too.
 */
export const ADVANCE = 0.618;

export type Tier = keyof typeof COLUMNS;

export const tiers = Object.keys(COLUMNS) as Tier[];

/** A letter's place in the laid-out text: what the Anagramme pairs, from one language to the other. */
export interface Cell {
	char: string;
	/** Index in the whole text. */
	index: number;
	row: number;
	col: number;
}

/**
 * Where each line after the first starts, in the text. Greedy, word by word: a word goes on the line if
 * it fits there, its trailing spaces hanging past the last column as they do in CSS; a word longer than
 * a whole line is cut at the column.
 */
export function lineStarts(text: string, columns: number): number[] {
	const starts: number[] = [];
	let lineStart = 0;
	let index = 0;
	for (const token of text.match(/\S+\s*|\s+/g) ?? []) {
		const word = token.trimEnd().length;
		if (index > lineStart && index - lineStart + word > columns) {
			starts.push(index);
			lineStart = index;
		}
		while (index + word - lineStart > columns) {
			lineStart += columns;
			starts.push(lineStart);
		}
		index += token.length;
	}
	return starts;
}

/** The text as lines, each with its trailing spaces: joined again, they give the text back. */
export function wrap(text: string, columns: number): string[] {
	const bounds = [0, ...lineStarts(text, columns), text.length];
	return bounds.slice(0, -1).map((start, i) => text.slice(start, bounds[i + 1]));
}

/** Every letter of the lines with its row and column; spaces have no cell. */
export function cells(lines: string[]): Cell[] {
	const result: Cell[] = [];
	let index = 0;
	lines.forEach((line, row) => {
		[...line].forEach((char, col) => {
			if (!/\s/.test(char)) result.push({ char, index: index + col, row, col });
		});
		index += line.length;
	});
	return result;
}

/**
 * The most rows any of these texts takes, wrapped by the browser on a box `columns` wide, for every
 * width from `max` columns down to `min`, as container rules in the box's own `ch`: a box that keeps
 * this height keeps it whatever its language and its version, so that nothing below it moves when the
 * text changes (the Bascule, ADR 0011). `selector` is a child of the query container.
 */
export function tallestRules(selector: string, texts: string[], min: number, max: number) {
	const rules: string[] = [];
	let last = 0;
	for (let columns = max; columns >= min; columns--) {
		const rows = Math.max(...texts.map((text) => wrap(text, columns).length));
		if (rows === last) continue;
		const block = `${selector}{min-height:${rows}lh}`;
		rules.push(columns === max ? block : `@container (width < ${columns + 1}ch){${block}}`);
		last = rows;
	}
	return rules.join('\n');
}

/** Where a line starts in the text, for each tier that starts one there. */
export function breaksOf(text: string): Map<number, Tier[]> {
	const breaks = new Map<number, Tier[]>();
	for (const tier of tiers) {
		for (const start of lineStarts(text, COLUMNS[tier])) breaks.set(start, [...(breaks.get(start) ?? []), tier]);
	}
	return breaks;
}
