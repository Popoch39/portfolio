// Géométrie du banc de duel, calculée une fois au build (et sous Node pour l'audit) dans la pose
// au repos du modèle. Chaque pièce dessinée est un item : son dessin, la pièce de nomenclature dont
// elle prend le bleu, et la forme vraie que l'audit du kit vérifie (`audit.mjs`).
import {
	cylinder,
	depthOf,
	dotsSvg,
	extrude,
	faceTextSvg,
	fadedSvg,
	fitProjection,
	iso,
	knurl,
	lineSvg,
	pathOf,
	planOutline,
	sideArc,
	sideMatrix,
	sideSeam,
	sideTicks,
	slabOf,
	solidSvg,
	type Flat,
	type Plan,
	type Plane,
	type Point3,
	type SolidStyle,
} from '../../vendor/anatomy/iso-kit.ts';
import * as G from './kit.mjs';
import type { RestFigure } from '../contract.ts';
import { pieceSvg } from '../piece.ts';
import * as L from './layout.ts';
import {
	armOpening,
	bandeau,
	barLevel,
	drumTime,
	keyDepth,
	lampLevel,
	mmrOf,
	pulsesOn,
	restDuel,
	sliderPose,
	tokenAt,
	type Duel,
} from './model.ts';
import { pieces } from './pieces.ts';
import { settledRanks } from './settle.mjs';
import { TEXTS } from './texts.ts';

const P = L.P;
{
	const fit = fitProjection(L.framed(), L.WIDTH, L.HEIGHT, L.FIT);
	if (Math.hypot(fit.origin[0] - P.origin[0], fit.origin[1] - P.origin[1]) > 0.05 || Math.abs(fit.scale - P.scale) > 1e-4) {
		throw new Error(`Anatomie « typomaniac » : la projection écrite (layout.ts) diffère de celle du cadrage : ${JSON.stringify(fit)}`);
	}
}

/** Lampes de manche sur les joues : deux par joueur, et leur ampoule. */
const LAMPS: Point3[][] = [
	[
		[34, 227, L.TOWER.cheekTop],
		[62, 227, L.TOWER.cheekTop],
	],
	[
		[34, 153, L.TOWER.cheekTop],
		[62, 153, L.TOWER.cheekTop],
	],
];
/** L'ampoule pose sur le socle de la lampe (1,4 de haut). */
const BULB = { at: 4, r: 2.6 };

/** Claviers : A au bout +y, B tourné d'un demi-tour au bout −y. */
const KEY = { size: 5.6, h: 2.4, pitch: 6.6 };
interface KeyCap {
	name: string;
	x: number;
	y: number;
	z: number;
	w: number;
}

/** Rangées du clavier A, du joueur vers la tour : barre d'espace, puis zxcv, asdf, qwer en gradins (`L.BAR` y repose). */
const ROWS = [
	{ y: 357.4, z: 18.8, keys: [] as string[] },
	{ y: 350, z: 20.3, keys: [...'zxcvbnm'] },
	{ y: 342.6, z: 21.8, keys: [...'asdfghjkl'] },
	{ y: 335.2, z: 23.3, keys: [...'qwertyuiop'] },
];
const TERRACES = ROWS.map((row) => row.z);

/** Les touches d'un clavier : le joueur A regarde vers −y, sa main gauche est du côté +x. */
function keyCaps(side: number): KeyCap[] {
	const caps: KeyCap[] = [];
	ROWS.forEach((row, index) => {
		const shift = [0, 3.3, 1.6, 0][index];
		row.keys.forEach((name, i) => {
			const x = 48 + ((row.keys.length - 1) / 2 - i) * KEY.pitch + shift;
			caps.push({ name, x, y: row.y, z: row.z, w: KEY.size });
		});
	});
	caps.push({ name: 'space', x: 47, y: ROWS[0].y, z: ROWS[0].z, w: 32 });
	caps.push({ name: 'back', x: 48 - 3 * KEY.pitch + 3.3 - KEY.size / 2 - 1 - 4.8, y: ROWS[1].y, z: ROWS[1].z, w: 9.6 });
	return caps.map((cap) => {
		const [x, y] = L.turn(side, [cap.x, cap.y]);
		return { ...cap, x, y };
	});
}
type Frame = { o: Point3; a: Point3; u: Point3; v: Point3 };
type PieceId = 'socle' | 'claviers' | 'cables' | 'tour' | 'guichet' | 'lampes' | 'mat';

/** Forme vraie d'un item, que `audit.mjs` traduit en forme du kit. */
export type Shape = { name: string; owner?: string } & (
	| { kind: 'slab'; plan: Plan; z: number; h: number; steps: number; cut?: Shape }
	| { kind: 'extruded'; ring: Plane[]; z: number; h: number }
	| { kind: 'solid'; F: Frame; profile: number[][] }
	| { kind: 'ball'; at: Point3; r: number }
	| { kind: 'box'; min: Point3; max: Point3 }
	| { kind: 'tube'; points: Point3[]; radii: number[] }
);

export interface Item {
	name: string;
	piece: PieceId;
	key: number;
	svg: string;
	shapes: Shape[];
	/** Tronçon de câble : l'audit ne compare pas deux tronçons voisins. */
	route?: string;
	chunk?: number;
	/** Les items de la niche se dessinent ensemble, découpés par l'embrasure. */
	niche?: boolean;
	/** Centre de l'item dans le monde : ses tracés s'écrivent par rapport à lui. */
	anchor?: Point3;
}

export interface Route {
	name: string;
	points: Point3[];
	r: number;
	piece: PieceId;
}

const at3 = (point: Point3): Flat => iso(point, P);
const flat = (points: Point3[], closed = false) => pathOf(points.map(at3), closed);
const turnPoint = (side: number, [x, y, z]: Point3): Point3 => (side ? [L.BENCH.w - x, L.BENCH.d - y, z] : [x, y, z]);
const turnPlan = (side: number, plan: Plan): Plan => (side ? { ...plan, x: L.BENCH.w - plan.x - plan.w, y: L.BENCH.d - plan.y - plan.d } : plan);
const turnAxis = (side: number, [x, y, z]: Point3): Point3 => (side ? [-x, -y, z] : [x, y, z]);
const frame = (o: Point3, a: Point3): Frame => G.frameAlong(o, a);
const centreOf = (plan: Plan, z: number, h: number): Point3 => [plan.x + plan.w / 2, plan.y + plan.d / 2, z + h / 2];
const LAYER = { back: -1000, channel: -990, cables: -980, front: -970 };
const stepsOf = (r: number) => Math.max(10, Math.min(24, Math.round(r * 5)));

