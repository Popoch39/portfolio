/**
 * The lede as a Vim buffer: one line, two slots (what I build, whose), a cursor and a mode.
 * Pure: the page renders it at build time, the typist again on every keystroke.
 */
import type { Lede } from '../data/profile';

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

export type RunKind = 'text' | 'slot' | 'selected' | 'block' | 'bar';

/** A stretch of the line drawn the same way; the bar is an empty run. */
export interface Run {
	text: string;
	kind: RunKind;
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

	const result: Run[] = [];
	for (let i = 0; i <= text.length; i++) {
		if (state.mode === 'INSERT' && i === state.cursor) result.push({ text: '', kind: 'bar' });
		if (i === text.length) break;
		const kind = kindAt(i);
		const last = result.at(-1);
		if (last && last.kind === kind && kind !== 'block' && kind !== 'bar') last.text += text[i];
		else result.push({ text: text[i], kind });
	}
	return result;
}

/**
 * Every line the buffer shows at rest or halfway between two versions (the first slot already
 * typed, the second not yet): stacked out of sight, they hold the lede at its tallest wrap.
 */
export function tallestLines(lede: Lede) {
	const { versions } = lede;
	return versions.flatMap((version, i) => {
		const next = versions[(i + 1) % versions.length];
		return [line(lede, version), line(lede, { what: next.what, whose: version.whose })];
	});
}
