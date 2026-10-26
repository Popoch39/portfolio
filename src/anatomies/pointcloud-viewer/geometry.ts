// Géométrie au repos de l'anatomie de pointcloud-viewer : un scanner laser sur trépied, planté
// sur quatre dalles d'orthophoto, au-dessus du nuage qu'il vient de lire. Elle tourne au build et
// sous Node pour l'audit (`audit.mjs`), qui relit les formes enregistrées ici avec chaque pièce.
import {
	cylinder,
	depthOf,
	extrude,
	haloOf,
	iso,
	knurl,
	lineSvg,
	pathOf,
	ring,
	ringOf,
	sideArc,
	slabOf,
	solidSvg,
	wireSvg,
	type Plan,
	type Plane,
	type Point3,
	type SolidPaths,
	type SolidStyle,
} from '../../vendor/anatomy/iso-kit.ts';
import * as G from '../../vendor/anatomy/lathe.mjs';
import { tubeSvg } from '../../vendor/anatomy/tube.mjs';
import type { Piece, RestFigure } from '../contract.ts';
import { pieceSvg } from '../piece.ts';
import { cloudPoints, DOT_STYLE, renderedPaths } from './cloud.ts';
import { CHARIOT, DISC, discMarks, DOCK, RAIL_ANGLE, RAIL_DIR, RAILS, railPoint, SIDE_DIR, TRAVEL } from './disc.ts';
import { ballAt, facingOf, HEAD, mirrorAt, slitAt, teethAt, ticksAt, ventsAt, windowsAt } from './head.ts';
import { beamSlot, GROUND, HEIGHT, impactAt, LEG_ANGLES, legOf, PLUMB, projection as P, TILE, WIDTH } from './layout.ts';
import { LAST_ANGLE, MODES, POINTS } from './model.ts';
import { coiled, rounded } from './tubes.mjs';

// --- Formes enregistrées pour l'audit (des données : `audit.mjs` les remet au kit) -----------

type Frame = { o: Point3; a: Point3; u: Point3; v: Point3 };
export type Shape =
	| { kind: 'slab'; name: string; plan: Plan; z: number; h: number; steps: number }
	| { kind: 'extruded'; name: string; ring: Plane[]; z: number; h: number }
	| { kind: 'cylinder'; name: string; c: Plane; r: number; z: number; h: number }
	| { kind: 'solid'; name: string; F: Frame; profile: number[][] }
	| { kind: 'disc'; name: string; F: Frame; s0: number; s1: number; r: number }
	| { kind: 'prism'; name: string; F: Frame; polygon: Plane[]; s0: number; s1: number }
	| { kind: 'ball'; name: string; at: Point3; r: number }
	| { kind: 'tube'; name: string; points: Point3[]; r: number };

export interface Item {
	name: string;
	piece?: string;
	svg: string;
	shapes: Shape[];
	/** Un morceau du câble : son rang et sa ligne médiane, enregistrés comme tube par l'audit. */
	chunk?: { index: number; points: Point3[] };
}

export interface Route {
	name: string;
	points: Point3[];
	r: number;
	gaps: [number, number][];
	piece?: string;
}

