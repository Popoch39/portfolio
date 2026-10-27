// Mise en page des notes de la fiche, calculée au build : où chaque note se pose autour de la
// figure, où son trait touche la pièce et par quel chemin. Le navigateur n'a plus qu'à appliquer
// la CSS des notes (`Notes.astro`), qui tire de ces valeurs (des fractions de la figure, des rangs)
// les positions réelles à la taille de la carte : aucun script ne mesure ni ne place quoi que ce
// soit.
//
// Deux dispositions, que la largeur de la carte départage :
// - en bandes : une rangée de notes au-dessus de la figure, une en dessous, en colonnes ; le trait
//   descend (ou monte) de la note, longe la gouttière et plonge sur la pièce ;
// - à côté, pour une figure haute : une colonne de notes de chaque côté, chacune au plus près de la
//   hauteur de sa pièce ; le trait part à l'horizontale, longe la gouttière et rejoint la pièce.
// Chaque trait a son niveau dans la gouttière, choisi pour qu'aucun trait n'en croise un autre.
import { figurePrint, type Anchors, type Point } from './anchors.ts';
import type { AnatomyContent, Piece } from './contract.ts';

/**
 * Gabarit partagé avec la CSS des notes, qui le reçoit en propriétés personnalisées : les calculs
 * de niveaux d'ici supposent les mêmes cotes que le rendu.
 */
export const GAUGE = {
	/** Largeur d'une note à côté de la figure (px). */
	noteWidth: 232,
	/** Écart vertical minimal entre deux notes à côté de la figure, et hauteur prévue d'une note (px). */
	pitch: 136,
	noteHeight: 124,
	/** Gouttière entre les notes et la figure : en bandes (hauteur), à côté (largeur) (px). */
	bandGutter: 44,
	sideGutter: 56,
	/** Écart entre colonnes de notes en bandes (px). */
	columnGap: 32,
	/** Le trait part du centre du numéro de la note, un rond de 24 px. */
	numberCenter: 12,
	/** Premier niveau dans la gouttière et pas entre deux niveaux (px). */
	levelStart: 10,
	levelStep: 8,
};

/** Au-delà de ce rapport hauteur sur largeur, la figure peut ranger ses notes à ses côtés. */
const TALL = 0.7;
/** Largeur de carte supposée pour choisir les niveaux : celle d'un grand écran (px). */
const NOMINAL_WIDTH = 1180;
const NOMINAL_HEIGHT = 680;
/** Écart minimal entre les points d'arrivée de deux traits d'une même rangée (px, au format nominal). */
const OVERLAP = 24;
/** Un viseur par endroit de la pièce, sauf les endroits plus petits que ce tiers du plus grand. */
const FINDER_MIN = 0.3;

type Row = 'up' | 'down';
type Side = 'left' | 'right';

export interface NoteLayout {
	piece: Piece<'page'>;
	/** Numéro de nomenclature, sur deux chiffres. */
	number: string;
	/** Classes de disposition de la note (rangée, côté, sens des traits). */
	classes: string;
	/** Propriétés personnalisées de la note : son trait et sa place. */
	style: string;
	/** Propriétés personnalisées de sa marque sur la figure (pointe et pastille). */
	pinStyle: string;
	/** Ses viseurs, en fractions de la figure. */
	finders: string[];
}

export interface AnnotationLayout {
	/** La figure peut ranger ses notes à ses côtés. */
	tall: boolean;
	/** Propriétés personnalisées de la scène : gabarit, format, colonnes et chaîne des notes. */
	style: string;
	notes: NoteLayout[];
}

const fixed = (value: number) => Number(value.toFixed(4));
const css = (vars: Record<string, string | number>) =>
	Object.entries(vars)
		.map(([name, value]) => `--${name}: ${value}`)
		.join('; ');

/** Les combinaisons de `k` éléments parmi `items`, dans l'ordre. */
function combinations<T>(items: T[], k: number): T[][] {
	if (k === 0) return [[]];
	if (items.length < k) return [];
	const [first, ...rest] = items;
	return [...combinations(rest, k - 1).map((combo) => [first, ...combo]), ...combinations(rest, k)];
}

