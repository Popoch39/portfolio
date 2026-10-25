// Anatomie de claude-status-line : la rampe à cadran (concept validé à la revue #21, `concept.md`).
import type { Anatomy, RestFigure } from '../contract.ts';
import { pieceSvg } from '../piece.ts';
import { content } from './content.ts';
import { build, type Item } from './geometry.ts';
import { HEIGHT, projection, WIDTH } from './layout.ts';
import { settled } from './order.mjs';

let rest: RestFigure | null = null;

/** La figure au repos, calculée une fois par build (l'ordre de peinture se mesure). */
function renderRest(): RestFigure {
	if (rest) return rest;
	const { items, routes } = build();
	const { order } = settled(items, routes, projection) as { order: Item[] };
	// Les éléments voisins d'une même pièce partagent un seul crochet.
	const runs: { piece?: Item['piece']; svg: string[] }[] = [];
	for (const item of order) {
		const last = runs[runs.length - 1];
		if (last && last.piece === item.piece) last.svg.push(item.svg);
		else runs.push({ piece: item.piece, svg: [item.svg] });
	}
	const body = runs.map((run) => (run.piece ? pieceSvg(run.piece, run.svg) : run.svg.join(''))).join('');
	rest = { width: WIDTH, height: HEIGHT, body };
	return rest;
}

export const anatomy: Anatomy = { content, renderRest };
