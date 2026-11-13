/**
 * The Accroche laid out at build time, in a language: for each tier, its columns, the lines of each
 * version at rest and the rows it keeps. What the page renders, and what the Anagramme pairs from one
 * language to the other (`cells` in `lines.ts` gives each letter its row and column).
 */
import { contentOf } from '../data/profile';
import type { Lang } from '../i18n';
import { line, tallestRows } from './buffer';
import { COLUMNS, type Tier, wrap } from './lines';

export interface TierLayout {
	columns: number;
	/** Each version's lines, in the versions' order; joined, a line gives the version's text back. */
	versions: string[][];
	/** The lede's height in rows: its tallest wrap, keystrokes included. */
	rows: number;
}

export type LedeLayout = Record<Tier, TierLayout>;

export function ledeLayout(lang: Lang): LedeLayout {
	const { lede } = contentOf(lang);
	const layout = (columns: number): TierLayout => ({
		columns,
		versions: lede.versions.map((version) => wrap(line(lede, version), columns)),
		rows: tallestRows(lede, columns),
	});
	return { desk: layout(COLUMNS.desk), phone: layout(COLUMNS.phone) };
}