function permutations(n: number): number[][] {
	if (n <= 1) return [[0].slice(0, n)];
	return permutations(n - 1).flatMap((perm) => Array.from({ length: n }, (_, i) => [...perm.slice(0, i), n - 1, ...perm.slice(i)]));
}

const within = (value: number, a: number, b: number) => value > Math.min(a, b) && value < Math.max(a, b);

/**
 * Niveaux des traits d'une rangée (ou d'une colonne), un par trait et tous différents, qui croisent
 * le moins. Chaque trait part de la note en `from`, va jusqu'à son niveau, longe la gouttière jusqu'à
 * `to`, puis file vers la pièce, en restant ensuite au-delà de son niveau : un tronçon de gouttière
 * coupe l'amorce d'un trait de niveau plus profond, ou la fin d'un trait de niveau moins profond.
 */
function levels(legs: { from: number; to: number }[]) {
	let best = { cost: Infinity, order: legs.map((_, i) => i) };
	for (const order of permutations(legs.length)) {
		let cost = 0;
		legs.forEach((a, i) =>
			legs.forEach((b, j) => {
				if (i === j) return;
				if (within(b.from, a.from, a.to) && order[j] > order[i]) cost++;
				if (within(b.to, a.from, a.to) && order[j] < order[i]) cost++;
			}),
		);
		if (cost < best.cost) best = { cost, order };
	}
	return best.order;
}

/** Les notes en bandes : qui va au-dessus, qui en dessous, dans quelle colonne, à quel niveau. */
function inBands(ids: string[], anchors: Anchors) {
	const up = Math.ceil(ids.length / 2);
	const columns = up;
	const scale = NOMINAL_WIDTH / anchors.width;
	const columnX = (c: number) => (c * (NOMINAL_WIDTH + GAUGE.columnGap)) / columns + GAUGE.numberCenter;
	const pinX = (id: string, row: Row) => anchors.pieces[id][row === 'up' ? 'top' : 'bottom'][0] * scale;
	const depth = (id: string, row: Row) => (row === 'up' ? anchors.pieces[id].top[1] : anchors.height - anchors.pieces[id].bottom[1]) * scale;

	let best = { cost: Infinity, place: new Map<string, { row: Row; column: number }>() };
	for (const above of combinations(ids, up)) {
		const below = ids.filter((id) => !above.includes(id));
		const top = [...above].sort((a, b) => pinX(a, 'up') - pinX(b, 'up'));
		const bottom = [...below].sort((a, b) => pinX(a, 'down') - pinX(b, 'down'));
		// La rangée du bas, plus courte, prend les colonnes les plus proches de ses pièces.
		let slots = { cost: Infinity, columns: [] as number[] };
		for (const chosen of combinations([...Array(columns).keys()], bottom.length)) {
			const cost = chosen.reduce((sum, c, i) => sum + Math.abs(columnX(c) - pinX(bottom[i], 'down')), 0);
			if (cost < slots.cost) slots = { cost, columns: chosen };
		}
		const across = top.reduce((sum, id, c) => sum + Math.abs(columnX(c) - pinX(id, 'up')), 0) + slots.cost;
		const down = above.reduce((sum, id) => sum + depth(id, 'up'), 0) + below.reduce((sum, id) => sum + depth(id, 'down'), 0);
		// Deux pièces d'une rangée à l'aplomb l'une de l'autre : leurs traits plongeraient l'un sur l'autre.
		const stacked = [top, bottom].reduce(
			(sum, row) => sum + row.slice(1).filter((id, i) => Math.abs(pinX(id, row === top ? 'up' : 'down') - pinX(row[i], row === top ? 'up' : 'down')) < OVERLAP).length,
			0,
		);
		const cost = down + 0.6 * across + 1e4 * stacked;
		if (cost < best.cost) {
			const place = new Map<string, { row: Row; column: number }>();
			top.forEach((id, c) => place.set(id, { row: 'up', column: c }));
			bottom.forEach((id, i) => place.set(id, { row: 'down', column: slots.columns[i] }));
			best = { cost, place };
		}
	}

	const level = new Map<string, number>();
	for (const row of ['up', 'down'] as const) {
		const members = ids.filter((id) => best.place.get(id)?.row === row).sort((a, b) => best.place.get(a)!.column - best.place.get(b)!.column);
		const order = levels(members.map((id) => ({ from: columnX(best.place.get(id)!.column), to: pinX(id, row) })));
		members.forEach((id, i) => level.set(id, order[i]));
	}
	return ids.map((id) => {
		const { row, column } = best.place.get(id)!;
		const pin = anchors.pieces[id][row === 'up' ? 'top' : 'bottom'];
		return { id, row, column, level: level.get(id)!, pin, rightward: pinX(id, row) >= columnX(column) };
	});
}