export function build(duel: Duel) {
	const items: Item[] = [];
	const routes: Route[] = [];
	const put = (name: string, piece: PieceId, at: Point3, svg: string, shapes: Shape[], { bias = 0, ...rest }: Partial<Item> & { bias?: number } = {}) =>
		items.push({ name, piece, key: depthOf(at, P) + bias, svg, shapes, anchor: at, ...rest });

	const slab = (
		name: string,
		piece: PieceId,
		plan: Plan,
		z: number,
		h: number,
		style: SolidStyle = {},
		{ steps = 3, bevel = 0, extra = '', bias = 0, wrap = '', cut, key }: { steps?: number; bevel?: number; extra?: string; bias?: number; wrap?: string; cut?: Shape; key?: number } = {},
	) => {
		const svg = solidSvg(slabOf(plan, z, h, P, steps, bevel), { tone: 'mid', ...style }) + extra;
		put(name, piece, centreOf(plan, z, h), wrap ? `<g ${wrap}>${svg}</g>` : svg, [{ kind: 'slab', plan, z, h, steps, name, cut }], { bias, ...(key === undefined ? {} : { key }) });
	};
	const turned = (name: string, piece: PieceId, F: Frame, profile: number[][], style: SolidStyle = {}, { extra = '', bias = 0, at, bevel = 0, owner }: { extra?: string; bias?: number; at?: Point3; bevel?: number; owner?: string } = {}) => {
		const mid = (profile[0][0] + profile[profile.length - 1][0]) / 2;
		// Assez de facettes pour l'écran (≈ 3 px chacune) sans alourdir le SVG au repos.
		const steps = Math.max(12, Math.min(24, Math.round(Math.max(...profile.map(([, r]) => r)) * 4)));
		put(name, piece, at ?? [F.o[0] + F.a[0] * mid, F.o[1] + F.a[1] * mid, F.o[2] + F.a[2] * mid], solidSvg(G.solidOf(profile, F, P, { bevel, steps }), { tone: 'mid', ...style }) + extra, [{ kind: 'solid', F, profile, name, owner }], { bias });
	};
	const disc = (name: string, piece: PieceId, F: Frame, s0: number, s1: number, r: number, style: SolidStyle = {}, options: { extra?: string; bias?: number; bevel?: number; owner?: string } = {}) =>
		turned(name, piece, F, [
			[s0, r],
			[s1, r],
		], style, options);
	const post = (name: string, piece: PieceId, x: number, y: number, r: number, z: number, h: number, style: SolidStyle = {}, extra = '', bias = 0) =>
		put(name, piece, [x, y, z + h / 2], solidSvg(cylinder(x, y, r, z, h, P, stepsOf(r)), { tone: 'mid', ...style }) + extra, [{ kind: 'solid', F: frame([x, y, z], [0, 0, 1]), profile: [[0, r], [h, r]], name }], { bias });
	const screws = (points: Point3[], ring = 1.1) =>
		points.map(([x, y, z]) => lineSvg(G.circleOf(frame([x, y, z], [0, 0, 1]), 0, ring, P), { tone: 'lo' })).join('') + dotsSvg(points.map(at3), { size: 0.5, tone: 'mid' });

	// --- Socle : le banc de fonte, sa goulotte, ses semelles et l'embase de la tour ---
	const B = L.BENCH;
	const C = L.CHANNEL;
	const corner = (cx: number, cy: number, start: number, r = B.r) =>
		Array.from({ length: 7 }, (_, i) => [cx + r * Math.cos(((start + i * 15) * Math.PI) / 180), cy + r * Math.sin(((start + i * 15) * Math.PI) / 180)] as Plane);
	// Les deux bords du banc : angles arrondis dehors, vifs contre la goulotte.
	const backRing: Plane[] = [[C.x0, 0], ...corner(B.r, B.r, 180).reverse(), ...corner(B.r, B.d - B.r, 90).reverse(), [C.x0, B.d]];
	const frontRing: Plane[] = [[C.x1, 0], ...corner(B.w - B.r, B.r, 270), ...corner(B.w - B.r, B.d - B.r, 0), [C.x1, B.d]];
	const halo = `<path class="iso-halo" d="${slabOf({ x: B.x, y: B.y, w: B.w, d: B.d, r: B.r }, 0, B.h, P).fill}"/>`;
	const groove = (x: number, lip: number) =>
		lineSvg(flat([[lip, 4, B.h], [x, 4, B.h], [x, B.d - 4, B.h], [lip, B.d - 4, B.h]]), { tone: 'faint' });
	const cornerScrews = (x: number) => screws([[x, 10, B.h], [x, B.d - 10, B.h]]);
	// Le banc se peint en trois couches : le bord du dos et le fond de la goulotte, puis les câbles
	// couchés dedans (`IN_CHANNEL`), puis le bord avant, dont la lèvre cache le bas des câbles.
	put('stand.back', 'socle', [20, 190, 7], halo + solidSvg(extrude(backRing, 0, B.h, P, { bevel: 1.2 }), { tone: 'lo' }) + groove(4, C.x0) + cornerScrews(10), [{ kind: 'extruded', ring: backRing, z: 0, h: B.h, name: 'stand.back' }], { key: LAYER.back });
	slab('stand.channel', 'socle', { x: C.x0, y: 0, w: C.x1 - C.x0, d: B.d, r: 0 }, 0, C.floor, { tone: 'lo' }, { steps: 1, key: LAYER.channel });
	put('stand.front', 'socle', [76, 190, 7], solidSvg(extrude(frontRing, 0, B.h, P, { bevel: 1.2 }), { tone: 'lo' }) + groove(B.w - 4, C.x1) + cornerScrews(B.w - 10), [{ kind: 'extruded', ring: frontRing, z: 0, h: B.h, name: 'stand.front' }], { key: LAYER.front });

	// Plaque d'identité sur la face avant : la seule gravure de la figure.
	const plate: Plan = { x: B.w, y: 160, w: 0.6, d: 60, r: 0.4 };
	const plateFace = B.w + 0.6;
	const rule = (y0: number, y1: number, z: number) => lineSvg(flat([[plateFace, y0, z], [plateFace, y1, z]]), { tone: 'lo', free: true });
	slab('socle.plate', 'socle', plate, 2.6, 8.8, { tone: 'lo' }, {
		steps: 1,
		extra:
			faceTextSvg(sideMatrix([plateFace, 213], 8.4, P, 'right'), 'bun · elysia', { size: 3.6, tone: 'mid' }) +
			rule(213, 196, 6.6) +
			rule(213, 184, 5.2) +
			rule(213, 190, 3.8) +
			dotsSvg([at3([plateFace, 216.4, 7]), at3([plateFace, 163.6, 7])], { size: 0.55, tone: 'mid' }),
	});

	// Capots de goulotte, entre chaque clavier et la tour : fentes fermées et quatre vis.
	for (const side of [0, 1]) {
		const cover = turnPlan(side, { x: 38.5, y: 276, w: 19, d: 16, r: 1 });
		const top = B.h + 1.2;
		const slots = [0, 1, 2].map((i) => planOutline({ x: cover.x + 4.5, y: cover.y + 3.6 + i * 3.6, w: 10, d: 1.4, r: 0.7 }, top, P, 3)).join('');
		const screwPoints: Point3[] = [[cover.x + 2, cover.y + 2, top], [cover.x + cover.w - 2, cover.y + 2, top], [cover.x + 2, cover.y + cover.d - 2, top], [cover.x + cover.w - 2, cover.y + cover.d - 2, top]];
		slab(`socle.cover${side}`, 'socle', cover, B.h, 1.2, { tone: 'lo' }, { steps: 2, extra: lineSvg(slots, { tone: 'lo' }) + screws(screwPoints, 0.9) });
	}

	// Semelles des claviers, incrustées : un contour en creux.
	for (const side of [0, 1]) {
		const sole = turnPlan(side, { x: 6, y: 312, w: 84, d: 56, r: 3 });
		slab(`socle.sole${side}`, 'socle', sole, B.h, 0.8, { tone: 'lo' }, { steps: 3, extra: lineSvg(planOutline({ ...sole, x: sole.x + 1.8, y: sole.y + 1.8, w: sole.w - 3.6, d: sole.d - 3.6, r: 1.6 }, B.h + 0.8, P, 3), { tone: 'faint' }) });
	}

	// Embase de la tour, et ses quatre boulons.
	const T = L.TOWER;
	const base = T.base;
	const bolts = [
		[base.x + 4, base.y + 4],
		[base.x + base.w - 4, base.y + 4],
		[base.x + 4, base.y + base.d - 4],
		[base.x + base.w - 4, base.y + base.d - 4],
	] as Plane[];
	slab('socle.base', 'socle', base, B.h + 0.0, T.baseTop - B.h, { tone: 'lo' }, { steps: 3, bevel: 0.6 });
	bolts.forEach(([x, y], i) => post(`socle.bolt${i}`, 'socle', x, y, 1.5, T.baseTop, 1, { tone: 'lo' }, dotsSvg([at3([x, y, T.baseTop + 1])], { size: 0.45, tone: 'mid' })));
	// Témoins de liaison sur la face avant de l'embase : allumés tant que l'adversaire est là.
	[220, 160].forEach((y, i) => disc(`cables.lamp${i}`, 'cables', frame([base.x + base.w, y, 16], [1, 0, 0]), 0, 0.9, 1.3, { tone: 'mid' }, { extra: `<path class="iso-fill" style="fill:var(--anatomy-hi)" opacity="0.8" d="${pathOf(G.hullOf(Array.from({ length: 16 }, (_, k) => at3([base.x + base.w + 0.9, y + Math.cos((k / 16) * 6.283) * 0.8, 16 + Math.sin((k / 16) * 6.283) * 0.8]))), true)}"/>` }));

	// --- Tour d'arbitrage ---
	const N = L.NICHE;
	const casePlan: Plan = { x: 18, y: 158, w: 60, d: 64, r: 2 };
	const nicheBox: Shape = { kind: 'box', min: [N.back, N.y0, N.z0], max: [N.face + 0.5, N.y1, N.z1], name: 'tour.niche' };
	slab('tour.case', 'tour', casePlan, T.baseTop, T.caseTop - T.baseTop, {
		inner: lineSvg(sideSeam(casePlan, 23, P, 3) + sideSeam(casePlan, 79, P, 3), { tone: 'faint' }),
	}, { steps: 3, cut: nicheBox });
	// Les joues portent les lampes ; celle de A porte aussi le disjoncteur.
	for (const side of [0, 1]) {
		const cheek = turnPlan(side, { x: 22, y: 222, w: 52, d: 10, r: 1.5 });
		const outer = side ? cheek.y : cheek.y + cheek.d;
		const faceScrews = [[cheek.x + 4, outer, 24], [cheek.x + cheek.w - 4, outer, 24], [cheek.x + 4, outer, 90], [cheek.x + cheek.w - 4, outer, 90]] as Point3[];
		slab(`tour.cheek${side}`, 'tour', cheek, T.baseTop, T.cheekTop - T.baseTop, { inner: lineSvg(sideSeam(cheek, 30, P, 3), { tone: 'faint' }) }, { steps: 3, bevel: 0.5, extra: side ? '' : dotsSvg(faceScrews.map(at3), { size: 0.5, tone: 'mid' }) });
	}
	// Chapiteau biseauté.
	const cap: Plan = { x: 15, y: 158, w: 66, d: 64, r: 2 };
	slab('tour.cap', 'tour', cap, T.caseTop, T.capTop - T.caseTop, { inner: lineSvg(sideSeam(cap, T.caseTop + 2.4, P, 3), { tone: 'faint' }) }, { steps: 3, bevel: 1.4 });

	// Dormant à feuillure autour de l'embrasure, et charnières à trois nœuds.
	const jamb = 2.4;
	const frameBars: [string, Plan, number, number][] = [
		['left', { x: N.face, y: N.y1, w: 1, d: jamb, r: 0.3 }, N.z0 - jamb, N.z1 - N.z0 + 2 * jamb],
		['right', { x: N.face, y: N.y0 - jamb, w: 1, d: jamb, r: 0.3 }, N.z0 - jamb, N.z1 - N.z0 + 2 * jamb],
		['top', { x: N.face, y: N.y0, w: 1, d: N.y1 - N.y0, r: 0.3 }, N.z1, jamb],
		['sill', { x: N.face, y: N.y0, w: 1, d: N.y1 - N.y0, r: 0.3 }, N.z0 - jamb, jamb],
	];
	frameBars.forEach(([name, plan, z, h]) => slab(`tour.frame.${name}`, 'tour', plan, z, h, {}, { steps: 1 }));
	const D = L.DOOR;
	const [hx, hy] = D.hinge;
	// Chaque charnière : un fût de trois nœuds, leurs joints en coutures.
	[[31, 39], [61, 69]].forEach(([z0, z1], i) => {
		const joints = [1, 2].map((k) => sideArc(hx, hy, 1.1, z0 + ((z1 - z0) * k) / 3, P, 8)).join('');
		post(`tour.hinge${i}`, 'tour', hx, hy, 1.1, z0, z1 - z0, { tone: 'mid', inner: lineSvg(joints, { tone: 'lo' }) }, dotsSvg([at3([hx, hy, z1])], { size: 0.35 }), 0.5);
	});

	// La porte, battue à 100° : on voit sa face intérieure, avec son panneau et son pêne.
	const [dx, dy] = L.doorDirection();
	// L'épaisseur part vers le dos de la porte : la face qui passe par l'axe des charnières est celle qu'on voit.
	const back: Plane = [dy, -dx];
	const doorRing: Plane[] = [
		[hx + dx * 1.2, hy + dy * 1.2],
		[hx + dx * D.width, hy + dy * D.width],
		[hx + dx * D.width + back[0] * D.t, hy + dy * D.width + back[1] * D.t],
		[hx + dx * 1.2 + back[0] * D.t, hy + dy * 1.2 + back[1] * D.t],
	];
	const panel = (inset: number): Point3[] => {
		const a = 1.2 + inset;
		const b = D.width - inset;
		const z0 = D.z0 + inset;
		const z1 = D.z1 - inset;
		return [
			[hx + dx * a, hy + dy * a, z0],
			[hx + dx * b, hy + dy * b, z0],
			[hx + dx * b, hy + dy * b, z1],
			[hx + dx * a, hy + dy * a, z1],
		];
	};
	put('tour.door', 'tour', [hx + (dx * D.width) / 2, hy + (dy * D.width) / 2, (D.z0 + D.z1) / 2], solidSvg(extrude(doorRing, D.z0, D.z1 - D.z0, P), { tone: 'mid', inner: lineSvg(flat(panel(5), true), { tone: 'lo' }) + lineSvg(flat(panel(6.4), true), { tone: 'faint' }) }), [{ kind: 'extruded', ring: doorRing, z: D.z0, h: D.z1 - D.z0, name: 'tour.door' }], { bias: 2 });
	const latch: Plane = [hx + dx * (D.width - 4), hy + dy * (D.width - 4)];
	slab('tour.latch', 'tour', { x: latch[0] - 1.5, y: latch[1] - 0.2, w: 3, d: 2.4, r: 0.4 }, 48, 4, {}, { steps: 2, bias: 2.1 });

	// Niche du guichet : parois de l'embrasure dessinées, contenu découpé par l'ouverture.
	const wall = (points: Point3[], shade: number) =>
		`<path class="iso-shade" data-shade="${shade}" d="${flat(points, true)}"/>` + lineSvg(flat(points, true), { tone: 'faint' });
	const port = G.circleOf(frame([L.RAIL.x, N.y0, L.RAIL.z + 1.2], [0, 1, 0]), 0, 3.2, P);
	const nicheWalls =
		wall([[N.back, N.y0, N.z0], [N.back, N.y1, N.z0], [N.back, N.y1, N.z1], [N.back, N.y0, N.z1]], 0) +
		wall([[N.back, N.y0, N.z0], [N.face, N.y0, N.z0], [N.face, N.y0, N.z1], [N.back, N.y0, N.z1]], 2) +
		`<path class="iso-top" d="${flat([[N.back, N.y0, N.z0], [N.face, N.y0, N.z0], [N.face, N.y1, N.z0], [N.back, N.y1, N.z0]], true)}"/>` +
		lineSvg(flat([[N.back, N.y0, N.z0], [N.face, N.y0, N.z0], [N.face, N.y1, N.z0], [N.back, N.y1, N.z0]], true), { tone: 'faint' }) +
		`<path class="iso-shade" data-shade="0" d="${port}"/>` +
		lineSvg(port, { tone: 'lo' });
	// Les parois de la niche sont les faces de la caisse : de minces plaques dans son épaisseur.
	const skin = (min: Point3, max: Point3, part: string): Shape => ({ kind: 'box', min, max, name: `tour.niche.${part}`, owner: 'tour.case' });
	put('tour.niche', 'tour', [N.back, (N.y0 + N.y1) / 2, N.z0], nicheWalls, [
		skin([N.back - 0.4, N.y0, N.z0], [N.back, N.y1, N.z1], 'back'),
		skin([N.back, N.y0 - 0.4, N.z0], [N.face, N.y0, N.z1], 'side'),
		skin([N.back, N.y0, N.z0 - 0.4], [N.face, N.y1, N.z0], 'floor'),
	], { niche: true });
	// Rails du guichet.
	[59.6, 63.2].forEach((x, i) => slab(`guichet.rail${i}`, 'guichet', { x, y: N.y0, w: 1.2, d: N.y1 - N.y0, r: 0.2 }, N.z0, L.RAIL.z - N.z0, {}, { steps: 1, bias: -40, }));
	items.forEach((item) => {
		if (item.name.startsWith('guichet.rail')) item.niche = true;
	});
	// Pivots, butées et bras : le mouvement réordonne ces pièces quand un jeton passe un bras.
	const arms = [0, 1, 2, 3].map((index) => armOpening(duel, index));
	// Les jetons sur le rail au repos, et un jeton caché que le mouvement duplique quand il en faut plus.
	const tokens = duel.trips.map((trip) => tokenAt(trip, duel.clock)).filter((value): value is number => value !== null);
	const tokenSlots: (number | null)[] = [...tokens, null];
	const nicheParts = new Map<string, Item>();
	const nichePut = (name: string, svg: string, shapes: Shape[], piece: PieceId = 'guichet') => nicheParts.set(name, { name, piece, key: 0, svg, shapes, niche: true, anchor: L.railPoint(0.5) });
	arms.forEach((opening, index) => {
		const [px, py] = L.PIVOTS[index];
		const postSvg = solidSvg(cylinder(px, py, 1.5, N.z0, L.ARM.z - N.z0, P, 14), { tone: 'mid' });
		nichePut(`post${index}`, `<g data-tm="post${index}">${postSvg}</g>`, [{ kind: 'solid', F: frame([px, py, N.z0], [0, 0, 1]), profile: [[0, 1.5], [L.ARM.z - N.z0, 1.5]], name: `guichet.post${index}` }]);
		const ring = L.armRing(index, opening);
		nichePut(`arm${index}`, `<g data-tm="arm${index}">${solidSvg(extrude(ring, L.ARM.z, L.ARM.h, P), { tone: 'hi' })}</g>`, [{ kind: 'extruded', ring, z: L.ARM.z, h: L.ARM.h, name: `guichet.arm${index}` }]);
		const capF = frame([px, py, L.ARM.z + L.ARM.h], [0, 0, 1]);
		nichePut(`cap${index}`, `<g data-tm="cap${index}">${solidSvg(cylinder(px, py, 1.2, L.ARM.z + L.ARM.h, 0.9, P, 12), { tone: 'mid' })}${dotsSvg([at3([px, py, L.ARM.z + L.ARM.h + 0.9])], { size: 0.4, tone: 'mid' })}</g>`, [{ kind: 'solid', F: capF, profile: [[0, 1.2], [0.9, 1.2]], name: `guichet.cap${index}` }]);
		const [sx, sy] = L.stopPoint(index);
		const stopF = frame([sx, sy, N.z0], [0, 0, 1]);
		nichePut(`stop${index}`, `<g data-tm="stop${index}">${solidSvg(cylinder(sx, sy, 0.7, N.z0, 3.6, P, 10), { tone: 'mid' })}</g>`, [{ kind: 'solid', F: stopF, profile: [[0, 0.7], [3.6, 0.7]], name: `guichet.stop${index}` }]);
	});
	// Les jetons : construits au début du rail, déplacés le long de lui ; le seul accent vif de la figure.
	const tokenF = frame(L.railPoint(0), [0, 0, 1]);
	const [tx0, ty0, tz0] = L.railPoint(0);
	const tokenSvg = solidSvg(cylinder(tx0, ty0, L.TOKEN.r, tz0, L.TOKEN.h, P, 14, 0.3), { tone: 'hi', lit: true }) + lineSvg(G.circleOf(tokenF, L.TOKEN.h, L.TOKEN.r - 1, P), { tone: 'lit' });
	tokenSlots.forEach((at, index) => {
		const shift: Point3 | null = at === null ? null : [0, L.railPoint(at)[1] - L.railPoint(0)[1], 0];
		const transform = shift ? ` transform="${translate(shift)}"` : '';
		nichePut(
			`token${index}`,
			`<g data-tm="token${index}"${transform}${at === null ? ' opacity="0"' : L.tokenOpacity(at) < 1 ? ` opacity="${L.tokenOpacity(at).toFixed(2)}"` : ''}>${tokenSvg}</g>`,
			at === null ? [] : [{ kind: 'solid', F: frame(L.railPoint(at), [0, 0, 1]), profile: [[0, L.TOKEN.r], [L.TOKEN.h, L.TOKEN.r]], name: `guichet.token${index}` }],
		);
	});
	for (const name of L.nicheOrder(arms, tokenSlots)) {
		const part = nicheParts.get(name) as Item;
		items.push({ ...part, name: `guichet.${name}`, key: 0 });
	}

	// Tambour de temps : 0 à 30 s, et le court secteur jusqu'à 30,4 s, sous un index fixe.
	const DR = L.DRUM;
	const drumF = G.frameOf([DR.x, DR.y0, DR.z], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
	[DR.y0 - 5.5, DR.y1 + 1.5].forEach((y, i) => {
		slab(`tour.bearing${i}`, 'tour', { x: 57, y, w: 10, d: 4, r: 0.6 }, T.capTop, 17, {}, { steps: 2, extra: dotsSvg([at3([67, y + 2, T.capTop + 14.5])], { size: 0.45 }) });
	});
	const marks = L.drumMarksSvg(drumTime(duel));
	// Le tambour tourne sur deux bouts d'axe, portés par ses paliers.
	const length = DR.y1 - DR.y0;
	turned('tour.drum', 'tour', drumF, [[-1.5, 1.6], [0, 1.6], [0, 7.6], [1.2, 7.6], [1.2, DR.r], [length - 1.2, DR.r], [length - 1.2, 7.6], [length, 7.6], [length, 1.6], [length + 1.5, 1.6]], { tone: 'mid' }, { extra: `<g data-tm="drum">${marks}</g>`, at: [DR.x, (DR.y0 + DR.y1) / 2, DR.z] });
	slab('tour.index', 'tour', { x: 64.8, y: 199, w: 2, d: 9.5, r: 0.4 }, T.capTop + 17, 1, {}, { steps: 2, bias: 1 });
	slab('tour.index.tip', 'tour', { x: 65.2, y: 199, w: 1.2, d: 1.2, r: 0.2 }, T.capTop + 15.8, 1.2, {}, { steps: 1, bias: 1.1 });

	// Sélecteur de format : un point pour Défi, deux pour Classé ; l'index est sur Classé au repos.
	const K = L.KNOB;
	const mark = (angle: number, count: number) =>
		Array.from({ length: count }, (_, i) => at3([K.x + Math.cos(angle + (i - (count - 1) / 2) * 0.32) * (K.r + 1.8), K.y + Math.sin(angle + (i - (count - 1) / 2) * 0.32) * (K.r + 1.8), K.z]));
	put(
		'tour.knob',
		'tour',
		[K.x, K.y, K.z + K.h / 2],
		`<g data-tm="selector">${dotsSvg([...mark(L.KNOB_ANGLE.challenge, 1), ...mark(L.KNOB_ANGLE.ranked, 2)], { size: 0.55, tone: 'hi' })}${solidSvg(cylinder(K.x, K.y, K.r, K.z, K.h, P, 24, 0.4), { tone: 'mid', inner: lineSvg(knurl(K.x, K.y, K.r, K.z, K.z + K.h, 30, P), { tone: 'lo' }) })}<g data-tm="knob">${lineSvg(L.knobPointer(duel.ranked ? L.KNOB_ANGLE.ranked : L.KNOB_ANGLE.challenge), { tone: 'hi', free: 'end' })}</g></g>`,
		[{ kind: 'solid', F: frame([K.x, K.y, K.z], [0, 0, 1]), profile: [[0, K.r], [K.h, K.r]], name: 'tour.knob' }],
	);

	// Disjoncteur de cadence sur la joue A : il saute au-delà de 40 frappes par seconde.
	const BR = L.BREAKER;
	const lever = L.leverPath(0);
	slab('tour.breaker', 'tour', { x: BR.x, y: BR.y, w: BR.w, d: BR.d, r: 0.8 }, BR.z, BR.h, {}, {
		steps: 2,
		extra:
			`<g data-tm="lever"><path class="iso-fill" d="${lever.body}"/><path class="iso-line" data-tone="hi" d="${lever.body}"/>${dotsSvg([lever.tip], { size: 0.8, tone: 'hi' })}</g>` +
			dotsSvg([at3([BR.x + BR.w / 2, BR.y + BR.d, BR.z + BR.h / 2]), at3([BR.x + 1.4, BR.y + BR.d, BR.z + BR.h - 1.4]), at3([BR.x + BR.w - 1.4, BR.y + BR.d, BR.z + 1.4])], { size: 0.5 }),
	});

	// --- Lampes de manche, deux par joueur, sous leur grille ---
	LAMPS.forEach((pair, side) =>
		pair.forEach(([x, y, z], index) => {
			const F = frame([x, y, z], [0, 0, 1]);
			const bulb: Point3 = [x, y, z + BULB.at];
			const level = lampLevel(duel, side, index);
			const glow = pathOf(G.hullOf(Array.from({ length: 14 }, (_, k) => at3(G.pointOf(G.frameAlong(bulb, G.viewOf(P)), 0, BULB.r - 0.2, (k / 14) * 6.2832)))), true);
			const cage = G.ribsOf(F, 1.4, 7, 3.9, 8, P, [0.05, 0.5]);
			const svg =
				solidSvg(cylinder(x, y, 4.3, z, 1.4, P, 16, 0.3), { tone: 'mid' }) +
				solidSvg(G.sphereOf(bulb, BULB.r, P, 16), { tone: 'hi' }) +
				`<path data-tm="glow" data-side="${side}" data-i="${index}" class="iso-fill" style="fill:var(--anatomy-hi)" opacity="${(level * 0.78).toFixed(2)}" d="${glow}"/>` +
				fadedSvg(cage, { tone: 'mid' }) +
				solidSvg(cylinder(x, y, 4.1, z + 7, 0.6, P, 16), { tone: 'mid' }) +
				dotsSvg([at3([x, y, z + 7.6])], { size: 0.45 });
			// La grille enferme l'ampoule : sa forme vraie est le cylindre de la cage, du socle au chapeau.
			put(`lampes.${side}.${index}`, 'lampes', [x, y, z + 4], svg, [
				{ kind: 'solid', F, profile: [[0, 4.3], [1.4, 4.3], [1.4, 3.9], [7, 3.9], [7, 4.1], [7.6, 4.1]], name: `lampes.${side}${index}` },
			]);
		}),
	);

	// --- Mât : collier, tube, crémaillères à 24 crans, bagues de Tier, fente du contrepoids, fleuron ---
	const M = L.MAST;
	slab('mat.collar', 'mat', { x: M.x - 3, y: M.y - 3, w: M.w + 6, d: M.w + 6, r: 1 }, T.capTop, 2, {}, {
		steps: 2,
		extra: screws([[M.x - 1.6, M.y - 1.6, T.capTop + 2], [M.x + M.w + 1.6, M.y - 1.6, T.capTop + 2], [M.x - 1.6, M.y + M.w + 1.6, T.capTop + 2], [M.x + M.w + 1.6, M.y + M.w + 1.6, T.capTop + 2]], 0.8),
	});
	const mastPlan: Plan = { x: M.x, y: M.y, w: M.w, d: M.w, r: 0.5 };
	const slot = planOutlineSide(M.x + M.w, L.SLOT.y - 0.8, L.SLOT.y + 0.8, L.SLOT.z0, L.SLOT.z1);
	const weight = mmrOf(duel);
	const weightQuad = flat([[M.x + M.w, L.SLOT.y - 0.5, 0], [M.x + M.w, L.SLOT.y + 0.5, 0], [M.x + M.w, L.SLOT.y + 0.5, 5], [M.x + M.w, L.SLOT.y - 0.5, 5]], true);
	slab('mat.mast', 'mat', mastPlan, T.capTop + 2, M.z1 - T.capTop - 2, {}, {
		steps: 2,
		extra:
			lineSvg(slot, { tone: 'lo' }) +
			`<g data-tm="weight" transform="${translate([0, 0, L.weightZ(weight)])}"><path class="iso-shade" data-shade="0" d="${weightQuad}"/></g>`,
	});
	for (const side of [0, 1]) {
		const rack: Plan = side ? { x: M.x + 1.4, y: M.y - M.rack, w: 3.2, d: M.rack, r: 0.2 } : { x: M.x + 1.4, y: M.y + M.w, w: 3.2, d: M.rack, r: 0.2 };
		const face = side ? rack.y : rack.y + rack.d;
		const teeth = Array.from({ length: 25 }, (_, step) => flat([[rack.x, face, L.notchZ(step)], [rack.x + rack.w, face, L.notchZ(step)]])).join('');
		slab(`mat.rack${side}`, 'mat', rack, 97, 94, {}, { steps: 1, extra: side ? '' : lineSvg(teeth, { tone: 'lo' }), bias: 0.2 });
	}
	[0, 4, 8, 12, 16, 20, 24].forEach((step) =>
		slab(`mat.band${step}`, 'mat', { x: M.x + M.w, y: M.y + 0.2, w: 0.8, d: M.w - 0.4, r: 0.2 }, L.notchZ(step) - 0.6, 1.2, {}, { steps: 1, bias: 0.3 }),
	);
	const tip = frame([M.x + M.w / 2, M.y + M.w / 2, M.z1], [0, 0, 1]);
	disc('mat.finial.base', 'mat', tip, 0, 1.2, 3.4, {}, { bevel: 0.3 });
	disc('mat.finial.neck', 'mat', tip, 1.2, 2.6, 1.4);
	const crown: Point3 = [M.x + M.w / 2, M.y + M.w / 2, M.z1 + 2.6 + 2.2];
	put('mat.finial.ball', 'mat', crown, solidSvg(G.sphereOf(crown, 2.4, P, 20), { tone: 'hi' }), [{ kind: 'ball', at: crown, r: 2.4, name: 'mat.finial.ball' }]);
	disc('mat.finial.spike', 'mat', frame([crown[0], crown[1], crown[2] + 2.3], [0, 0, 1]), 0, 2.2, 0.6, {}, { bias: 0.1 });
	// Curseurs de rang, avec leur vernier de TP et leur drapeau de bouclier.
	for (const side of [0, 1]) {
		const pose = sliderPose(duel, side);
		const plan = L.sliderPlan(side);
		const z = L.notchZ(pose.step) - L.SLIDER.h / 2;
		const vernier = sideTicks(plan.y + 1, plan.y + plan.d - 1, (plan.d - 2) / 4, 2, plan.x + plan.w, z + L.SLIDER.h, [1, 1.8], P, 'y');
		const needle = L.vernierNeedle(side, pose.tp, z);
		const svg =
			solidSvg(slabOf(plan, z, L.SLIDER.h, P, 2, 0.4), { tone: 'mid', inner: lineSvg(vernier.minor, { tone: 'lo' }) + lineSvg(vernier.major, { tone: 'mid' }) }) +
			`<g data-tm="vernier" data-side="${side}">${lineSvg(needle, { tone: 'hi', free: 'end' })}</g>` +
			`<g data-tm="flag" data-side="${side}"><path class="iso-top" d="${L.flagPath(side, z + L.SLIDER.h, pose.shield)}"/><path class="iso-line" data-tone="mid" d="${L.flagPath(side, z + L.SLIDER.h, pose.shield)}"/></g>`;
		put(`mat.slider${side}`, 'mat', centreOf(plan, z, L.SLIDER.h), `<g data-tm="slider" data-side="${side}">${svg}</g>`, [{ kind: 'slab', plan, z, h: L.SLIDER.h, steps: 2, name: `mat.slider${side}` }], { bias: 0.4 });
	}

	// --- Claviers A et B ---
	for (const side of [0, 1]) keyboard(side);

	function keyboard(side: number) {
		const first = items.length;
		const rot = (plan: Plan) => turnPlan(side, plan);
		const housing: Plan = { x: 12, y: 318, w: 72, d: 46, r: 2 };
		const z0 = B.h + 0.8;
		slab(`claviers.housing${side}`, 'claviers', rot(housing), z0, TERRACES[0] - z0, { inner: lineSvg(sideSeam(rot(housing), z0 + 1.6, P, 3), { tone: 'faint' }) }, { steps: 3, bevel: 0.5 });
		[35.6, 28.2, 20.8].forEach((depth, i) => slab(`claviers.terrace${side}.${i}`, 'claviers', rot({ x: 12, y: 318, w: 72, d: depth, r: 1.2 }), TERRACES[i], TERRACES[i + 1] - TERRACES[i], {}, { steps: 1 }));
		// Capot du bandeau, avec sa fenêtre de texte en creux.
		const W = L.WINDOW;
		const cover = rot({ x: 12, y: 318, w: 72, d: 12.5, r: 1.2 });
		const win = rot({ x: W.x0, y: W.y0, w: W.x1 - W.x0, d: W.y1 - W.y0, r: 0 });
		const zw = W.z - W.depth;
		const wx = win.x;
		const wy = win.y;
		const wallX = flat([[wx, wy, zw], [wx, wy + win.d, zw], [wx, wy + win.d, W.z], [wx, wy, W.z]], true);
		const wallY = flat([[wx, wy, zw], [wx + win.w, wy, zw], [wx + win.w, wy, W.z], [wx, wy, W.z]], true);
		const floor = flat([[wx, wy, zw], [wx + win.w, wy, zw], [wx + win.w, wy + win.d, zw], [wx, wy + win.d, zw]], true);
		const text = bandeau(duel, side, L.GLYPH.cursor, L.GLYPH.span);
		const recess =
			`<path class="iso-shade" data-shade="1" d="${floor}"/><path class="iso-shade" data-shade="0" d="${wallX}"/><path class="iso-shade" data-shade="2" d="${wallY}"/>` +
			`<clipPath id="typomaniac-window${side}"><path d="${floor}"/></clipPath>` +
			`<g clip-path="url(#typomaniac-window${side})"><g transform="${L.windowMatrix(side, P)}" data-tm="text" data-side="${side}"${side ? '' : ` data-texts="${duel.texts.map((words) => words.join(' ')).join('|')}"`}>${L.bandeauSvg(text.chars, text.opponent)}</g></g>` +
			lineSvg(flat([[wx, wy, W.z], [wx + win.w, wy, W.z], [wx + win.w, wy + win.d, W.z], [wx, wy + win.d, W.z]], true), { tone: 'lo' });
		slab(`claviers.cover${side}`, 'claviers', cover, TERRACES[3], W.z - TERRACES[3], {}, { steps: 2, bevel: 0.5, extra: recess });
		// Boîte d'envoi : le lot de 50 ms part d'ici, par la fente, vers le connecteur.
		const S = L.SEND_BOX;
		const box = rot({ x: S.x, y: S.y, w: S.w, d: S.d, r: 0.8 });
		const led: Point3 = [box.x + box.w / 2, box.y + box.d / 2 + (side ? -2 : 2), S.z + S.h];
		slab(`claviers.send${side}`, 'claviers', box, S.z, S.h, { inner: lineSvg(sideSeam(box, S.z + S.h - 1.2, P, 2), { tone: 'faint' }) }, {
			steps: 2,
			extra:
				lineSvg(planOutline({ x: box.x + 1.6, y: box.y + box.d / 2 + (side ? 0.6 : -2), w: box.w - 3.2, d: 1.4, r: 0.7 }, S.z + S.h, P, 3), { tone: 'lo' }) +
				lineSvg(G.circleOf(frame(led, [0, 0, 1]), 0, 1.1, P), { tone: 'lo' }) +
				dotsSvg([at3(led)], { size: 0.5, tone: 'mid' }),
		});
		// Touches : 26 lettres, la barre d'espace et retour arrière, en gradins.
		for (const cap of keyCaps(side)) {
			// Arêtes vives : un arrondi d'un pixel ne se voit pas, et 56 touches pèsent sur le budget.
			const plan: Plan = { x: cap.x - cap.w / 2, y: cap.y - KEY.size / 2, w: cap.w, d: KEY.size, r: 0 };
			const depth = keyDepth(duel, side, cap.name);
			const dish = planOutline({ x: plan.x + 1.1, y: plan.y + 1.1, w: plan.w - 2.2, d: plan.d - 2.2, r: 0 }, cap.z + KEY.h, P, 1);
			slab(`claviers.key${side}.${cap.name}`, 'claviers', plan, cap.z, KEY.h, { tone: 'hi', crease: 'none', inner: lineSvg(dish, { tone: 'faint' }) }, {
				steps: 1,
				bias: 3,
				wrap: `data-tm="key" data-side="${side}" data-key="${cap.name}"${depth ? ` transform="${translate([0, 0, -depth * 1.1])}"` : ''}`,
			});
		}
		// Colonnettes et barre de verrouillage, levée pendant la manche.
		const level = barLevel(duel);
		const barZ = L.BAR.up + (L.BAR.down - L.BAR.up) * level;
		[9.5, 86.5].forEach((x, i) => {
			const [px, py] = turn2(side, [x, L.BAR.y]);
			post(`claviers.column${side}.${i}`, 'claviers', px, py, 1.3, z0, 34 - z0, {}, dotsSvg([at3([px, py, 34])], { size: 0.4 }));
		});
		const bar = rot({ x: L.BAR.x0, y: L.BAR.y - L.BAR.d / 2, w: L.BAR.x1 - L.BAR.x0, d: L.BAR.d, r: 0.5 });
		const guides = [rot({ x: L.BAR.x0, y: L.BAR.y - 1.8, w: 2, d: 3.6, r: 0.4 }), rot({ x: L.BAR.x1 - 2, y: L.BAR.y - 1.8, w: 2, d: 3.6, r: 0.4 })];
		put(
			`claviers.bar${side}`,
			'claviers',
			centreOf(bar, L.BAR.up, L.BAR.h),
			`<g data-tm="bar" data-side="${side}"${level ? ` transform="${translate([0, 0, barZ - L.BAR.up])}"` : ''}>${solidSvg(slabOf(bar, L.BAR.up, L.BAR.h, P, 2, 0.3), { tone: 'mid' })}${guides.map((g) => solidSvg(slabOf(g, L.BAR.up - 0.4, L.BAR.h + 0.8, P, 2), { tone: 'mid' })).join('')}</g>`,
			[{ kind: 'slab', plan: bar, z: barZ, h: L.BAR.h, steps: 2, name: `claviers.bar${side}`, owner: `claviers.bar${side}` }, ...guides.map((g, i) => ({ kind: 'slab' as const, plan: g, z: barZ - 0.4, h: L.BAR.h + 0.8, steps: 2, name: `claviers.guide${side}${i}`, owner: `claviers.bar${side}` }))],
			{ bias: 0.5 },
		);
		// Tirette d'abandon (`leave-duel`), sur le flanc avant du boîtier.
		const pullAt: Point3 = turnPoint(side, [84, 341, z0 + 2]);
		const pullF = frame([84, pullAt[1], pullAt[2]], [1, 0, 0]);
		turned(`claviers.pull${side}`, 'claviers', pullF, [[0, 0.7], [2.2, 0.7], [2.2, 1.7], [4.2, 1.7]], {}, { bevel: 0.3 });
		// Connecteur et serre-câble au dos du clavier.
		const plug = frame(turnPoint(side, [48, 318, L.PLUG_Z]), turnAxis(side, [0, -1, 0]));
		disc(`cables.plug${side}`, 'cables', plug, 0, 3.4, 2.9, { tone: 'mid' }, { bevel: 0.3 });
		turned(`cables.boot${side}`, 'cables', plug, [[3.4, 2.7], [5.6, 2.5]], { tone: 'mid' });

		// Les gradins montent vers la tour : chez A ils s'éloignent du lecteur, chez B ils s'en
		// approchent, donc chaque rangée de touches se peint entre les gradins qui l'encadrent.
		const k0 = depthOf([48, side ? 39 : 341, 20], P);
		const stage = (name: string): number => {
			const key = name.match(/^claviers\.key\d\.(.+)$/);
			if (key) {
				const cap = keyCaps(side).find((one) => one.name === key[1]) as KeyCap;
				const row = TERRACES.indexOf(cap.z);
				return (side ? 0.02 + row * 0.04 : 0.5 - row * 0.1) + depthOf([cap.x, cap.y, cap.z], P) * 5e-4 - k0 * 5e-4;
			}
			const terrace = name.match(/^claviers\.terrace\d\.(\d)$/);
			if (terrace) return side ? 0.04 + Number(terrace[1]) * 0.04 : 0.02 + Number(terrace[1]) * 0.02;
			const column = name.match(/^claviers\.column\d\.(\d)$/);
			if (column) return Number(column[1]) === side ? -0.05 : 0.7;
			const fixed: Record<string, number> = { housing: 0, cover: side ? 0.2 : 0.08, send: side ? 0.22 : 0.1, bar: side ? 0.3 : 0.6, pull: 0.65, plug: side ? 0.25 : -0.1, boot: side ? 0.26 : -0.09 };
			return fixed[name.replace(/^\w+\.(\w+?)\d.*$/, '$1')] ?? 0;
		};
		for (const item of items.slice(first)) {
			item.key = k0 + stage(item.name);
			// Un clic n'importe où sur le clavier A frappe la lettre attendue.
			if (!side) item.svg = `<g data-board="a">${item.svg}</g>`;
		}
	}

	// Connecteurs de la tour, dans leur passe-câble en caoutchouc.
	for (const side of [0, 1]) {
		const F = frame(turnPoint(side, [48, 232, L.SOCKET_Z]), turnAxis(side, [0, 1, 0]));
		turned(`socle.grommet${side}`, 'socle', F, [[0, 4.4], [1.2, 4.4], [1.2, 3.2], [1.6, 3.2]], { tone: 'lo' }, { bevel: 0.3 });
		disc(`cables.socket${side}`, 'cables', F, 1.6, 4.5, 2.9, { tone: 'mid' }, { bevel: 0.3 });
		turned(`cables.sboot${side}`, 'cables', F, [[4.5, 2.7], [6.7, 2.5]], { tone: 'mid' });
	}

	// --- Câbles tressés : du dos de chaque clavier au pied de la tour, couchés dans la goulotte ---
	for (const side of [0, 1]) {
		const route = G.fillet(L.cableRoute(side), L.CABLE_R * 2.6, 9, P, L.CABLE_R);
		const total = G.pathLength(route);
		const name = `cables.${side}`;
		routes.push({ name, points: route, r: L.CABLE_R, piece: 'cables' });
		const pulses = pulsesOn(duel, side);
		G.tubes(route, L.CABLE_R, P, { maxLength: 20, spacing: 1.4, rings: { pitch: 4.4, twist: 1.2, cross: true, steps: 6, fade: [0.12, 0.6], tone: 'lo' } }).forEach((piece, index) => {
			// Le tracé de l'impulsion suit le haut du câble et déborde sur les tronçons voisins de leur
			// recouvrement : le corps du tronçon peint ensuite ne coupe pas le tiret au joint.
			const s0 = Math.max(0, piece.from - 0.6);
			const s1 = Math.min(total, piece.to + 0.6);
			const centre = G.cut(route, s0, s1).map((p): Point3 => [p[0], p[1], p[2] + 1]);
			const screen = polylineLength(centre.map(at3));
			const overlay = `<path class="iso-line" data-tone="lit" data-pulse="${side} ${s0.toFixed(2)} ${s1.toFixed(2)} ${total.toFixed(2)} ${screen.toFixed(2)}" d="${flat(centre)}" stroke-dasharray="${L.pulseDash(pulses, total, s0, s1, screen)}" style="stroke-width:2.6;vector-effect:none"/>`;
			const sunk = piece.mid[2] < B.h;
			put(`${name}:${index}`, 'cables', piece.mid, G.tube(piece, 'mid') + overlay, [{ kind: 'tube', points: piece.points, radii: piece.radii, name }], {
				route: name,
				chunk: index,
				bias: 0.05,
				...(sunk ? { key: LAYER.cables + depthOf(piece.mid as Point3, P) * 1e-3 } : {}),
			});
		});
	}

	// Les clés de profondeur ne sont qu'un départ : l'audit du kit mesure chaque recouvrement et
	// repousse ce qui doit passer devant. La niche, découpée par l'embrasure, a son ordre à elle.
	const loose = items.filter((item) => !item.niche).sort((a, b) => a.key - b.key);
	const ranks: number[] = settledRanks(loose, P);
	loose.forEach((item, index) => (item.key = ranks[index]));
	return { items, routes };
}


const turn2 = (side: number, point: Plane) => L.turn(side, point);
const translate = (by: Point3) => {
	const [x, y] = iso(by, { ...P, origin: [0, 0] });
	return `translate(${Math.round(x * 100) / 100} ${Math.round(y * 100) / 100})`;
};
const polylineLength = (points: Flat[]) => points.slice(1).reduce((sum, p, i) => sum + Math.hypot(p[0] - points[i][0], p[1] - points[i][1]), 0);

/** Fente verticale fermée, dans le plan d'une face +x. */
function planOutlineSide(x: number, y0: number, y1: number, z0: number, z1: number) {
	const r = (y1 - y0) / 2;
	const points: Point3[] = [];
	for (let i = 0; i <= 8; i++) points.push([x, y0 + r - r * Math.cos((i / 8) * Math.PI), z1 - r + r * Math.sin((i / 8) * Math.PI)]);
	for (let i = 0; i <= 8; i++) points.push([x, y1 - r + r * Math.cos((i / 8) * Math.PI), z0 + r - r * Math.sin((i / 8) * Math.PI)]);
	return pathOf(points.map((p) => iso(p, L.P)), true);
}

/** Pièces dont le mouvement réécrit des tracés en coordonnées absolues : elles gardent les leurs. */
const ABSOLUTE = /data-tm="(arm\d|drum|flag|lever|knob|vernier|text)"/;
const tenth = (value: number) => String(Math.round(value * 10) / 10).replace(/^-0$/, '0');

/**
 * Réécrit les tracés d'un item par rapport à son centre à l'écran : des nombres plus courts, pour
 * tenir le budget du SVG au repos, sans changer un pixel du dessin.
 */
function relative(svg: string, [ox, oy]: Flat) {
	const shift = (d: string) => {
		let axis = 0;
		return d.replace(/[MLZ]|-?\d+(?:\.\d+)?/g, (token) => {
			if (/[MLZ]/.test(token)) {
				axis = 0;
				return token;
			}
			return tenth(Number(token) - (axis++ % 2 ? oy : ox));
		});
	};
	const body = svg
		.replace(/ d="([^"]*)"/g, (_, d: string) => ` d="${shift(d)}"`)
		.replace(/ cx="([^"]*)" cy="([^"]*)"/g, (_, x: string, y: string) => ` cx="${tenth(Number(x) - ox)}" cy="${tenth(Number(y) - oy)}"`)
		.replace(/ (x[12])="([^"]*)" (y[12])="([^"]*)"/g, (_, xa: string, x: string, ya: string, y: string) => ` ${xa}="${tenth(Number(x) - ox)}" ${ya}="${tenth(Number(y) - oy)}"`);
	return `<g transform="translate(${ox} ${oy})">${body}</g>`;
}

