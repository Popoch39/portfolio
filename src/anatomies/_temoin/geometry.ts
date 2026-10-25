// Géométrie de la figure témoin, volontairement rudimentaire : un socle et six blocs posés
// dessus en deux rangées. Elle tourne au build Astro et sous Node (audit : `audit.mjs`).
import {
	boxCorners,
	depthOf,
	fitProjection,
	insetPlan,
	lineSvg,
	planOutline,
	slabOf,
	solidSvg,
	type Plan,
	type Point3,
	type Projection,
} from '../../vendor/anatomy/iso-kit.ts';
import type { Piece, RestFigure } from '../contract.ts';
import { pieceSvg } from '../piece.ts';
import { heightOf, pieces } from './model.ts';

export const WIDTH = 560;
export const HEIGHT = 360;

const BLOCK = 24;
const GAP = 12;
const MARGIN = 10;
export const BASE_HEIGHT = 6;

/** Place de chaque bloc sur le socle : rangée du fond, puis rangée de devant. */
const GRID: Record<string, [column: number, row: number]> = {
	socle: [0, 0],
	heros: [1, 0],
	barre: [2, 0],
	'en-tete': [0, 1],
	profil: [1, 1],
	projets: [2, 1],
};

export const basePlan: Plan = {
	x: 0,
	y: 0,
	w: MARGIN * 2 + BLOCK * 3 + GAP * 2,
	d: MARGIN * 2 + BLOCK * 2 + GAP,
	r: 3,
};

export interface Block {
	piece: Piece;
	plan: Plan;
	z: number;
	height: number;
	/** Centre du bloc, pour l'ordre de peinture. */
	at: Point3;
}

export const blocks: Block[] = pieces.map((piece) => {
	const [column, row] = GRID[piece.id];
	const plan = { x: MARGIN + column * (BLOCK + GAP), y: MARGIN + row * (BLOCK + GAP), w: BLOCK, d: BLOCK, r: 1.5 };
	const height = heightOf(piece);
	return { piece, plan, z: BASE_HEIGHT, height, at: [plan.x + BLOCK / 2, plan.y + BLOCK / 2, BASE_HEIGHT + height / 2] };
});

const tallest = Math.max(...blocks.map((block) => block.z + block.height));

export const projection: Projection = fitProjection(boxCorners(basePlan, 0, tallest), WIDTH, HEIGHT, { pad: 28 });

/** Ordre de peinture : du fond vers le lecteur. */
export const paintOrder = (P: Projection) => blocks.slice().sort((a, b) => depthOf(a.at, P) - depthOf(b.at, P));

export const baseSvg = (P: Projection) =>
	solidSvg(slabOf(basePlan, 0, BASE_HEIGHT, P, 6, 0.8), {
		tone: 'mid',
		halo: true,
		inner: lineSvg(planOutline(insetPlan(basePlan, 4), BASE_HEIGHT, P, 6), { tone: 'faint' }),
	});

export const blockSvg = (block: Block, P: Projection) =>
	pieceSvg(block.piece, solidSvg(slabOf(block.plan, block.z, block.height, P, 3, 0.6), { tone: 'hi' }));

export function renderRest(): RestFigure {
	const P = projection;
	return {
		width: WIDTH,
		height: HEIGHT,
		body: [baseSvg(P), ...paintOrder(P).map((block) => blockSvg(block, P))].join(''),
	};
}