const S = (paths: SolidPaths, style?: SolidStyle) => solidSvg(paths, style);
const L = lineSvg;
const at = (p: Point3) => iso(p, P);
const TAU = Math.PI * 2;
const rad = (degrees: number) => (degrees * Math.PI) / 180;
const add = (a: Point3, b: Point3): Point3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: Point3, k: number): Point3 => [a[0] * k, a[1] * k, a[2] * k];
const sub = (a: Point3, b: Point3): Point3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const unit = (a: Point3): Point3 => mul(a, 1 / Math.hypot(...a));
const cross = (a: Point3, b: Point3): Point3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const polar = (degrees: number, r: number, z: number): Point3 => [r * Math.cos(rad(degrees)), r * Math.sin(rad(degrees)), z];
const planar = (degrees: number, r: number): Plane => [r * Math.cos(rad(degrees)), r * Math.sin(rad(degrees))];
const dots = (points: Point3[], size = 0.45, tone = 'mid') =>
	`<g class="iso-dots" data-tone="${tone}">${points.map((p) => at(p)).map(([x, y]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${size}"/>`).join('')}</g>`;
/** Facettes des petites pièces de révolution : les tons suffisent, le contour reste un vrai cercle. */
const SMALL = { steps: 16 };
const halo = (plan: Plan, z: number) => `<path class="iso-halo" d="${haloOf(plan, z, 0.1, P)}"/>`;

/** Un anneau de plan horizontal autour de `centre`, tourné de `angle` : boîtes hors des axes. */
function turned(centre: Plane, angle: number, halfAlong: number, halfAcross: number, r: number, steps = 3): Plane[] {
	const [c, s] = [Math.cos(angle), Math.sin(angle)];
	return ringOf({ x: -halfAlong, y: -halfAcross, w: halfAlong * 2, d: halfAcross * 2, r }, steps).map(([x, y]) => [centre[0] + x * c - y * s, centre[1] + x * s + y * c]);
}
const railPlane = (along: number, across: number): Plane => {
	const [x, y] = railPoint(along, across, 0);
	return [x, y];
};

// --- Le terrain ------------------------------------------------------------------------------

const TILES: Plan[] = [
	{ x: -TILE, y: -TILE, w: TILE, d: TILE, r: 0.8 },
	{ x: 0, y: -TILE, w: TILE, d: TILE, r: 0.8 },
	{ x: -TILE, y: 0, w: TILE, d: TILE, r: 0.8 },
	{ x: 0, y: 0, w: TILE, d: TILE, r: 0.8 },
];

function terrain(): Item[] {
	return TILES.slice()
		.sort((a, b) => depthOf([a.x + a.w / 2, a.y + a.d / 2, 0], P) - depthOf([b.x + b.w / 2, b.y + b.d / 2, 0], P))
		.map((plan, index) => ({
			name: `stand.tile${index}`,
			svg: S(slabOf(plan, 0, GROUND, P, 3, 0.6), { tone: 'lo' }),
			shapes: [{ kind: 'slab', name: `stand.tile${index}`, plan, z: 0, h: GROUND, steps: 3 }],
		}));
}

/**
 * L'orthophoto en trame : des îlots bâtis en pointillé serré, un jardin en pointillé lâche, sans
 * contour, coupés net au bord de chaque dalle (le quartier de l'Odéon, sous la station).
 */
function raster() {
	const blocks: Plane[][] = [];
	// Des rues un peu de biais, comme le tissu haussmannien : îlots entre deux rues de chaque famille.
	const north = [8, 30, 52, 76, 102];
	const east = [-100, -72, -44, -14, 16, 46, 74, 102];
	for (let i = 0; i < north.length - 1; i++) {
		for (let k = 0; k < east.length - 1; k++) {
			const skew = (x: number) => x * 0.12;
			const [x0, x1] = [north[i] + 2.6, north[i + 1] - 2.6];
			const [y0, y1] = [east[k] + 2.6, east[k + 1] - 2.6];
			blocks.push([
				[x0, y0 + skew(x0)],
				[x0, y1 + skew(x0)],
				[x1, y1 + skew(x1)],
				[x1, y0 + skew(x1)],
			]);
		}
	}
	for (let k = 0; k < east.length - 1; k++) {
		blocks.push([
			[-30, east[k] + 2.6],
			[-30, east[k + 1] - 2.6],
			[2.6, east[k + 1] - 2.6],
			[2.6, east[k] + 2.6],
		]);
	}
	const rowsOf = (polygon: Plane[], gap: number, courtyard: boolean) => {
		const xs = polygon.map(([x]) => x);
		const out: [number, number, number][] = [];
		for (let x = Math.min(...xs) + gap / 2; x < Math.max(...xs); x += gap) {
			const hits: number[] = [];
			polygon.forEach(([ax, ay], index) => {
				const [bx, by] = polygon[(index + 1) % polygon.length];
				if ((ax - x) * (bx - x) < 0) hits.push(ay + ((x - ax) / (bx - ax)) * (by - ay));
			});
			if (hits.length < 2) continue;
			const [y0, y1] = [Math.min(...hits), Math.max(...hits)];
			const middle = (Math.min(...xs) + Math.max(...xs)) / 2;
			const inner = courtyard && Math.abs(x - middle) < (Math.max(...xs) - Math.min(...xs)) * 0.18;
			const spans: [number, number][] = inner ? [[y0, y0 + (y1 - y0) * 0.3], [y1 - (y1 - y0) * 0.3, y1]] : [[y0, y1]];
			for (const [a, b] of spans) {
				// Coupés net au joint des dalles.
				const cuts = [a, ...(a < -0.6 && b > 0.6 ? [-0.6, 0.6] : []), b];
				for (let c = 0; c < cuts.length; c += 2) if (cuts[c + 1] - cuts[c] > 0.8) out.push([x, cuts[c], cuts[c + 1]]);
			}
		}
		return out;
	};
	const row = ([x, a, b]: [number, number, number]) => pathOf([at([x, a, GROUND]), at([x, b, GROUND])]);
	const dense = blocks.flatMap((block) => rowsOf(block, 2.4, true)).filter(([x]) => Math.abs(x) > 0.6);
	const garden: Plane[] = [
		[-100, -100],
		[-100, 100],
		[-36, 100],
		[-36, -100],
	];
	const loose = rowsOf(garden, 3.6, false).filter(([x]) => (x < -78 || x > -70) && Math.abs(x) > 0.6);
	return [
		`<path d="${dense.map(row).join('')}" style="stroke:var(--anatomy-faint);stroke-width:1.2;stroke-dasharray:0 3.4;stroke-linecap:round;fill:none"/>`,
		`<path d="${loose.map(row).join('')}" style="stroke:var(--anatomy-faint);stroke-width:1;stroke-dasharray:0 5.2;stroke-linecap:round;fill:none"/>`,
		// L'allée du jardin : une hachure fine qui traverse deux dalles et finit sur leurs bords.
		L([-71.5, -74, -76.5].map((x) => pathOf([at([x, -TILE, GROUND]), at([x, TILE, GROUND])])).join(''), { tone: 'faint' }),
	];
}

function station(): (Item | string)[] {
	return [
		// L'anneau peint autour du clou, sur la dalle.
		L(ring(0, 0, 2.6, GROUND, P, 32), { tone: 'lo' }),
		{
			name: 'stand.nail',
			svg: S(cylinder(0, 0, 1.3, GROUND, 0.5, P, 12), { tone: 'mid' }) + dots([[0, 0, GROUND + 0.5]], 0.4, 'hi'),
			shapes: [{ kind: 'cylinder', name: 'stand.nail', c: [0, 0], r: 1.3, z: GROUND, h: 0.5 }],
		},
	];
}

/** La borne d'angle : le minimum par axe des points, le World Offset (calcul refait, concept § 6). */
export const CORNERS = (() => {
	let [nx, ny, xx, xy] = [Infinity, Infinity, -Infinity, -Infinity];
	for (let i = 0; i < POINTS; i++) {
		const t = i / 100;
		const [n, e] = [Math.round(Math.sin(t) * t * 50) / 1000, Math.round(Math.cos(t) * t * 50) / 1000];
		[nx, ny, xx, xy] = [Math.min(nx, n), Math.min(ny, e), Math.max(xx, n), Math.max(xy, e)];
	}
	return { min: [nx * 2, ny * 2] as Plane, max: [xx * 2, xy * 2] as Plane };
})();

function borne(piece: Piece): Item {
	const [x, y] = CORNERS.min;
	const plan = { x: x - 3.4, y: y - 3.4, w: 6.8, d: 6.8, r: 1.4 };
	const top = GROUND + 4.2;
	return {
		name: 'borne',
		piece: piece.id,
		svg: pieceSvg(piece, [
			halo({ x: x - 5, y: y - 5, w: 10, d: 10, r: 4 }, GROUND),
			S(slabOf(plan, GROUND, 4.2, P, 4, 1.2), { tone: 'mid' }),
			S(cylinder(x, y, 2.7, top, 0.25, P, 20), { tone: 'mid' }),
			`<g data-flash="">${S(cylinder(x, y, 2.1, top + 0.25, 0.45, P, 20, 0.3), {
				tone: 'hi',
				inner: L([pathOf([at([x - 1.5, y, top + 0.7]), at([x + 1.5, y, top + 0.7])]), pathOf([at([x, y - 1.5, top + 0.7]), at([x, y + 1.5, top + 0.7])])].join(''), { tone: 'mid', free: true }),
			})}</g>`,
		]),
		shapes: [
			{ kind: 'slab', name: 'borne.stone', plan, z: GROUND, h: 4.2, steps: 4 },
			{ kind: 'cylinder', name: 'borne.ring', c: [x, y], r: 2.7, z: top, h: 0.25 },
			{ kind: 'cylinder', name: 'borne.disc', c: [x, y], r: 2.1, z: top + 0.25, h: 0.45 },
		],
	};
}

/** Le jalon d'emprise à l'angle opposé, le maximum de la bbox : tube à bandes, sabot, cible damier. */
function jalon(): Item[] {
	const [x, y] = CORNERS.max;
	const up = G.frameOf([x, y, GROUND], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
	const shoe = [[0, 0], [2.6, 1.25], [3.4, 1.25]];
	const items: Item[] = [
		{
			name: 'jalon.shoe',
			svg: halo({ x: x - 4, y: y - 4, w: 8, d: 8, r: 4 }, GROUND) + S(G.solidOf(shoe, up, P, SMALL), { tone: 'mid' }),
			shapes: [{ kind: 'solid', name: 'jalon.shoe', F: up, profile: shoe }],
		},
	];
	// Bandes alternées : une bande sur deux prend les tons d'une peinture sombre.
	const dark = 'style="--anatomy-paper:var(--anatomy-mid);--anatomy-top:var(--anatomy-mid);--anatomy-shade-0:var(--anatomy-hi);--anatomy-shade-1:var(--anatomy-hi);--anatomy-shade-2:var(--anatomy-mid);--anatomy-shade-3:var(--anatomy-mid)"';
	const bands = 7;
	// Le tube s'arrête sous le haut de la cible, qui le cache.
	const [from, to] = [3.4, 42.4];
	for (let k = 0; k < bands; k++) {
		const [s0, s1] = [from + ((to - from) * k) / bands, from + ((to - from) * (k + 1)) / bands];
		const svg = S(cylinder(x, y, 1, GROUND + s0, s1 - s0, P, 16), { tone: 'hi', crease: 'none' });
		items.push({ name: `jalon.band${k}`, svg: k % 2 ? `<g ${dark}>${svg}</g>` : svg, shapes: [{ kind: 'cylinder', name: `jalon.band${k}`, c: [x, y], r: 1, z: GROUND + s0, h: s1 - s0 }] });
	}
	// La cible fait face au lecteur, son dos tangent au tube.
	const toward = unit([Math.cos(rad(40)), Math.sin(rad(40)), 0]);
	const side = cross([0, 0, 1], toward);
	const face = G.frameOf(add([x, y, GROUND + 40.5], mul(toward, 1)), toward, side, [0, 0, 1]);
	const square: Plane[] = [
		[-3.2, -3.2],
		[3.2, -3.2],
		[3.2, 3.2],
		[-3.2, 3.2],
	];
	const quad = (u0: number, v0: number) => {
		const corner = (u: number, v: number) => at(add(face.o, add(mul(toward, 0.5), add(mul(side, u), [0, 0, v]))));
		return pathOf([corner(u0, v0), corner(u0 + 3.2, v0), corner(u0 + 3.2, v0 + 3.2), corner(u0, v0 + 3.2)], true);
	};
	items.push({
		name: 'jalon.target',
		svg: S(G.prismOf(face, square, 0, 0.5, P), {
			tone: 'hi',
			inner: `<path d="${quad(-3.2, 0) + quad(0, -3.2)}" style="fill:var(--anatomy-hi);stroke:none" opacity="0.8"/>`,
		}) + dots([add(face.o, mul(toward, 0.5))], 0.5, 'hi'),
		shapes: [{ kind: 'prism', name: 'jalon.target', F: face, polygon: square, s0: 0, s1: 0.5 }],
	});
	return items;
}

// --- Le trépied ------------------------------------------------------------------------------

const BAR: Plane[] = [
	[-1.9, -1.1],
	[1.9, -1.1],
	[1.9, 1.1],
	[-1.9, 1.1],
];
const box = (hu: number, hv: number): Plane[] => [
	[-hu, -hv],
	[hu, -hv],
	[hu, hv],
	[-hu, hv],
];

/** Les pièces d'une jambe, rangées du fond vers le lecteur le long de son axe. */
function leg(degrees: number, index: number, collar: boolean): Item[] {
	const { hinge, foot } = legOf(degrees);
	const axis = sub(foot, hinge);
	const length = Math.hypot(...axis);
	const a = unit(axis);
	const u = unit(cross([0, 0, 1], a));
	const v = cross(a, u);
	const F: Frame = G.frameOf(hinge, a, u, v);
	const name = (part: string) => `leg${index}.${part}`;
	// Chaque pièce garde un point représentatif : les pièces coaxiales se peignent du bout le plus
	// loin du lecteur vers le plus proche.
	const items: (Item & { centre: Point3 })[] = [];
	const put = (part: string, centre: Point3, svg: string, shapes: Shape[]) => items.push({ name: name(part), centre, svg, shapes });
	const along = (s: number) => add(hinge, mul(a, s));
	const prism = (part: string, polygon: Plane[], s0: number, s1: number, tone: SolidStyle['tone'] = 'mid', frame: Frame = F) =>
		put(part, add(frame.o, mul(frame.a, (s0 + s1) / 2)), S(G.prismOf(frame, polygon, s0, s1, P), { tone }), [{ kind: 'prism', name: name(part), F: frame, polygon, s0, s1 }]);

	const [clampFrom, clampTo] = [length * 0.55, length * 0.6];
	const [slideTo, spikeFrom] = [length * 0.9, length * 0.9];
	// La jambe de bois, coupée par le collier du support de carnet sur la jambe gauche.
	const collarSpan: [number, number] = [length * 0.1, length * 0.15];
	if (collar) {
		prism('bar', BAR, 0, collarSpan[0]);
		prism('collar', box(2.5, 1.7), collarSpan[0], collarSpan[1]);
		prism('bar2', BAR, collarSpan[1], clampFrom);
	} else prism('bar', BAR, 0, clampFrom);
	prism('clamp', box(2.5, 1.7), clampFrom, clampTo);
	// Le papillon de serrage, sur la face haute du collier.
	const wingAt = add(add(hinge, mul(a, (clampFrom + clampTo) / 2)), mul(v, 1.7));
	const stem = G.frameOf(wingAt, v, a, u);
	put('wing.stem', wingAt, S(G.disc(0, 0.7, 0.5, stem, P, SMALL), { tone: 'mid' }), [{ kind: 'disc', name: name('wing.stem'), F: stem, s0: 0, s1: 0.7, r: 0.5 }]);
	prism('wing', box(0.35, 1.5), 0.7, 1.1, 'mid', stem);
	put('slide', along((clampTo + slideTo) / 2), S(G.disc(clampTo, slideTo, 1, F, P, SMALL), { tone: 'mid', crease: 'none' }), [{ kind: 'disc', name: name('slide'), F, s0: clampTo, s1: slideTo, r: 1 }]);
	const spike = [
		[spikeFrom, 1.3],
		[spikeFrom + 1.6, 1.3],
		[spikeFrom + 1.6, 0.9],
		[length, 0],
	];
	put('spike', along((spikeFrom + length) / 2), S(G.solidOf(spike, F, P, SMALL), { tone: 'lo' }), [{ kind: 'solid', name: name('spike'), F, profile: spike }]);
	// La pédale, une patte plate qui sort de la virole vers l'extérieur.
	const out = unit([a[0], a[1], 0]);
	const pedalFrame = G.frameOf(along(spikeFrom + 0.8), out, cross([0, 0, 1], out), [0, 0, 1]);
	prism('pedal', box(0.9, 0.3), 0.95, 3.4, 'lo', pedalFrame);
	// La pédale passe juste après la pointe, sauf sur la jambe du fond, où elle fuit derrière elle.
	const away = out[0] * Math.cos(rad(40)) + out[1] * Math.sin(rad(40)) < -0.3;
	items[items.length - 1].centre = add(along((spikeFrom + length) / 2), [0, 0, away ? -0.5 : 0.5]);
	const chain = items.splice(0).sort((x, y) => depthOf(x.centre, P) - depthOf(y.centre, P));
	// La charnière : deux joues sous le plateau, la jambe entre elles, les têtes d'axe dehors. La joue
	// lointaine et sa tête passent avant la jambe, la proche après.
	const flat = unit([a[0], a[1], 0]);
	const hingeOf = (sign: number) => {
		const cheek = G.frameOf(add(hinge, add(mul(u, sign * 2.5), [0, 0, 0.5])), mul(u, sign), flat, [0, 0, 1]);
		prism(`cheek${sign}`, box(2.6, 3.5), -0.6, 0.6, 'mid', cheek);
		put(`pin${sign}`, cheek.o, S(G.disc(0.6, 1.1, 1, cheek, P, SMALL), { tone: 'mid' }), [{ kind: 'disc', name: name(`pin${sign}`), F: cheek, s0: 0.6, s1: 1.1, r: 1 }]);
		const [cheekItem, pin] = items.splice(0);
		return { depth: depthOf(cheek.o, P), parts: [cheekItem, pin] };
	};
	const [near, far] = [hingeOf(-1), hingeOf(1)].sort((x, y) => y.depth - x.depth);
	return [far.parts[1], far.parts[0], ...chain, near.parts[0], near.parts[1]];
}

/** Le support de carnet : un bras du collier de la jambe gauche jusqu'au berceau du rail. */
function supportArm(): Item[] {
	const { hinge, foot } = legOf(LEG_ANGLES[1]);
	const a = unit(sub(foot, hinge));
	const length = Math.hypot(...sub(foot, hinge));
	const u = unit(cross([0, 0, 1], a));
	const v = cross(a, u);
	const collarMid = add(hinge, mul(a, length * 0.125));
	const end = railPoint(RAILS.to - 2.2, 0, DOCK.z0);
	// Le bras quitte la face haute du collier ; il démarre un peu dehors, son bout étant oblique.
	const start = add(collarMid, add(mul(v, 1.7), mul(unit(sub(end, collarMid)), 0.6)));
	const axis = unit(sub(end, start));
	const F = G.frameOf(start, axis, unit(cross([0, 0, 1], axis)), cross(axis, unit(cross([0, 0, 1], axis))));
	// Le bout oblique du bras touche le berceau par son arête la plus haute.
	const reach = Math.hypot(...sub(end, start)) - 0.35;
	const polygon = box(0.8, 0.8);
	const cradle = turned(railPlane(RAILS.to - 2.2, 0), RAIL_ANGLE, 1.8, RAILS.gauge / 2 + 1.2, 0.5);
	return [
		{ name: 'support.arm', svg: S(G.prismOf(F, polygon, 0, reach, P), { tone: 'mid' }), shapes: [{ kind: 'prism', name: 'support.arm', F, polygon, s0: 0, s1: reach }] },
		{ name: 'support.cradle', svg: S(extrude(cradle, DOCK.z0, DOCK.z1 - DOCK.z0, P, { bevel: 0.4 }), { tone: 'mid' }), shapes: [{ kind: 'extruded', name: 'support.cradle', ring: cradle, z: DOCK.z0, h: DOCK.z1 - DOCK.z0 }] },
	];
}

function plumb(): Item[] {
	const down = G.frameOf([0, 0, PLUMB.bob], [0, 0, -1], [1, 0, 0], [0, -1, 0]);
	const bob = [
		[0, 0.5],
		[0.7, 1.7],
		[1.8, 1.7],
		[PLUMB.bob - PLUMB.tip, 0],
	];
	const line: Point3[] = [
		[0, 0, PLUMB.top],
		[0, 0, PLUMB.bob],
	];
	return [
		// Le fil tendu porte le plomb : il compte comme un tube rigide pour l'audit.
		{ name: 'plumb.bob', svg: S(G.solidOf(bob, down, P, SMALL), { tone: 'hi', crease: 'lo' }), shapes: [{ kind: 'solid', name: 'plumb.bob', F: down, profile: bob }] },
		{ name: 'plumb.line', svg: L(pathOf(line.map(at)), { tone: 'mid' }), shapes: [{ kind: 'tube', name: 'plumb.line', points: line, r: 0.2 }] },
	];
}

const triangle = (corner: number, fillet: number, offset: number) =>
	G.hullOf(LEG_ANGLES.flatMap((degrees) => Array.from({ length: 12 }, (_, k): Plane => {
		const [cx, cy] = polar(degrees + offset, corner, 0);
		return [cx + fillet * Math.cos((k / 12) * TAU), cy + fillet * Math.sin((k / 12) * TAU)];
	}))) as Plane[];

const PLATE = { z0: 92, z1: 96 };
const EMBASE = { z0: 96, z1: 97.4, screw: [97.4, 100.2], top: [100.2, 101.6] };
/** Le socle fixe déborde de la couronne : son rebord porte le cliquet et l'index, en vue. */
const SOCLE = { r: 18.8, z0: 101.6, z1: HEAD.crown.z0 };

function plateau(): Item[] {
	const plate = triangle(16, 7, 0);
	const knob = { r: 4.2, z: 86, h: 2.4 };
	return [
		{
			name: 'tripod.screw',
			// La vis traverse la molette : deux tronçons, sous elle et au-dessus.
			svg: [
				S(cylinder(0, 0, 1.4, PLUMB.top, knob.z - PLUMB.top, P, 12), { tone: 'mid', crease: 'none' }),
				S(cylinder(0, 0, knob.r, knob.z, knob.h, P, 20), { tone: 'mid' }),
				L(knurl(0, 0, knob.r, knob.z, knob.z + knob.h, 30, P), { tone: 'lo' }),
				S(cylinder(0, 0, 1.4, knob.z + knob.h, PLATE.z0 - knob.z - knob.h, P, 12), { tone: 'mid', crease: 'none' }),
			].join(''),
			shapes: [
				{ kind: 'cylinder', name: 'tripod.screw', c: [0, 0], r: 1.4, z: PLUMB.top, h: knob.z - PLUMB.top },
				{ kind: 'cylinder', name: 'tripod.knob', c: [0, 0], r: knob.r, z: knob.z, h: knob.h },
				{ kind: 'cylinder', name: 'tripod.screw.top', c: [0, 0], r: 1.4, z: knob.z + knob.h, h: PLATE.z0 - knob.z - knob.h },
			],
		},
		{
			name: 'tripod.plate',
			svg: S(extrude(plate, PLATE.z0, PLATE.z1 - PLATE.z0, P, { bevel: 0.8 }), { tone: 'mid' }),
			shapes: [{ kind: 'extruded', name: 'tripod.plate', ring: plate, z: PLATE.z0, h: PLATE.z1 - PLATE.z0 }],
		},
	];
}

// --- La tête -----------------------------------------------------------------------------------

function embase(): Item[] {
	const lower = triangle(17.5, 4, 0);
	const upper = triangle(17, 3, 0);
	const items: Item[] = [
		{
			name: 'embase.lower',
			svg: S(extrude(lower, EMBASE.z0, EMBASE.z1 - EMBASE.z0, P, { bevel: 0.5 }), { tone: 'mid' }),
			shapes: [{ kind: 'extruded', name: 'embase.lower', ring: lower, z: EMBASE.z0, h: EMBASE.z1 - EMBASE.z0 }],
		},
	];
	const [z0, z1] = EMBASE.screw;
	LEG_ANGLES.slice()
		.sort((a, b) => depthOf(polar(a, 19.6, 0), P) - depthOf(polar(b, 19.6, 0), P))
		.forEach((degrees, k) => {
			const [x, y] = polar(degrees, 19.6, 0);
			items.push({
				name: `embase.screw${k}`,
				svg: S(cylinder(x, y, 2.2, z0, z1 - z0, P, 16), { tone: 'mid' }) + L(knurl(x, y, 2.2, z0, z1, 22, P), { tone: 'lo' }),
				shapes: [{ kind: 'cylinder', name: `embase.screw${k}`, c: [x, y], r: 2.2, z: z0, h: z1 - z0 }],
			});
		});
	items.push({
		name: 'embase.upper',
		svg: S(extrude(upper, EMBASE.top[0], EMBASE.top[1] - EMBASE.top[0], P, { bevel: 0.5 }), { tone: 'mid' }),
		shapes: [{ kind: 'extruded', name: 'embase.upper', ring: upper, z: EMBASE.top[0], h: EMBASE.top[1] - EMBASE.top[0] }],
	});
	// La nivelle sphérique, bulle centrée, sur le lobe avant.
	const [nx, ny] = polar(LEG_ANGLES[2] + 12, 17.2, 0);
	const z = EMBASE.z1;
	items.splice(1, 0, {
		name: 'embase.level',
		svg: S(cylinder(nx, ny, 1.5, z, 0.9, P, 14, 0.3), { tone: 'mid', inner: L(ring(nx, ny, 0.8, z + 0.9, P, 14), { tone: 'lo' }) }) + dots([[nx, ny, z + 0.9]], 0.4, 'hi'),
		shapes: [{ kind: 'cylinder', name: 'embase.level', c: [nx, ny], r: 1.5, z, h: 0.9 }],
	});
	return items;
}

function socle(): Item {
	return {
		name: 'head.socle',
		svg: S(cylinder(0, 0, SOCLE.r, SOCLE.z0, SOCLE.z1 - SOCLE.z0, P, 40, 0.6), {
			tone: 'mid',
			inner: L(sideArc(0, 0, SOCLE.r, SOCLE.z1 - 0.8, P, 40), { tone: 'faint' }),
		}),
		shapes: [{ kind: 'cylinder', name: 'head.socle', c: [0, 0], r: SOCLE.r, z: SOCLE.z0, h: SOCLE.z1 - SOCLE.z0 }],
	};
}

/** Le cliquet fixe : axe, levier couché sur le socle, bec appuyé sur les dents, ressort. */
function pawl(): Item {
	const degrees = 18;
	const pivot = polar(degrees + 8, SOCLE.r - 0.6, SOCLE.z1);
	const tip = polar(degrees, HEAD.crown.r + 0.45, SOCLE.z1);
	const lever = G.frameOf(pivot, unit(sub(tip, pivot)), [0, 0, 1], cross(unit(sub(tip, pivot)), [0, 0, 1]));
	const reach = Math.hypot(...sub(tip, pivot));
	const polygon: Plane[] = [
		[0, -0.35],
		[1.2, -0.35],
		[1.2, 0.35],
		[0, 0.35],
	];
	return {
		name: 'head.pawl',
		svg: [
			`<g data-pawl="">${S(G.prismOf(lever, polygon, 0, reach, P), { tone: 'hi', crease: 'lo' })}</g>`,
			S(cylinder(pivot[0], pivot[1], 0.55, SOCLE.z1, 1.6, P, 10), { tone: 'mid' }),
		].join(''),
		shapes: [
			{ kind: 'prism', name: 'head.pawl', F: lever, polygon, s0: 0, s1: reach },
			{ kind: 'cylinder', name: 'head.pawl.pin', c: [pivot[0], pivot[1]], r: 0.55, z: SOCLE.z1, h: 1.6 },
		],
	};
}

/** Les parties fixes de la couronne, du cercle, du boîtier, du chapeau et de la roue, au repos. */
function rotor(angle: number, boitier: Piece, miroir: Piece, roue: Piece) {
	const { crown, circle, body, cap, wheel } = HEAD;
	const teeth = teethAt(angle);
	const ticks = ticksAt(angle);
	const slit = slitAt(angle, 0);
	const vents = ventsAt(angle);
	const windows = windowsAt(angle, 0);
	const crownSvg = S(cylinder(0, 0, crown.r, crown.z0, crown.z1 - crown.z0, P, 40), {
		tone: 'mid',
		inner: teeth.map((d, k) => `<path class="iso-line" data-tone="lo" data-rot="teeth${k}" opacity="${(k + 1) / 4}" d="${d}"/>`).join(''),
	});
	const circleSvg = S(cylinder(0, 0, circle.r, circle.z0, circle.z1 - circle.z0, P, 40, 0.4), { tone: 'mid' });
	const tickSvg = [
		`<path class="iso-line" data-tone="lo" data-rot="minor" d="${ticks.minor}"/>`,
		`<path class="iso-line" data-tone="mid" data-rot="major" d="${ticks.major}"/>`,
		`<path class="iso-line" data-tone="hi" data-rot="zero" d="${ticks.zero}"/>`,
	].join('');
	const bodySvg = S(cylinder(0, 0, body.r, body.z0, body.z1 - body.z0, P, 40), {
		tone: 'mid',
		inner: [
			L(sideArc(0, 0, body.r, body.z0 + 2, P, 40), { tone: 'faint' }),
			...vents.map(({ d, alpha }, k) => `<path class="iso-line" data-tone="lo" data-rot="vent${k}" opacity="${alpha.toFixed(2)}" d="${d}"/>`),
		].join(''),
	});
	const drumSvg = (drum: NonNullable<typeof slit>['drum'], key: string) =>
		`<g class="iso-solid" data-rot="${key}"><path class="iso-fill" d="${drum.fill}"/>${drum.shades.map((d, k) => `<path class="iso-shade" data-shade="${k}" d="${d}"/>`).join('')}<path class="iso-top" d="${drum.mirror}"/><path class="iso-line" data-tone="lo" d="${drum.ribs}"/><path class="iso-line iso-edge" data-tone="hi" d="${drum.outline}"/></g>`;
	const slitSvg = [
		`<clipPath id="pointcloud-viewer-slit"><path data-rot="clip" d="${slit?.opening ?? ''}"/></clipPath>`,
		`<g clip-path="url(#pointcloud-viewer-slit)">`,
		pieceSvg(boitier, [
			`<path data-rot="back" d="${slit?.back ?? ''}" style="fill:var(--anatomy-mid)"/>`,
			`<path data-rot="side" d="${slit?.side ?? ''}" style="fill:var(--anatomy-lo)"/>`,
			`<path data-rot="floor" d="${slit?.floor ?? ''}" style="fill:var(--anatomy-lo)"/>`,
			`<path class="iso-shade" data-shade="2" data-rot="bearing" d="${slit?.bearing ?? ''}"/>`,
			`<path class="iso-line" data-tone="lo" data-rot="bearing-ring" d="${slit?.bearing ?? ''}"/>`,
		]),
		pieceSvg(miroir, [`<g data-rot="ghost" opacity="0.35"></g>`, slit ? drumSvg(slit.drum, 'drum') : '']),
		`</g>`,
		pieceSvg(boitier, `<path class="iso-line" data-tone="mid" data-rot="opening" d="${slit?.opening ?? ''}"/>`),
	].join('');
	const capSvg = S(cylinder(0, 0, cap.r, cap.z0, cap.z1 - cap.z0, P, 40, 0.6), { tone: 'mid' });
	const wheelSvg = [
		S(cylinder(0, 0, wheel.r, wheel.z0, wheel.z1 - wheel.z0, P, 40, 0.5), { tone: 'hi', crease: 'lo' }),
		...windows.map((d, k) => `<path class="iso-shade" data-shade="${k}" data-rot="window${k}" d="${d}"/><path class="iso-line" data-tone="mid" data-rot="window-ring${k}" d="${d}"/>`),
		S(cylinder(0, 0, 1.6, wheel.z1, 0.8, P, 12), { tone: 'mid' }),
		`<path class="iso-shade" data-shade="3" data-rot="ball" d="${ballAt(angle)}"/><path class="iso-line" data-tone="mid" data-rot="ball-ring" d="${ballAt(angle)}"/>`,
	].join('');
	const shapes = {
		crown: { kind: 'cylinder', name: 'head.crown', c: [0, 0], r: crown.r, z: crown.z0, h: crown.z1 - crown.z0 } as Shape,
		circle: { kind: 'cylinder', name: 'head.circle', c: [0, 0], r: circle.r, z: circle.z0, h: circle.z1 - circle.z0 } as Shape,
		body: { kind: 'cylinder', name: 'head.body', c: [0, 0], r: body.r, z: body.z0, h: body.z1 - body.z0 } as Shape,
		cap: { kind: 'cylinder', name: 'head.cap', c: [0, 0], r: cap.r, z: cap.z0, h: cap.z1 - cap.z0 } as Shape,
		wheel: { kind: 'cylinder', name: 'head.wheel', c: [0, 0], r: wheel.r, z: wheel.z0, h: wheel.z1 - wheel.z0 } as Shape,
		hub: { kind: 'cylinder', name: 'head.wheel.hub', c: [0, 0], r: 1.6, z: wheel.z1, h: 0.8 } as Shape,
	};
	return [
		{ name: 'head.crown', svg: crownSvg, shapes: [shapes.crown] },
		{ name: 'head.circle', svg: circleSvg + tickSvg, shapes: [shapes.circle] },
		{ name: 'head.body', piece: boitier.id, svg: pieceSvg(boitier, bodySvg), shapes: [shapes.body] },
		{ name: 'head.slit', svg: slitSvg, shapes: [] },
		{ name: 'head.cap', svg: capSvg, shapes: [shapes.cap] },
		{ name: 'head.wheel', piece: roue.id, svg: pieceSvg(roue, wheelSvg), shapes: [shapes.wheel, shapes.hub] },
	] as Item[];
}

/** L'index fixe : un plot sur le rebord du socle, sa pointe au-dessus du bord du cercle. */
function index(): Item {
	const degrees = 52;
	const post = turned(planar(degrees, SOCLE.r - 0.7), rad(degrees), 0.6, 0.7, 0.2, 2);
	const [z0, z1] = [SOCLE.z1, HEAD.circle.z1 + 0.4];
	const tipFrom = polar(degrees, SOCLE.r - 1.2, z1);
	const tipTo = polar(degrees, HEAD.circle.r - 0.9, z1);
	return {
		name: 'head.index',
		svg: S(extrude(post, z0, z1 - z0, P), { tone: 'mid' }) + L(pathOf([at(tipFrom), at(tipTo)]), { tone: 'hi', free: 'end' }),
		shapes: [{ kind: 'extruded', name: 'head.index', ring: post, z: z0, h: z1 - z0 }],
	};
}

// --- Le dock, le rail, le disque, la carte ---------------------------------------------------

function dock(carte: Piece): Item[] {
	const outer = 14;
	const dockRing = [
		railPlane(DOCK.from, -outer),
		railPlane(DOCK.to, -outer),
		railPlane(DOCK.to, DOCK.half),
		railPlane(DOCK.from, DOCK.half),
	];
	const turntable = railPoint(CHARIOT.at, 0, DOCK.z1);
	const card = DOCK.from + 4.4;
	const housing = turned(railPlane(card, -10.5), RAIL_ANGLE, 2.4, 1.5, 0.3, 2);
	const hz: [number, number] = [DOCK.z1, DOCK.z1 + 2];
	const slot = turned(railPlane(card, -10.5), RAIL_ANGLE, 1.7, 0.3, 0.2, 2);
	const flap = turned(railPlane(card, -9.4), RAIL_ANGLE, 1.6, 0.45, 0.1, 2);
	const button = railPoint(card + 4.6, -10.2, DOCK.z1);
	const led = railPoint(card + 4.6, -12.6, DOCK.z1);
	// La carte, debout dans sa fente, dessinée en entier et découpée au ras du boîtier.
	const cardFrame = G.frameOf(railPoint(card, -10.5 + 0.25, DOCK.z1 - 2.4), mul(SIDE_DIR, -1), RAIL_DIR, [0, 0, 1]);
	const cardShape: Plane[] = [
		[-1.5, 0],
		[1.5, 0],
		[1.5, 6.8],
		[1.0, 7.6],
		[-1.5, 7.6],
	];
	const contacts = Array.from({ length: 6 }, (_, k) => {
		const x = -1.2 + k * 0.48;
		const base = add(cardFrame.o, add(mul(RAIL_DIR, x), mul(SIDE_DIR, -0.5)));
		return pathOf([at(base), at(add(base, [0, 0, 1.1]))]);
	}).join('');
	const clip = G.hullOf(
		[hz[1], hz[1] + 9].flatMap((z) => [-1.6, 1.6].flatMap((x) => [-0.1, 0.6].map((y) => at(add(railPoint(card, -10.5 + 0.25, z), add(mul(RAIL_DIR, x), mul(SIDE_DIR, -y))))))),
	);
	return [
		{
			name: 'dock.plate',
			svg: S(extrude(dockRing, DOCK.z0, DOCK.z1 - DOCK.z0, P, { bevel: 0.5 }), { tone: 'mid' }),
			shapes: [{ kind: 'extruded', name: 'dock.plate', ring: dockRing, z: DOCK.z0, h: DOCK.z1 - DOCK.z0 }],
		},
		{
			name: 'dock.turntable',
			svg: S(cylinder(turntable[0], turntable[1], 4.4, DOCK.z1, 0.6, P, 28, 0.3), { tone: 'mid', inner: L(ring(turntable[0], turntable[1], 1.2, DOCK.z1 + 0.6, P, 20), { tone: 'faint' }) }),
			shapes: [{ kind: 'cylinder', name: 'dock.turntable', c: [turntable[0], turntable[1]], r: 4.4, z: DOCK.z1, h: 0.6 }],
		},
		{
			name: 'dock.button',
			svg:
				S(cylinder(button[0], button[1], 1.7, DOCK.z1, 0.3, P, 14), { tone: 'mid' }) +
				S(cylinder(button[0], button[1], 1.1, DOCK.z1 + 0.3, 0.6, P, 14, 0.3), { tone: 'hi', crease: 'lo' }),
			shapes: [
				{ kind: 'cylinder', name: 'dock.button.ring', c: [button[0], button[1]], r: 1.7, z: DOCK.z1, h: 0.3 },
				{ kind: 'cylinder', name: 'dock.button', c: [button[0], button[1]], r: 1.1, z: DOCK.z1 + 0.3, h: 0.6 },
			],
		},
		{
			name: 'dock.led',
			svg:
				S(cylinder(led[0], led[1], 1.1, DOCK.z1, 0.3, P, 12), { tone: 'mid' }) +
				S(G.sphereOf(add(led, [0, 0, 0.6]), 0.7, P, { steps: 16 }), { tone: 'mid' }) +
				`<circle data-led="" cx="${at(add(led, [0, 0, 0.75]))[0].toFixed(1)}" cy="${at(add(led, [0, 0, 0.75]))[1].toFixed(1)}" r="0.9" style="fill:var(--anatomy-hi);stroke:none"/>`,
			shapes: [
				{ kind: 'cylinder', name: 'dock.led.ring', c: [led[0], led[1]], r: 1.1, z: DOCK.z1, h: 0.3 },
				{ kind: 'ball', name: 'dock.led', at: add(led, [0, 0, 0.6]), r: 0.7 },
			],
		},
		{
			name: 'carte.housing',
			piece: carte.id,
			svg: pieceSvg(carte, [
				S(extrude(housing, hz[0], hz[1] - hz[0], P, { bevel: 0.3 }), { tone: 'mid', inner: L(pathOf(slot.map(([x, y]) => at([x, y, hz[1]])), true), { tone: 'hi' }) }),
				S(extrude(flap, hz[1], 0.2, P), { tone: 'mid' }),
			]),
			shapes: [
				{ kind: 'extruded', name: 'carte.housing', ring: housing, z: hz[0], h: hz[1] - hz[0] },
				{ kind: 'extruded', name: 'carte.flap', ring: flap, z: hz[1], h: 0.2 },
			],
		},
		{
			name: 'carte.card',
			piece: carte.id,
			svg: pieceSvg(
				carte,
				`<g data-card=""><clipPath id="pointcloud-viewer-card"><path data-hold="" d="${pathOf(clip, true)}"/></clipPath><g clip-path="url(#pointcloud-viewer-card)">${S(G.prismOf(cardFrame, cardShape, 0, 0.5, P), {
					tone: 'hi',
					inner: L(contacts, { tone: 'mid', free: 'end' }),
				})}</g></g>`,
			),
			// Seule la partie au-dessus du boîtier est dessinée (découpe) : c'est elle qu'on enregistre.
			shapes: [{ kind: 'prism', name: 'carte.card', F: cardFrame, polygon: cardShape.map(([x, y]): Plane => [x, Math.max(y, hz[1] - cardFrame.o[2])]), s0: 0, s1: 0.5 }],
		},
	];
}

function rails(): Item[] {
	return [-1, 1].map((sign) => {
		const across = (sign * RAILS.gauge) / 2;
		const plan = [railPlane(RAILS.from, across - RAILS.half), railPlane(RAILS.to, across - RAILS.half), railPlane(RAILS.to, across + RAILS.half), railPlane(RAILS.from, across + RAILS.half)];
		return {
			name: `rail${sign}`,
			svg: S(extrude(plan, DOCK.z1, RAILS.z1 - DOCK.z1, P), { tone: 'mid' }),
			shapes: [{ kind: 'extruded', name: `rail${sign}`, ring: plan, z: DOCK.z1, h: RAILS.z1 - DOCK.z1 }],
		} as Item;
	});
}

/** Le chariot, le disque PCBK gravé et le loquet, posés au dock ou au support (`shift` du chariot). */
export function chariot(disque: Piece, progress: number, home: boolean): Item[] {
	const tray = turned(railPlane(CHARIOT.at, 0), RAIL_ANGLE, CHARIOT.half, RAILS.gauge / 2 + 1, 0.8, 3);
	const centre = railPoint(CHARIOT.at, 0, 0);
	const marks = discMarks(progress);
	// Le loquet pivote au bord du plateau du chariot : couché vers le socle au dock, vers le support après.
	const pivot = railPoint(CHARIOT.at, -RAILS.gauge / 2 - 0.2, CHARIOT.z1);
	const latch = (side: number) => pathOf([at(pivot), at(add(pivot, add(mul(RAIL_DIR, -side * 2.2), mul(SIDE_DIR, 0.3))))]);
	const shift = home ? 0 : TRAVEL;
	const latchSvg = `<path class="iso-line" data-tone="hi" data-latch="dock" d="${latch(1)}"${home ? '' : ' visibility="hidden"'}/><path class="iso-line" data-tone="hi" data-latch="support" d="${latch(-1)}"${home ? ' visibility="hidden"' : ''}/>`;
	const latchPins = dots([pivot], 0.5, 'hi');
	const discSvg = pieceSvg(disque, [
		S(cylinder(centre[0], centre[1], DISC.r, DISC.z0, DISC.z1 - DISC.z0, P, 36, 0.4), {
			tone: 'hi',
			crease: 'lo',
			inner: [
				`<path class="iso-line" data-tone="mid" data-mark="hub" d="${marks.hub}"/>`,
				`<path class="iso-line" data-tone="faint" data-mark="grooves" d="${marks.grooves}"/>`,
				`<path class="iso-line" data-tone="mid" data-mark="radii" d="${marks.radii}"/>`,
			].join(''),
		}),
		dots([[centre[0], centre[1], DISC.z1]], 0.45, 'hi'),
	]);
	const moved = (point: Point3) => add(point, mul(RAIL_DIR, shift));
	const trayAt = tray.map(([x, y]) => [x + RAIL_DIR[0] * shift, y + RAIL_DIR[1] * shift] as Plane);
	return [
		{
			name: 'chariot',
			piece: disque.id,
			svg: `<g data-chariot=""${shift ? ` transform="${translate(mul(RAIL_DIR, shift))}"` : ''}>${S(extrude(tray, CHARIOT.z0, CHARIOT.z1 - CHARIOT.z0, P, { bevel: 0.3 }), { tone: 'mid' })}${latchSvg}${latchPins}${discSvg}</g>`,
			shapes: [
				{ kind: 'extruded', name: 'chariot.tray', ring: trayAt, z: CHARIOT.z0, h: CHARIOT.z1 - CHARIOT.z0 },
				{ kind: 'cylinder', name: 'disque', c: [moved(centre)[0], moved(centre)[1]], r: DISC.r, z: DISC.z0, h: DISC.z1 - DISC.z0 },
			],
		},
	];
}
const translate = (by: Point3) => {
	const [a, b] = [at([0, 0, 0]), at(by)];
	return `translate(${(b[0] - a[0]).toFixed(2)} ${(b[1] - a[1]).toFixed(2)})`;
};

/** La pointe de gravure : un bras qui sort du socle au-dessus du disque, au dock. */
function stylus(): Item[] {
	const z = DISC.z1 + 1.2;
	const block = turned(railPlane(SOCLE.r + 0.9, -2.6), RAIL_ANGLE, 0.9, 1, 0.2, 2);
	const armFrom = railPoint(SOCLE.r + 1.8, -2.6, z);
	const armTo = railPoint(CHARIOT.at + 3, -2.6, z);
	const armFrame = G.frameOf(armFrom, RAIL_DIR, SIDE_DIR, [0, 0, 1]);
	const reach = Math.hypot(...sub(armTo, armFrom));
	const needle = G.frameOf(add(armTo, [0, 0, -0.3]), [0, 0, -1], RAIL_DIR, SIDE_DIR);
	const needleProfile = [
		[0, 0.4],
		[0.9 - 0.3 + 0.0, 0],
	];
	return [
		{
			name: 'stylus',
			svg: [
				S(extrude(block, DISC.z1 + 0.6, z + 0.6 - DISC.z1 - 0.6 + 0.3, P), { tone: 'mid' }),
				S(G.prismOf(armFrame, box(0.4, 0.3), 0, reach, P), { tone: 'mid' }),
				S(G.solidOf(needleProfile, needle, P, SMALL), { tone: 'hi' }),
			].join(''),
			shapes: [
				{ kind: 'extruded', name: 'stylus.block', ring: block, z: DISC.z1 + 0.6, h: z + 0.3 - DISC.z1 },
				{ kind: 'prism', name: 'stylus.arm', F: armFrame, polygon: box(0.4, 0.3), s0: 0, s1: reach },
				{ kind: 'solid', name: 'stylus.needle', F: needle, profile: needleProfile },
			],
		},
	];
}

/** Le câble spiralé du socle au support de carnet, avec ses deux coquilles de connecteur. */
export function cable(): { route: Route; items: Item[] } {
	const r = 0.55;
	const port = polar(62, SOCLE.r, 105.6);
	const out = unit([port[0], port[1], 0]);
	const end = railPoint(RAILS.to - 4, -4.5, DOCK.z0 + 0.8);
	const toPoint = ([x, y, z]: number[]): Point3 => [x, y, z];
	const points = rounded(
		[port, add(port, mul(out, 2.6)), polar(70, SOCLE.r + 7.4, 99), railPoint(RAILS.to - 7.8, -5, 100.2), add(end, mul(RAIL_DIR, -2.6)), end],
		2.2,
		P,
		r,
	).map(toPoint);
	const total = G.pathLength(points);
	// Les coquilles de connecteur recouvrent les deux bouts du câble.
	const gaps: [number, number][] = [
		[0, 1.6],
		[total - 1.6, total],
	];
	const pieces = coiled(points, r, P, gaps);
	const shell = (from: Point3, toward: Point3, name: string): Item => {
		const F = G.frameOf(from, toward, ...((): [Point3, Point3] => {
			const u = unit(cross([0, 0, 1], toward));
			return [u, cross(toward, u)];
		})());
		return { name, svg: S(G.disc(0, 1.6, 0.95, F, P, SMALL), { tone: 'mid' }), shapes: [{ kind: 'disc', name, F, s0: 0, s1: 1.6, r: 0.95 }] };
	};
	const items: Item[] = [
		shell(port, out, 'cable.shell0'),
		...pieces.map((piece, k) => ({ name: `cable.${k}`, svg: tubeSvg(piece, { tone: 'mid' }), shapes: [], chunk: { index: k, points: piece.points.map(toPoint) } })),
		shell(end, mul(RAIL_DIR, -1), 'cable.shell1'),
	];
	return { route: { name: 'cable', points, r, gaps }, items };
}

// --- Le faisceau -------------------------------------------------------------------------------

export function beam(angle: number, read: number) {
	const from = mirrorAt(angle);
	const to = impactAt(angle, read);
	return {
		slot: beamSlot(from, to, facingOf(angle) > 0.05),
		svg: `<g data-beam="">${wireSvg(at(from), at(to), { tone: 'mid', size: 0.9 })}</g>`,
	};
}

// --- La figure au repos ----------------------------------------------------------------------

export interface Pieces {
	carte: Piece;
	boitier: Piece;
	miroir: Piece;
	disque: Piece;
	borne: Piece;
	nuage: Piece;
	roue: Piece;
}

/** Les éléments peints, dans l'ordre, et le câble à enregistrer pour l'audit. */
export function scene(pieces: Pieces, { home = false } = {}) {
	const angle = LAST_ANGLE;
	const { screen, layers } = cloudPoints();
	const rendered = renderedPaths(screen, layers, MODES[0]);
	const cloudLayer = (layer: number) =>
		pieceSvg(pieces.nuage, [
			...rendered(layer).map((d, ink) => `<path data-ink="${ink}" style="${DOT_STYLE.ink}" opacity="${[0.3, 0.44, 0.58, 0.72, 0.86, 1][ink]}" d="${d}"/>`),
			`<path data-written="" style="${DOT_STYLE.written}" d=""/>`,
			`<path data-current="" style="${DOT_STYLE.current}" d=""/>`,
		]).replace('<g ', `<g data-cloud="${layer}" `);
	const ray = beam(angle, POINTS - 1);
	const slot = (k: number) => `<g data-slot="${k}">${ray.slot === k ? ray.svg : ''}</g>`;
	const wire = cable();
	const legs = LEG_ANGLES.map((degrees, k) => leg(degrees, k, k === 1));

	const list: (Item | string)[] = [
		halo({ x: -TILE, y: -TILE, w: TILE * 2, d: TILE * 2, r: 6 }, 0),
		...terrain(),
		...raster(),
		...station(),
		halo({ x: -16, y: -16, w: 32, d: 32, r: 16 }, GROUND),
		...LEG_ANGLES.map((degrees) => {
			const { foot } = legOf(degrees);
			return halo({ x: foot[0] - 3, y: foot[1] - 3, w: 6, d: 6, r: 3 }, GROUND);
		}),
		borne(pieces.borne),
		cloudLayer(0),
		slot(0),
		...legs[0],
		cloudLayer(1),
		...plumb(),
		cloudLayer(2),
		...legs[1],
		...supportArm(),
		cloudLayer(3),
		...legs[2],
		cloudLayer(4),
		slot(1),
		...plateau(),
		...embase(),
		socle(),
		...wire.items,
		...dock(pieces.carte),
		...rails(),
		...chariot(pieces.disque, 1, home),
		...stylus(),
		...rotor(angle, pieces.boitier, pieces.miroir, pieces.roue).flatMap((item, k) => (k === 0 ? [item, pawl()] : k === 1 ? [item, index()] : [item])),
		slot(2),
		...jalon(),
	];
	return { list, route: wire.route };
}

export function renderRest(pieces: Pieces): RestFigure {
	const { list } = scene(pieces);
	return { width: WIDTH, height: HEIGHT, body: list.map((entry) => (typeof entry === 'string' ? entry : entry.svg)).join('') };
}