/**
 * Les notes à côté de la figure : quel côté, dans quel ordre, à quel niveau, et la chaîne qui pose
 * chaque note au plus près de sa pièce sans chevaucher sa voisine.
 */
function besides(ids: string[], anchors: Anchors) {
	const figureWidth = Math.min(NOMINAL_WIDTH - 2 * (GAUGE.noteWidth + GAUGE.sideGutter), (NOMINAL_HEIGHT * anchors.width) / anchors.height);
	const scale = figureWidth / anchors.width;
	const reach = (id: string, side: Side) => (side === 'left' ? anchors.pieces[id].left[0] : anchors.width - anchors.pieces[id].right[0]) * scale;
	const pinY = (id: string, side: Side) => anchors.pieces[id][side][1] * scale;

	let best = { cost: Infinity, left: [] as string[] };
	for (const size of new Set([Math.ceil(ids.length / 2), Math.floor(ids.length / 2)])) {
		for (const left of combinations(ids, size)) {
			const cost = ids.reduce((sum, id) => sum + reach(id, left.includes(id) ? 'left' : 'right'), 0);
			if (cost < best.cost) best = { cost, left };
		}
	}

	const notes: { id: string; side: Side; rank: number; level: number; pin: Point; downward: boolean }[] = [];
	for (const side of ['left', 'right'] as const) {
		const members = ids.filter((id) => best.left.includes(id) === (side === 'left')).sort((a, b) => pinY(a, side) - pinY(b, side));
		// La chaîne au format nominal : chaque note à la hauteur de sa pièce, poussée vers le bas par
		// celle d'avant, puis remontée tant que la dernière déborde.
		const tops: number[] = [];
		members.forEach((id, k) => tops.push(Math.max(pinY(id, side) - GAUGE.numberCenter, k ? tops[k - 1] + GAUGE.pitch : 0)));
		const height = anchors.height * scale;
		for (let k = members.length - 1; k >= 0; k--) {
			const bound = k === members.length - 1 ? Math.max(height - GAUGE.noteHeight, (members.length - 1) * GAUGE.pitch) : tops[k + 1] - GAUGE.pitch;
			tops[k] = Math.min(tops[k], bound);
		}
		const order = levels(members.map((id, k) => ({ from: tops[k] + GAUGE.numberCenter, to: pinY(id, side) })));
		members.forEach((id, k) =>
			notes.push({ id, side, rank: k, level: order[k], pin: anchors.pieces[id][side], downward: pinY(id, side) >= tops[k] + GAUGE.numberCenter }),
		);
	}
	return notes;
}

/**
 * La chaîne d'une colonne de notes à côté de la figure, en CSS : `--<prefix><k>` est le haut de la
 * k-ième note, `--<prefix>end` le bas de la dernière. Même calcul qu'au format nominal, à la
 * hauteur réelle de la figure (`--fig-h`).
 */
function chain(prefix: string, pins: number[]) {
	const vars: Record<string, string> = {};
	const m = pins.length;
	pins.forEach((y, k) => {
		const own = `${fixed(y)} * var(--fig-h) - ${GAUGE.numberCenter}px`;
		vars[`${prefix}f${k}`] = k ? `max(${own}, var(--${prefix}f${k - 1}) + ${GAUGE.pitch}px)` : `max(${own}, 0px)`;
	});
	for (let k = m - 1; k >= 0; k--) {
		const bound = k === m - 1 ? `max(var(--fig-h) - ${GAUGE.noteHeight}px, ${(m - 1) * GAUGE.pitch}px)` : `var(--${prefix}${k + 1}) - ${GAUGE.pitch}px`;
		vars[`${prefix}${k}`] = `min(var(--${prefix}f${k}), ${bound})`;
	}
	vars[`${prefix}end`] = m ? `calc(var(--${prefix}${m - 1}) + ${GAUGE.noteHeight}px)` : '0px';
	return vars;
}

