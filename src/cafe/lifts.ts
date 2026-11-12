/**
 * The Démontage's lifts, worked out at build from the moka generator's (`moka.json`), for the Montage's envelopes
 * and the Café's Repères alike.
 *
 * The four blocks, bottom to top, each raised by its own flag on the Café's section (`--up-m`, `--up-w`, `--up-e`,
 * `--up-n`, 1 while the block is up): M the boiler and the funnel, W the filter and the gasket, E the collector,
 * N the lid. The generator's lift of a piece is how high it flies with every piece under it up too, clearing them.
 * A block that comes down takes its own span out from under every piece above it: a piece then rests on whatever
 * is below it, wherever that is, and never sinks into it, in any order.
 */
import moka from '../assets/moka/moka.json';

type PieceName = (typeof moka.pieces)[number]['name'];
type Block = 'm' | 'w' | 'e' | 'n';

/** Bottom to top. */
const BLOCKS: [Block, PieceName[]][] = [
	['m', ['boiler', 'funnel']],
	['w', ['filter', 'gasket']],
	['e', ['collector']],
	['n', ['lid']],
];

const generated = new Map(moka.pieces.map(({ name, lift }) => [name, lift]));
const liftOf = (piece: PieceName) => {
	const lift = generated.get(piece);
	if (lift === undefined) throw new Error(`Démontage: no lift for the ${piece}`);
	return lift;
};

/** A lift as the share each block's flag adds to it, in % of the frame's height. */
type Terms = Partial<Record<Block, number>>;

function terms(piece: PieceName): Terms {
	const result: Terms = {};
	let floor = 0;
	for (const [block, pieces] of BLOCKS) {
		if (pieces.includes(piece)) {
			result[block] = liftOf(piece) - floor;
			return result;
		}
		const top = Math.max(...pieces.map(liftOf));
		result[block] = top - floor;
		floor = top;
	}
	throw new Error(`Démontage: the ${piece} is in no block`);
}

const css = (lift: Terms) =>
	`calc(${Object.entries(lift)
		.map(([block, share]) => `var(--up-${block}) * ${+share.toFixed(3)}`)
		.join(' + ')})`;

/** How high a piece is lifted, in % of the frame's height, as a CSS expression of the blocks' flags. */
export const lift = (piece: PieceName) => css(terms(piece));

/**
 * The same, for a piece carried by another one's envelope: what it adds to its carrier's lift. The funnel rides
 * on the boiler, which carries the basket's clip along with it.
 */
export function liftOver(piece: PieceName, carrier: PieceName) {
	const own = terms(piece);
	const under = terms(carrier);
	return css(Object.fromEntries(Object.entries(own).map(([block, share]) => [block, share - (under[block as Block] ?? 0)])));
}

/** Bottom to top: lifted top first on opening, landed bottom first on closing (board A's delays). */
const ORDER = BLOCKS.flatMap(([, pieces]) => pieces);
const STEP = 0.06;
const FIRST_UP = 0.12;

/** When a piece starts to move, in seconds, as the form opens (`up`) and as it closes or sends (`down`). */
export function delays(piece: PieceName) {
	const rank = ORDER.indexOf(piece);
	return {
		up: +(FIRST_UP + STEP * (ORDER.length - 1 - rank)).toFixed(2),
		down: +(STEP * rank).toFixed(2),
	};
}
