/**
 * The lede as a Vim buffer: one line, two slots (what I build, whose), a cursor and a mode.
 * Pure: the page renders it at build time, the typist again on every keystroke.
 */
import type { Lede } from '../data/profile';
import { breaksOf, type Tier, wrap } from './lines';

export type Mode = 'NORMAL' | 'INSERT';
export type Slot = 'what' | 'whose';

export interface BufferState {
	what: string;
	whose: string;
	/** Index in the line: the block under it in NORMAL mode, the bar before it in INSERT mode. */
	cursor: number;
	mode: Mode;
	/** The slot `ciw` has just selected, about to be replaced. */
	selected?: Slot;
}

export type RunKind = 'text' | 'slot' | 'selected' | 'block' | 'bar' | 'break';

/** A stretch of the line drawn the same way; the bar and the line breaks are empty runs. */
export interface Run {
	text: string;
	kind: RunKind;
	/** A break's tiers: the breakpoints whose lines start there. */
	tiers?: Tier[];
}

/** Where each slot starts in the line. */
export function slotStarts(lede: Lede, state: Pick<BufferState, 'what'>) {
	const what = lede.before.length;
	return { what, whose: what + state.what.length + lede.between.length };
}

/** The buffer at rest on a version: NORMAL mode, the block on the last letter of the second slot. */
export function restingOn(lede: Lede, index: number): BufferState {
	const { what, whose } = lede.versions[index];
	return { what, whose, mode: 'NORMAL', cursor: slotStarts(lede, { what }).whose + whose.length - 1 };
}

export function line(lede: Lede, { what, whose }: Pick<BufferState, 'what' | 'whose'>) {
	return lede.before + what + lede.between + whose + lede.after;
}

export function runs(lede: Lede, state: BufferState): Run[] {
	const text = line(lede, state);
	const starts = slotStarts(lede, state);
	const slotAt = (i: number): Slot | undefined => {
		if (i >= starts.what && i < starts.what + state.what.length) return 'what';
		if (i >= starts.whose && i < starts.whose + state.whose.length) return 'whose';
		return undefined;
	};
	const kindAt = (i: number): RunKind => {
		const slot = slotAt(i);
		if (slot && slot === state.selected) return 'selected';
		if (state.mode === 'NORMAL' && i === state.cursor) return 'block';
		return slot ? 'slot' : 'text';
	};

	const breaks = breaksOf(text);
	const result: Run[] = [];
	for (let i = 0; i <= text.length; i++) {
		const tiers = breaks.get(i);
		if (tiers) result.push({ text: '', kind: 'break', tiers });
		if (state.mode === 'INSERT' && i === state.cursor) result.push({ text: '', kind: 'bar' });
		if (i === text.length) break;
		const kind = kindAt(i);
		const last = result.at(-1);
		if (last && last.kind === kind && kind !== 'block' && kind !== 'bar') last.text += text[i];
		else result.push({ text: text[i], kind });
	}
	return result;
}

/** The last version's second slot as the typist first mistypes it: its last three letters shuffled. */
export function slipped(text: string) {
	return text.slice(0, -3) + text.at(-2) + text.at(-3) + text.at(-1);
}

/**
 * Every line the buffer can show, keystroke after keystroke, as the typist goes from one version to the
 * next: the first slot typed letter by letter, then the second, the last version's slip included.
 */
export function typedLines(lede: Lede) {
	const { versions } = lede;
	const prefixes = (text: string) => [...text].map((_, i) => text.slice(0, i + 1));
	return versions.flatMap((version, i) => {
		const next = versions[(i + 1) % versions.length];
		const slip = i + 1 === versions.length - 1;
		return [
			...['', ...prefixes(next.what)].map((what) => line(lede, { what, whose: version.whose })),
			...['', ...prefixes(slip ? slipped(next.whose) : ''), ...prefixes(next.whose)].map((whose) =>
				line(lede, { what: next.what, whose }),
			),
		];
	});
}

/** The rows the lede needs at its tallest, keystrokes included, on a tier's columns: the height it keeps. */
export function tallestRows(lede: Lede, columns: number) {
	return Math.max(...typedLines(lede).map((text) => wrap(text, columns).length));
}