/**
 * La mise en page des notes de `content` sur la figure au repos `body`, d'après ses ancrages. Le
 * relevé doit être celui de cette figure : sinon, relancer `pnpm ancres`.
 */
export function annotate(content: AnatomyContent<'page'>, body: string, anchors: Anchors | undefined): AnnotationLayout {
	if (!anchors || anchors.print !== figurePrint(body)) {
		throw new Error(`Anatomie « ${content.slug} » : ancrages absents ou d’une autre figure (pnpm build && pnpm ancres)`);
	}
	const ids = content.pieces.map((piece) => piece.id);
	const missing = ids.filter((id) => !anchors.pieces[id]);
	if (missing.length) throw new Error(`Anatomie « ${content.slug} » : pièces sans ancrage (${missing.join(', ')})`);

	const { width, height } = anchors;
	const tall = height / width >= TALL;
	const bands = new Map(inBands(ids, anchors).map((note) => [note.id, note]));
	const sides = new Map(besides(ids, anchors).map((note) => [note.id, note]));
	const fraction = ([x, y]: Point) => ({ x: fixed(x / width), y: fixed(y / height) });

	// Ordre de la bascule entre les deux lectures, de gauche à droite dans chaque disposition : en
	// bandes, colonne après colonne ; à côté, la colonne de gauche de haut en bas, puis l'autre. La
	// liste, elle, suit la nomenclature.
	const ranking = (key: (id: string) => [number, number]) => {
		const sorted = [...ids].sort((p, q) => key(p)[0] - key(q)[0] || key(p)[1] - key(q)[1]);
		return (id: string) => sorted.indexOf(id);
	};
	const inBandOrder = ranking((id) => [bands.get(id)!.column, bands.get(id)!.row === 'up' ? 0 : 1]);
	const besideOrder = ranking((id) => [sides.get(id)!.side === 'left' ? 0 : 1, sides.get(id)!.rank]);

	const notes = content.pieces.map((piece, i): NoteLayout => {
		const b = bands.get(piece.id)!;
		const s = sides.get(piece.id)!;
		const a = anchors.pieces[piece.id];
		const bandPin = fraction(b.pin);
		const sidePin = fraction(s.pin);
		const center = fraction(a.center);
		const pins = { bx: bandPin.x, by: bandPin.y, sx: sidePin.x, sy: sidePin.y, cx: center.x, cy: center.y };
		const prefix = s.side === 'left' ? 'sl' : 'sr';
		const largest = Math.max(...a.boxes.map(([, , w, h]) => w * h));
		return {
			piece,
			number: String(i + 1).padStart(2, '0'),
			classes: [`b-${b.row}`, b.rightward ? 'b-right' : 'b-left', `s-${s.side}`, s.downward ? 's-down' : 's-up'].join(' '),
			style: css({ i, ob: inBandOrder(piece.id), os: besideOrder(piece.id), col: b.column + 1, lvl: b.level, slvl: s.level, top: `var(--${prefix}${s.rank})`, ...pins }),
			pinStyle: css(pins),
			finders: a.boxes
				.filter(([, , w, h]) => w * h >= FINDER_MIN * largest)
				.map(([x, y, w, h]) => css({ fx: fixed(x / width), fy: fixed(y / height), fw: fixed(w / width), fh: fixed(h / height) })),
		};
	});

	const column = (side: Side) =>
		ids.filter((id) => sides.get(id)!.side === side).sort((p, q) => sides.get(p)!.rank - sides.get(q)!.rank).map((id) => fraction(sides.get(id)!.pin).y);
	return {
		tall,
		style: css({
			n: ids.length,
			cols: Math.ceil(ids.length / 2),
			wh: fixed(width / height),
			'note-w': `${GAUGE.noteWidth}px`,
			'note-h': `${GAUGE.noteHeight}px`,
			'band-g': `${GAUGE.bandGutter}px`,
			'side-g': `${GAUGE.sideGutter}px`,
			'col-gap': `${GAUGE.columnGap}px`,
			'num-c': `${GAUGE.numberCenter}px`,
			'lvl-0': `${GAUGE.levelStart}px`,
			'lvl-step': `${GAUGE.levelStep}px`,
			...chain('sl', column('left')),
			...chain('sr', column('right')),
		}),
		notes,
	};
}