const compact = (item: Item) => {
	if (ABSOLUTE.test(item.svg) || item.svg.includes('clip-path') || item.svg.includes('matrix(')) return item.svg;
	const [x, y] = iso(item.anchor ?? [0, 0, 0], L.P);
	return relative(item.svg, [Math.round(x), Math.round(y)]);
};

/** L'ordre de peinture : les items triés par profondeur, la niche glissée d'un bloc juste après la caisse. */
export function layers(items: Item[]) {
	const ordered = items.filter((item) => !item.niche).sort((a, b) => a.key - b.key);
	const niche = items.filter((item) => item.niche);
	const caseAt = ordered.findIndex((item) => item.name === 'tour.case');
	return { ordered, niche, caseAt, all: [...ordered.slice(0, caseAt + 1), ...niche, ...ordered.slice(caseAt + 1)] };
}

/** Le SVG au repos : les items dans leur ordre de peinture, groupés par pièce, la niche découpée par l'embrasure. */
export function renderFrom(duel: Duel): RestFigure {
	const { items } = build(duel);
	const byId = new Map(pieces.map((piece) => [piece.id, piece]));
	const N = L.NICHE;
	const opening = pathOf([[N.face, N.y0, N.z0], [N.face, N.y1, N.z0], [N.face, N.y1, N.z1], [N.face, N.y0, N.z1]].map((p) => iso(p as Point3, L.P)), true);
	const { ordered, niche, caseAt } = layers(items);
	const runs: { piece: string; svg: string[] }[] = [];
	const push = (piece: string, svg: string) => {
		const last = runs[runs.length - 1];
		if (last && last.piece === piece) last.svg.push(svg);
		else runs.push({ piece, svg: [svg] });
	};
	ordered.forEach((item, index) => {
		push(item.piece, compact(item));
		if (index === caseAt) {
			const inner = niche.map((part) => pieceSvg(byId.get(part.piece)!, `<g data-niche="${part.name}">${compact(part)}</g>`)).join('');
			push('__niche', `<clipPath id="typomaniac-niche"><path d="${opening}"/></clipPath><g clip-path="url(#typomaniac-niche)" data-tm="niche">${inner}</g>`);
		}
	});
	const body = runs.map((run) => (run.piece === '__niche' ? run.svg.join('') : pieceSvg(byId.get(run.piece)!, run.svg))).join('');
	return { width: L.WIDTH, height: L.HEIGHT, body };
}

export const renderRest = (): RestFigure => renderFrom(restDuel(TEXTS));
