// Géométrie de la colonne de sondage, au repos : une colonne de sol en viroles boulonnées, coupée
// en écorché sur le quart tourné vers le lecteur, un carottier sur mât à deux colonnes et vis
// d'avance, un treuil, un log. Tout est précalculé ici (build et audit sous Node) ; le mouvement
// ne déplace que le train de forage et redessine les quelques pièces qui tournent.
//
// L'écorché : le quart x > 0, y > 0 est enlevé jusqu'à l'axe. Une pièce coupée montre deux
// tranches d'enveloppe (de -45° à 0° et de 90° à 135°), deux faces de coupe (plans y = 0 et
// x = 0), son dessus en trois quarts et, si elle est percée, le quart de paroi du forage que
// l'on voit entre les arêtes (180° à 270°).
import * as k from '../../vendor/anatomy/iso-kit.ts';
import type { Flat, Plan, Point3, SolidPaths } from '../../vendor/anatomy/iso-kit.ts';
import * as G from '../../vendor/anatomy/lathe.mjs';
import { tubeSvg } from '../../vendor/anatomy/tube.mjs';
import { cablePieces, fadedRibs, ribLines } from './kit.mjs';
import type { Piece, RestFigure } from '../contract.ts';
import { pieceSvg } from '../piece.ts';
import {
	BARREL,
	BORE,
	CORE_SCALE,
	boreClipAt,
	boreFloorAt,
	cableClipAt,
	CHEEK_X,
	couplingPaths,
	COUPLING_R,
	COUPLINGS,
	crankEnd,
	crankPaths,
	CRANK_Z,
	CROWN,
	DRUM,
	drumMarks,
	DRUM_R,
	HEIGHT,
	ID,
	LID,
	liveSolid,
	LOG_A,
	LOG_FACE,
	LOG_Z,
	MAST_X,
	NOTCH,
	onLog,
	pathOf,
	PLATEAU,
	POST_R,
	POST_Y,
	POSTS,
	projection as P,
	R_BOTTOM,
	R_FLANGE,
	R_LID,
	R_PLATEAU,
	R_SHELL,
	R_SOIL,
	rowZ,
	SCREW,
	SCREW_R,
	SLOT_A,
	SWIVEL_TOP,
	teethPaths,
	TUBAGE_TOP,
	WIDTH,
	WINDOW,
	xy,
} from './layout.ts';
import { BOUNDS, DEPTH, SOIL_BOTTOM, SOIL_TOP, STRATA, TOTAL_REQUESTS } from './model.ts';
import { pieces } from './pieces.ts';

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const piece = (id: string) => pieces.find((entry) => entry.id === id) as Piece;

// ---------------------------------------------------------------- formes pour l'audit

/** Une forme de l'audit du kit, décrite ici et construite par `audit.mjs` (`A[fn](...args)`). */
export interface Shape {
	fn: string;
	args: unknown[];
}
const shape = (fn: string, ...args: unknown[]): Shape => ({ fn, args });

export interface Item {
	name: string;
	svg: string;
	shapes: Shape[];
	/** Suit le train de forage (translation verticale de `-depth`). */
	ride?: boolean;
	/** Percé par le forage jusqu'à la profondeur atteinte (l'audit retire le trou à chaque pose). */
	bored?: boolean;
	route?: { points: Point3[]; radius: number; touch: string[] };
}

const up = (x = 0, y = 0) => G.frameOf([x, y, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
const AXIS = up();
/**
 * Un cylindre sur un axe quelconque, en prisme à 24 pans (20 pour une tige fine) : sous le pixel,
 * il se confond avec un tour, pour bien moins d'octets. Au-delà de 20° par pan, le prisme du kit
 * tracerait une arête à chaque pan.
 */
const rod = (s0: number, s1: number, r: number, F: ReturnType<typeof G.frameOf>, sides = r < 1.2 ? 20 : 24) =>
	G.prismOf(F, Array.from({ length: sides }, (_, index) => [r * Math.cos((index * TAU) / sides), r * Math.sin((index * TAU) / sides)]), s0, s1, P);
/** Un cylindre debout du kit, facetté tous les 4 px d'écran environ (plus léger qu'un tour). */
const cyl = (x: number, y: number, r: number, z0: number, z1: number, bevel = 0, steps = Math.max(12, Math.min(72, Math.ceil((TAU * r * G.scaleOf(P)) / 4)))) =>
	k.cylinder(x, y, r, z0, z1 - z0, P, steps, bevel);
/** Le quart enlevé, à soustraire des formes coupées. */
const notch = (z0: number, z1: number) => shape('box', [0, 0, z0 - 1], [200, 200, z1 + 1], { name: 'notch' });
const cutRing = (name: string, z0: number, z1: number, rIn: number, rOut: number, extra: Record<string, unknown> = {}) =>
	shape('ring', AXIS, z0, z1, rIn, rOut, { name, cut: [notch(z0, z1)], ...extra });
/** La moitié de la colonne derrière le plan vertical de l'axe qui fait face au lecteur. */
const behindAxis = (z0: number, z1: number) =>
	shape('orientedBox', [-100 * Math.SQRT1_2, -100 * Math.SQRT1_2, (z0 + z1) / 2], [[Math.SQRT1_2, Math.SQRT1_2, 0], [-Math.SQRT1_2, Math.SQRT1_2, 0], [0, 0, 1]], [100, 200, (z1 - z0) / 2 + 1], { name: 'behind' });
/** Le dos d'une collerette, caché par la virole du dessus et jamais dessiné (172° à 278°). */
const back = (z0: number, z1: number) =>
	shape('prism', AXIS, [[0, 0], ...[172, 225, 278].map((t) => [140 * Math.cos(t * DEG), 140 * Math.sin(t * DEG)])], z0 - 1, z1 + 1, { name: 'back' });

// ---------------------------------------------------------------- dessin

const tenth = (value: number) => Math.round(value * 10) / 10;
const polar = (r: number, t: number, z: number): Point3 => [r * Math.cos(t), r * Math.sin(t), z];
/** Écran par unité du monde. */
const PX = G.scaleOf(P);
/** Un arc horizontal, échantillonné tous les 5 px environ (la flèche reste sous 0,1 px). */
const arc = (r: number, t0: number, t1: number, z: number, least = 0): Flat[] => {
	const count = Math.max(2, Math.ceil((Math.abs(t1 - t0) * r * PX) / 5), least ? Math.ceil(Math.abs(t1 - t0) / least) : 0);
	return Array.from({ length: count + 1 }, (_, index) => xy(polar(r, t0 + ((t1 - t0) * index) / count, z)));
};
const line = (points: Point3[], tone: k.LineTone = 'lo', free?: boolean) => k.lineSvg(pathOf(points.map(xy)), { tone, free });
const fill = (d: string, shade?: number) =>
	shade === undefined ? `<path class="iso-fill" d="${d}"/>` : `<path class="iso-shade" data-shade="${shade}" d="${d}"/>`;
const topFill = (d: string) => `<path class="iso-top" d="${d}"/>`;
const edge = (d: string, tone: k.Tone = 'mid') => `<path class="iso-line iso-edge" data-tone="${tone}" d="${d}"/>`;
const group = (inner: string, extra = '') => `<g class="iso-solid"${extra}>${inner}</g>`;

/** Les deux tranches d'enveloppe d'un cylindre coupé : sombre à droite, claire à gauche. */
function slivers(r: number, z0: number, z1: number, tone: k.Tone, { top = true } = {}) {
	const right = [...arc(r, -45 * DEG, 0, z1), ...arc(r, 0, -45 * DEG, z0)];
	const left = [...arc(r, 90 * DEG, 135 * DEG, z1), ...arc(r, 135 * DEG, 90 * DEG, z0)];
	const outline = [
		pathOf(arc(r, -45 * DEG, 0, z0)),
		pathOf(arc(r, 90 * DEG, 135 * DEG, z0)),
		pathOf([xy(polar(r, -45 * DEG, z0)), xy(polar(r, -45 * DEG, z1))]),
		pathOf([xy(polar(r, 135 * DEG, z0)), xy(polar(r, 135 * DEG, z1))]),
		pathOf([xy(polar(r, 0, z0)), xy(polar(r, 0, z1))]),
		pathOf([xy(polar(r, 90 * DEG, z0)), xy(polar(r, 90 * DEG, z1))]),
		top ? pathOf(arc(r, -45 * DEG, 0, z1)) + pathOf(arc(r, 90 * DEG, 135 * DEG, z1)) : '',
	].join('');
	// Les ombres sont opaques : pas de fond papier dessous.
	return group(fill(pathOf(right, true), 0) + fill(pathOf(left, true), 3) + edge(outline, tone));
}

/** Les deux faces de coupe d'une couronne de matière, de `rIn` à `rOut`. */
const faceA = (rIn: number, rOut: number, z0: number, z1: number) =>
	pathOf([xy([rIn, 0, z0]), xy([rOut, 0, z0]), xy([rOut, 0, z1]), xy([rIn, 0, z1])], true);
const faceB = (rIn: number, rOut: number, z0: number, z1: number) =>
	pathOf([xy([0, rIn, z0]), xy([0, rOut, z0]), xy([0, rOut, z1]), xy([0, rIn, z1])], true);
/** Tons des coupes : le sol clair, l'acier plein et plus sombre, la face +y plus éclairée que la face +x. */
const SOIL_SHADE: [number, number] = [3, 2];
/** Une strate sur deux un ton plus bas, pour que les couches se lisent d'un coup d'œil. */
const SOIL_SHADE_ALT: [number, number] = [2, 1];
const STEEL_SHADE: [number, number] = [0, 0];
const cutFaces = (rIn: number, rOut: number, z0: number, z1: number, [a, b]: [number, number]) =>
	fill(faceA(rIn, rOut, z0, z1), a) + fill(faceB(rIn, rOut, z0, z1), b);

type Ranges = [number, number][];
/** Tout le dessus en trois quarts, de 90° à 360°. */
const WHOLE: Ranges = [[90, 360]];
/** Ce qu'une collerette laisse voir de son dessus autour d'une virole : le dos est caché par la virole du dessus. */
const AROUND: Ranges = [
	[90, 172],
	[278, 360],
];

/** Dessus en trois quarts, percé ou non, réduit aux plages d'angles visibles. */
function topQuarter(rIn: number, rOut: number, z: number, ranges = WHOLE) {
	return ranges
		.map(([a, b]) => {
			const outer = arc(rOut, a * DEG, b * DEG, z);
			const inner = rIn > 0 ? arc(rIn, b * DEG, a * DEG, z) : [xy([0, 0, z])];
			return pathOf([...outer, ...inner], true);
		})
		.join('');
}
const topEdges = (rIn: number, rOut: number, z: number, ranges = WHOLE, rim = true) =>
	ranges.map(([a, b]) => pathOf(arc(rOut, a * DEG, b * DEG, z)) + (rim && rIn > 0 ? pathOf(arc(rIn, a * DEG, b * DEG, z)) : '')).join('') +
	pathOf([xy([rIn, 0, z]), xy([rOut, 0, z])]) +
	pathOf([xy([0, rIn, z]), xy([0, rOut, z])]);

/** Le quart de paroi du forage visible entre les arêtes de coupe, ombré en quatre bandes. */
const BORE_BANDS: [number, number, number][] = [
	[180, 195, 0],
	[195, 225, 1],
	[225, 255, 2],
	[255, 270, 3],
];
function boreWall(z0: number, z1: number) {
	return BORE_BANDS.map(([t0, t1, shade]) => {
		const d = pathOf([...arc(BORE, t0 * DEG, t1 * DEG, z1, 2 * DEG), ...arc(BORE, t1 * DEG, t0 * DEG, z0, 2 * DEG)], true);
		return fill(d, shade);
	}).join('');
}

/** Une pièce coupée et percée : lid, plateau, tubage. */
function cutPart(rIn: number, rOut: number, z0: number, z1: number, tone: k.Tone, shades: [number, number], inner = '', { ranges = WHOLE, topIn = rIn } = {}) {
	return (
		group(boreWall(z0, z1)) +
		group(cutFaces(rIn, rOut, z0, z1, shades) + edge(pathOf([xy([rIn, 0, z0]), xy([rIn, 0, z1])]) + pathOf([xy([0, rIn, z0]), xy([0, rIn, z1])]), tone)) +
		slivers(rOut, z0, z1, tone) +
		group(topFill(topQuarter(topIn, rOut, z1, ranges)) + inner + edge(topEdges(topIn, rOut, z1, ranges, topIn === rIn), tone))
	);
}

/** Un trait sur les deux faces de coupe : de la face x = 0 (de l'extérieur vers l'axe) à la face y = 0. */
const across = (zB: number, zA: number, reach = R_SOIL, zAxis = (zA + zB) / 2): Point3[] => [
	[0, reach, zB],
	[0, 0, zAxis],
	[reach, 0, zA],
];
/** Un tracé fermé sur une face : `face` 'A' (y = 0) ou 'B' (x = 0), en coordonnées (u, z). */
const onFace = (face: 'A' | 'B', points: [number, number][]) =>
	pathOf(points.map(([u, z]) => xy(face === 'A' ? [u, 0, z] : [0, u, z])), true);
const ellipse = (face: 'A' | 'B', u: number, z: number, ru: number, rz: number, tilt = 0) =>
	onFace(
		face,
		Array.from({ length: 10 }, (_, index) => {
			const t = (index / 10) * TAU;
			const du = ru * Math.cos(t);
			const dz = rz * Math.sin(t);
			return [u + du * Math.cos(tilt) - dz * Math.sin(tilt), z + du * Math.sin(tilt) + dz * Math.cos(tilt)] as [number, number];
		}),
	);
const lens = (face: 'A' | 'B', u0: number, u1: number, z: number, h: number) =>
	onFace(face, [
		...Array.from({ length: 9 }, (_, index) => [u0 + ((u1 - u0) * index) / 8, z + h * Math.sin((Math.PI * index) / 8)] as [number, number]),
		...Array.from({ length: 7 }, (_, index) => [u1 - ((u1 - u0) * (index + 1)) / 8, z - h * 0.55 * Math.sin((Math.PI * (index + 1)) / 8)] as [number, number]),
	]);

/** Pseudo-hasard reproductible, pour les graviers. */
const seeded = (seed: number) => () => {
	seed = (seed * 16807) % 2147483647;
	return (seed - 1) / 2147483646;
};

/** Les textures de chaque strate, sur les deux faces de coupe : elles finissent sur les arêtes. */
function texture(index: number, top: number, bottom: number) {
	const h = top - bottom;
	const lo: string[] = [];
	const closed: string[] = [];
	let dots: Flat[] = [];
	switch (STRATA[index].id) {
		case 'cadastre': {
			// Un grain fin et serré.
			for (let z = bottom + 1.3; z < top - 0.6; z += 1.75)
				for (let u = 1.4 + ((z * 7) % 2.8); u < R_SOIL - 0.8; u += 2.9) dots.push(xy([u, 0, z]), xy([0, u, z]));
			break;
		}
		case 'urbanisme': {
			// Un banc de 4 lits soudés (zone, secteur, document, commune), une lentille (prescriptions)
			// et les trois formes des servitudes : nappe, veine, nodule.
			for (const z of [bottom + 6, bottom + 12, bottom + 18, bottom + 24]) lo.push(line(across(z, z), z === bottom + 24 ? 'mid' : 'lo'));
			closed.push(lens('B', 30, 50, bottom + 29, 2.6));
			closed.push(onFace('A', [[9, bottom + 37], [47, bottom + 36.2], [47.6, bottom + 37.6], [9.4, bottom + 38.6]]));
			lo.push(line([[0, R_SOIL, bottom + 44], [0, 0, bottom + 28], [R_SOIL, 0, bottom + 26.4]]));
			closed.push(ellipse('A', 26, bottom + 43.4, 2.2, 1.5, 0.3));
			break;
		}
		case 'risques': {
			// 6 veines communales d'un plan de coupe à l'autre, 6 nodules localisés près du forage.
			for (let vein = 0; vein < 6; vein++) {
				const z = bottom + 6 + vein * 10.4;
				lo.push(line([[0, R_SOIL, z + 4.2], [0, 0, z], [R_SOIL, 0, z - 3.4]]));
			}
			const spots: ['A' | 'B', number, number][] = [
				['A', 14, 10],
				['B', 16, 21],
				['A', 18, 31],
				['B', 13, 41],
				['A', 15, 52],
				['B', 19, 60],
			];
			for (const [face, u, z] of spots) closed.push(ellipse(face, u, bottom + z, 2.4, 1.6, face === 'A' ? -0.25 : 0.25));
			break;
		}
		case 'ventes': {
			// 5 lits de graviers, un par page Cerema reçue.
			const random = seeded(7);
			for (let bed = 1; bed < 5; bed++) lo.push(line(across(bottom + bed * 6, bottom + bed * 6)));
			for (let bed = 0; bed < 5; bed++)
				for (const face of ['A', 'B'] as const)
					for (let pebble = 0; pebble < 4; pebble++) {
						const u = 5 + pebble * 12 + random() * 6;
						const z = bottom + bed * 6 + 2.2 + random() * 1.6;
						closed.push(ellipse(face, u, z, 1 + random() * 0.8, 0.7 + random() * 0.4, random() - 0.5));
					}
			break;
		}
		case 'batiment': {
			// 3 assises de blocs maçonnés (BDNB, millésime, altimétrie).
			for (let course = 1; course < 3; course++) lo.push(line(across(bottom + course * 6, bottom + course * 6)));
			for (let course = 0; course < 3; course++) {
				const z0 = bottom + course * 6;
				for (let u = course % 2 ? 4.5 : 9; u < R_SOIL - 2; u += 9)
					for (const face of ['A', 'B'] as const) lo.push(line(face === 'A' ? [[u, 0, z0], [u, 0, z0 + 6]] : [[0, u, z0], [0, u, z0 + 6]]));
			}
			break;
		}
		case 'dpe': {
			// 7 lamines, de A à G.
			for (let lamina = 1; lamina < 7; lamina++) lo.push(line(across(bottom + (lamina * h) / 7, bottom + (lamina * h) / 7)));
			break;
		}
	}
	const pebbles = closed.length ? k.lineSvg(closed.join(''), { tone: 'lo' }) : '';
	return lo.join('') + pebbles + (dots.length ? k.dotsSvg(dots, { size: 0.32, tone: 'mid' }) : '');
}

/** Une virole : enveloppe en deux tranches, sol et acier en coupe, textures de sa strate. */
function viroleSvg(index: number) {
	const [top, bottom] = BOUNDS[index];
	const faces = cutFaces(0, R_SOIL, bottom, top, index % 2 ? SOIL_SHADE_ALT : SOIL_SHADE) + cutFaces(R_SOIL, R_SHELL, bottom, top, STEEL_SHADE);
	const seams = [
		pathOf([xy([R_SOIL, 0, bottom]), xy([R_SOIL, 0, top])]),
		pathOf([xy([0, R_SOIL, bottom]), xy([0, R_SOIL, top])]),
	].join('');
	const corner = pathOf([xy([0, 0, bottom]), xy([0, 0, top])]);
	// L'enveloppe va d'une bride à l'autre : ses bouts sont dans les brides, qui les entourent.
	const low = index < STRATA.length - 1 ? bottom + HALF : bottom;
	const high = index > 0 ? top - HALF : top;
	return slivers(R_SHELL, low, high, 'mid', { top: false }) + group(faces + texture(index, top, bottom) + edge(seams, 'lo') + edge(corner, 'faint'));
}

/**
 * Les formes d'une virole pour l'audit : le fût entre ses brides, et dans la hauteur des brides
 * seulement ses deux faces de coupe, seules peintes là (la bride entoure le reste).
 */
function viroleShapes(index: number): Shape[] {
	const [top, bottom] = BOUNDS[index];
	const name = `virole.${STRATA[index].id}`;
	const low = index < STRATA.length - 1 ? bottom + HALF : bottom;
	const high = index > 0 ? top - HALF : top;
	const faces = (z0: number, z1: number) => [
		shape('box', [0, -0.3, z0], [R_SHELL, 0, z1], { name }),
		shape('box', [-0.3, 0, z0], [0, R_SHELL, z1], { name }),
	];
	return [
		shape('disc', AXIS, low, high, R_SHELL, { name, cut: [notch(low, high)] }),
		...(low > bottom ? faces(bottom, low) : []),
		...(high < top ? faces(high, top) : []),
	];
}

/** Une couronne de boulons sur un dessus coupé : ceux du quart enlevé sont partis avec lui. */
const boltsOnQuarter = (r: number, z: number, count: number, ranges = WHOLE) =>
	Array.from({ length: count }, (_, index) => Math.PI / count + (index * TAU) / count)
		.filter((t) => ranges.some(([a, b]) => t >= a * DEG && t <= b * DEG))
		.map((t) => xy(polar(r, t, z)));

/** Une bride de jonction : deux demi-brides et leur joint, une couronne de boulons sur le dessus. */
const HALF = 2.5;
/**
 * Le dessus de la bride, avec ses boulons : peint avant la virole du dessus, qui en cache le dos.
 * Le dessus de la bride est une collerette autour du pied de cette virole.
 */
function flangeTopSvg(z: number) {
	const z1 = z + HALF;
	const bolts = boltsOnQuarter((R_SHELL + R_FLANGE) / 2, z1, 16, AROUND);
	return group(topFill(topQuarter(R_SHELL, R_FLANGE, z1, AROUND)) + k.dotsSvg(bolts, { size: 0.55, tone: 'hi' }) + edge(topEdges(R_SHELL, R_FLANGE, z1, AROUND, false), 'lo'));
}

/** L'avant de la bride (ses deux tranches d'enveloppe, ses coupes et son joint) : peint après la virole du dessus, qu'il entoure. */
function flangeBandSvg(z: number) {
	const z0 = z - HALF;
	const z1 = z + HALF;
	const joint = pathOf(arc(R_FLANGE, -45 * DEG, 0, z)) + pathOf(arc(R_FLANGE, 90 * DEG, 135 * DEG, z));
	return (
		slivers(R_FLANGE, z0, z1, 'lo') +
		group(
			cutFaces(R_SHELL, R_FLANGE, z0, z1, STEEL_SHADE) +
				edge(pathOf([xy([R_SHELL, 0, z0]), xy([R_SHELL, 0, z1])]) + pathOf([xy([0, R_SHELL, z0]), xy([0, R_SHELL, z1])]) + pathOf([xy([R_SHELL, 0, z1]), xy([R_FLANGE, 0, z1])]) + pathOf([xy([0, R_SHELL, z1]), xy([0, R_FLANGE, z1])]), 'lo') +
				k.lineSvg(joint, { tone: 'hi' }) +
				line([[0, R_FLANGE, z], [0, 0, z], [R_FLANGE, 0, z]], 'mid'),
		)
	);
}

// ---------------------------------------------------------------- socle

function bottomSvg() {
	const base = cyl(0, 0, R_BOTTOM, 0, SOIL_BOTTOM, 1.6, 64);
	// Les douze boulons : une rondelle cerclée et la tête en point, comme les vis du kit.
	const bolts = Array.from({ length: 12 }, (_, index) => 15 * DEG + index * 30 * DEG).map((t) => [64.2 * Math.cos(t), 64.2 * Math.sin(t)]);
	const heads =
		k.lineSvg(bolts.map(([x, y]) => k.ring(x, y, 1.9, SOIL_BOTTOM, P, 12)).join(''), { tone: 'mid' }) +
		k.dotsSvg(bolts.map(([x, y]) => xy([x, y, SOIL_BOTTOM])), { size: 0.8, tone: 'hi' });
	return k.solidSvg(base, { tone: 'lo', halo: true, inner: k.lineSvg(pathOf(arc(R_BOTTOM, -45 * DEG, 135 * DEG, 2.4)), { tone: 'faint' }) }) + heads;
}

/** Oreille de levage : patte percée, soudée sur la bride de fond, dans le plan radial. */
function lugSvg(t: number) {
	const radial: Point3 = [Math.cos(t), Math.sin(t), 0];
	const across: Point3 = [-Math.sin(t), Math.cos(t), 0];
	const F = G.frameOf([0, 0, 0], across, radial, [0, 0, 1]);
	const outline: [number, number][] = [
		[R_SHELL + 1.5, SOIL_BOTTOM],
		[R_BOTTOM - 1, SOIL_BOTTOM],
		[R_BOTTOM - 2.4, SOIL_BOTTOM + 8],
		...Array.from({ length: 7 }, (_, index) => {
			const a = (index / 6) * Math.PI;
			return [R_SHELL + 7.2 + 5.2 * Math.cos(a), SOIL_BOTTOM + 11 + 5.2 * Math.sin(a)] as [number, number];
		}),
		[R_SHELL + 2, SOIL_BOTTOM + 8],
	];
	const paths = G.prismOf(F, outline, -1, 1, P);
	const hole = G.circleOf(G.frameOf(G.add3(G.mul3(radial, R_SHELL + 7.2), [0, 0, SOIL_BOTTOM + 11]), across, radial, [0, 0, 1]), 1, 2.3, P, 24);
	return {
		svg: k.solidSvg(paths, { tone: 'lo', inner: `<path class="iso-shade" data-shade="0" d="${hole}"/>` + k.lineSvg(hole, { tone: 'mid' }) }),
		shape: shape('prism', F, outline, -1, 1, { name: `stand.lug${tenth(t)}` }),
	};
}

/** Profil du corps du robinet de purge, de la bride vers l'extérieur : col, corps tourné, embout. */
const DRAIN: [number, number][] = [
	[0, 2.6],
	[1.6, 2.6],
	[1.6, 3.9],
	[8.4, 3.9],
	[8.4, 2.4],
	[9.6, 2.4],
];

/** Robinet de purge sur le flanc de la bride de fond : corps, clé à ailettes, bec et son écrou. */
function drainSvg() {
	const t = 100 * DEG;
	const radial: Point3 = [Math.cos(t), Math.sin(t), 0];
	const z = SOIL_BOTTOM / 2;
	const F = G.frameAlong([R_BOTTOM * Math.cos(t), R_BOTTOM * Math.sin(t), z], radial);
	const body = [G.solidOf(DRAIN, F, P, { steps: 20 })];
	const top = G.pointOf(F, 5, 0, 0);
	const key = G.frameAlong([top[0], top[1], z + 3.9], [0, 0, 1]);
	const stem = cyl(top[0], top[1], 1.1, z + 3.9, z + 6.1);
	const wing = G.prismOf(G.frameOf([top[0], top[1], z + 6.1], radial, [-Math.sin(t), Math.cos(t), 0], [0, 0, 1]), [[-4.2, 0], [4.2, 0], [4.2, 1.8], [-4.2, 1.8]], -0.6, 0.6, P);
	const tip = G.pointOf(F, 8.6, 0, 0);
	const spoutF = G.frameAlong([tip[0], tip[1], z - 2.4], [0, 0, -1]);
	const nut = G.prismOf(spoutF, Array.from({ length: 6 }, (_, index) => [2.2 * Math.cos((index * Math.PI) / 3), 2.2 * Math.sin((index * Math.PI) / 3)] as [number, number]), 0, 1.6, P);
	const spout = cyl(tip[0], tip[1], 1.3, z - 6.8, z - 4);
	return {
		svg:
			k.solidSvg(spout, { tone: 'mid' }) +
			k.solidSvg(nut, { tone: 'mid' }) +
			body.map((part) => k.solidSvg(part, { tone: 'mid' })).join('') +
			k.solidSvg(stem, { tone: 'mid' }) +
			k.solidSvg(wing, { tone: 'hi' }),
		shapes: [
			shape('solid', F, DRAIN, { name: 'stand.drain' }),
			shape('disc', key, 0, 2.2, 1.1, { name: 'stand.drain.stem' }),
			shape('disc', spoutF, 0, 4.4, 2.2, { name: 'stand.drain.spout' }),
		],
	};
}

// ---------------------------------------------------------------- plateau parcellaire

/** Rue Sainte-Catherine et l'îlot de la section KJ, stylisés : rue, fonds de parcelle, limites. */
const STREET = { angle: 18 * DEG, near: -24, far: -15 };
const along = (s: number, n: number): [number, number] => {
	const c = Math.cos(STREET.angle);
	const d = Math.sin(STREET.angle);
	return [s * c - n * d, s * d + n * c];
};
/** KJ 33 : une parcelle étroite et profonde, le tubage posé dessus. */
const KJ33: [number, number][] = [
	[-11, -15],
	[13, -15],
	[14, 30],
	[-12, 31],
];
const offsetPolygon = (polygon: [number, number][], by: number): [number, number][] =>
	polygon.map((point, index) => {
		const prev = polygon[(index + polygon.length - 1) % polygon.length];
		const next = polygon[(index + 1) % polygon.length];
		const n1 = normalOf(prev, point);
		const n2 = normalOf(point, next);
		const nx = n1[0] + n2[0];
		const ny = n1[1] + n2[1];
		const scale = by / ((nx * n1[0] + ny * n1[1]) || 1);
		return [point[0] + nx * scale, point[1] + ny * scale];
	});
function normalOf(a: [number, number], b: [number, number]): [number, number] {
	const dx = b[0] - a[0];
	const dy = b[1] - a[1];
	const length = Math.hypot(dx, dy) || 1;
	return [dy / length, -dx / length];
}

/** Garde d'un segment ce qui tombe sur le plateau : hors du quart enlevé, entre le tubage et le bord. */
function onPlateau(a: [number, number], b: [number, number], rIn = 18.4, rOut = R_PLATEAU - 0.4) {
	const inside = ([x, y]: [number, number]) => {
		const r = Math.hypot(x, y);
		return r >= rIn - 1e-6 && r <= rOut + 1e-6 && !(x > 1e-6 && y > 1e-6);
	};
	const cuts = [0, 1];
	const dx = b[0] - a[0];
	const dy = b[1] - a[1];
	for (const r of [rIn, rOut]) {
		const A = dx * dx + dy * dy;
		const B = 2 * (a[0] * dx + a[1] * dy);
		const C = a[0] * a[0] + a[1] * a[1] - r * r;
		const disc = B * B - 4 * A * C;
		if (disc > 0) for (const sign of [-1, 1]) cuts.push((-B + sign * Math.sqrt(disc)) / (2 * A));
	}
	if (Math.abs(dx) > 1e-9) cuts.push(-a[0] / dx);
	if (Math.abs(dy) > 1e-9) cuts.push(-a[1] / dy);
	const sorted = cuts.filter((t) => t >= 0 && t <= 1).sort((p, q) => p - q);
	const runs: [[number, number], [number, number]][] = [];
	for (let index = 0; index < sorted.length - 1; index++) {
		const t0 = sorted[index];
		const t1 = sorted[index + 1];
		if (t1 - t0 < 1e-4) continue;
		const mid = (t0 + t1) / 2;
		if (inside([a[0] + dx * mid, a[1] + dy * mid])) runs.push([[a[0] + dx * t0, a[1] + dy * t0], [a[0] + dx * t1, a[1] + dy * t1]]);
	}
	return runs;
}

function plateauLines(z: number) {
	const segments: [[number, number], [number, number]][] = [];
	const far = 80;
	// Les deux bords de la rue, le fond des parcelles côté rue et de l'autre côté.
	for (const n of [STREET.near - 20, STREET.near, STREET.far, 31, 46]) segments.push([along(-far, n), along(far, n)]);
	// Limites entre parcelles : de la rue au fond d'îlot.
	for (const s of [-50, -41, -33, -24, 25, 34, 42, 51]) segments.push([along(s, STREET.far), along(s, 31)]);
	for (const s of [-46, -36, -27, -16, -4, 8, 19, 30, 41]) segments.push([along(s, 31), along(s, 46)]);
	for (const s of [-44, -30, -12, 6, 22, 38]) segments.push([along(s, STREET.near), along(s, STREET.near - 20)]);
	// Les côtés de KJ 33 qui sont aussi des limites voisines sont portés par son liseré.
	const lines = segments.flatMap(([a, b]) => onPlateau(a, b)).map(([a, b]) => pathOf([xy([a[0], a[1], z]), xy([b[0], b[1], z])]));
	return lines.join('');
}

function parcelGroove(z: number) {
	const outer = KJ33.map(([s, n]) => along(s, n));
	const inner = offsetPolygon(outer, 1.3);
	const paths = [outer, inner].map((polygon) =>
		polygon
			.map((point, index) => onPlateau(point, polygon[(index + 1) % polygon.length]))
			.flat()
			.map(([a, b]) => pathOf([xy([a[0], a[1], z]), xy([b[0], b[1], z])]))
			.join(''),
	);
	return `<path class="iso-line" data-tone="mid" data-mp="groove" d="${paths.join('')}"/>`;
}

// ---------------------------------------------------------------- mât

const postFrame = ([x, y]: readonly [number, number]) => up(x, y);
const POST_Z: [number, number] = [217, 556];

function consoleSvg() {
	const plan: Plan = { x: -92, y: -28, w: 34, d: 56, r: 2.5 };
	const bolts = [-20, -8, 8, 20].map((y) => xy([-62, y, 217]));
	const items: Item[] = [];
	for (const y of [26, -26]) {
		const F = G.frameOf([0, y - 1, 0], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
		const xIn = -Math.sqrt(R_LID * R_LID - y * y);
		const polygon: [number, number][] = [
			[xIn, LID[0]],
			[xIn, 210],
			[-90, 210],
		];
		items.push({
			name: `console.gusset${y}`,
			svg: k.solidSvg(G.prismOf(F, polygon, 0, 2, P), { tone: 'mid' }),
			shapes: [shape('prism', F, polygon, 0, 2, { name: `console.gusset${y}` })],
		});
	}
	items.push({
		name: 'console',
		svg: k.solidSvg(k.slabOf(plan, 210, 7, P, 6, 0.6), { tone: 'mid', inner: k.lineSvg(k.planOutline(k.insetPlan(plan, 3), 217, P, 6), { tone: 'faint' }) }) + k.dotsSvg(bolts, { size: 0.55, tone: 'hi' }),
		shapes: [shape('slab', plan, 210, 7, { name: 'console' }, 6)],
	});
	items.push({
		name: 'mast.bearing',
		svg: k.solidSvg(k.slabOf({ x: -84, y: -6, w: 12, d: 12, r: 1.5 }, 217, 6, P, 4, 0.4), { tone: 'mid' }),
		shapes: [shape('slab', { x: -84, y: -6, w: 12, d: 12, r: 1.5 }, 217, 6, { name: 'mast.bearing' }, 4)],
	});
	return items;
}

/** Colliers du log, serrés sur la colonne de mât +y. */
const LOG_COLLARS: [number, number][] = [
	[502.8, 507.2],
	[524.8, 529.2],
];
const STOPS: [number, number][] = [
	[241, 245],
	[491, 495],
];

/**
 * Les colonnes de guidage, chacune avec ses bagues de butée (et, à gauche, les colliers du log) :
 * une colonne est dessinée en tronçons entre ses bagues, pour que chaque bague l'entoure vraiment.
 */
function postsItems(): Item[] {
	const items: Item[] = [];
	const sorted = [...POSTS].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
	for (const at of sorted) {
		const F = postFrame(at);
		const rings = [
			...STOPS.map(([z0, z1]) => ({ z0, z1, r: 5.4, log: false })),
			...(at[1] === POST_Y ? LOG_COLLARS.map(([z0, z1]) => ({ z0, z1, r: 5.2, log: true })) : []),
		].sort((a, b) => a.z0 - b.z0);
		const parts: string[] = [];
		const shapes: Shape[] = [];
		let from = POST_Z[0];
		for (const ring of [...rings, { z0: POST_Z[1], z1: POST_Z[1], r: 0, log: false }]) {
			parts.push(k.solidSvg(cyl(at[0], at[1], POST_R, from, ring.z0), { tone: 'mid', inner: from === POST_Z[0] ? k.lineSvg(G.arcOf(F, from + 1.2, POST_R, P), { tone: 'faint' }) : '' }));
			shapes.push(shape('disc', F, from, ring.z0, POST_R, { name: `mast.post${at[1]}` }));
			if (ring.r) {
				const svg = k.solidSvg(cyl(at[0], at[1], ring.r, ring.z0, ring.z1), { tone: 'mid', inner: k.lineSvg(G.arcOf(F, (ring.z0 + ring.z1) / 2, ring.r, P), { tone: 'faint' }) });
				parts.push(ring.log ? pieceSvg(piece('log'), svg) : svg);
				shapes.push(shape('disc', F, ring.z0, ring.z1, ring.r, { name: ring.log ? 'log.collar' : `mast.stop${at[1]}` }));
			}
			from = ring.z1;
		}
		items.push({ name: `mast.post${at[1]}`, svg: parts.join(''), shapes });
	}
	return items;
}

/**
 * Le bout de colonne qui sort d'une bague mobile : le chariot glisse le long de la colonne, on ne
 * peut pas la couper en tronçons fixes. Ce manchon, dessiné après la bague et sans couvercle,
 * montre la colonne qui en sort ; la colonne fixe prend le relais au-dessus.
 */
function sleeve(x: number, y: number, r: number, z0: number, z1: number) {
	const paths = cyl(x, y, r, z0, z1);
	const sides = [-45, 135].map((t) => pathOf([xy([x + r * Math.cos(t * DEG), y + r * Math.sin(t * DEG), z0]), xy([x + r * Math.cos(t * DEG), y + r * Math.sin(t * DEG), z1])])).join('');
	const rim = pathOf(Array.from({ length: 13 }, (_, index) => xy([x + r * Math.cos((-45 + index * 15) * DEG), y + r * Math.sin((-45 + index * 15) * DEG), z0])));
	// Ses seules faces latérales : un fond ou un couvercle ferait une pastille sur la colonne fixe.
	return group(paths.shades.map((d, shade) => (d ? fill(d, shade) : '')).join('') + edge(sides + rim, 'mid'));
}

/** Vis trapézoïdale : ses filets (hélices visibles) glissent le long de l'axe quand elle tourne. */
function screwItem(): Item {
	const F = up(MAST_X, 0);
	const [z0, z1, r] = SCREW;
	const threads: string[] = [];
	const lead = 24;
	for (let start = z0 - lead; start < z1 + 6; start += 6) {
		const points: Flat[] = [];
		for (let t = -45; t <= 135; t += 22.5) {
			const z = start + (lead * (t + 45)) / 360;
			points.push(xy([MAST_X + r * Math.cos(t * DEG), r * Math.sin(t * DEG), z]));
		}
		threads.push(pathOf(points));
	}
	const body = cyl(MAST_X, 0, r, z0, z1);
	const clip = `<clipPath id="${ID}-screw"><path d="${body.fill}"/></clipPath>`;
	return {
		name: 'mast.screw',
		svg:
			k.solidSvg(body, { tone: 'mid' }) +
			`<defs>${clip}</defs><g clip-path="url(#${ID}-screw)"><g data-mp="thread">${k.lineSvg(threads.join(''), { tone: 'lo' })}</g></g>`,
		shapes: [shape('disc', F, z0, z1, r, { name: 'mast.screw' })],
	};
}

function crossheadItems(): Item[] {
	const head: Plan = { x: -86, y: -30, w: 16, d: 60, r: 3 };
	const nose: Plan = { x: -70, y: -18.6, w: 75.6, d: 12, r: 1.5 };
	return [
		{
			name: 'mast.crosshead',
			svg:
				k.solidSvg(k.slabOf(head, 556, 10, P, 6, 0.6), { tone: 'mid', inner: k.lineSvg(k.sideSeam(head, 561, P, 6), { tone: 'faint' }) }) +
				k.dotsSvg([xy([-78, 22, 566]), xy([-78, -22, 566])], { size: 0.6, tone: 'hi' }),
			shapes: [shape('slab', head, 556, 10, { name: 'mast.crosshead' }, 6)],
		},
		{
			name: 'mast.nose',
			svg: k.solidSvg(k.slabOf(nose, 558, 8, P, 4, 0.5), { tone: 'mid', inner: k.lineSvg(k.planOutline(k.insetPlan(nose, 2.4), 566, P, 4), { tone: 'faint' }) }),
			shapes: [shape('slab', nose, 558, 8, { name: 'mast.nose' }, 4)],
		},
	];
}

/** Poulie de tête : réa entre deux flasques, sous le nez de la traverse, au-dessus de l'axe. */
const SHEAVE = { y: -12.8, z: 540, r: 12, rim: 13.6 };
const blockOutline: [number, number][] = (() => {
	const box = { y0: -30, y1: 6, z0: 524, z1: 558, r: 5 };
	const corners: [number, number, number][] = [
		[box.y1 - box.r, box.z0 + box.r, -90],
		[box.y1 - box.r, box.z1 - box.r, 0],
		[box.y0 + box.r, box.z1 - box.r, 90],
		[box.y0 + box.r, box.z0 + box.r, 180],
	];
	return corners.flatMap(([cy, cz, start]) =>
		Array.from({ length: 5 }, (_, index) => {
			const a = (start + index * 22.5) * DEG;
			return [cy + box.r * Math.cos(a), cz + box.r * Math.sin(a)] as [number, number];
		}),
	);
})();
const cheekFrame = (x: number) => G.frameOf([x, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
const sheaveFrame = G.frameOf([0, SHEAVE.y, SHEAVE.z], [1, 0, 0], [0, 1, 0], [0, 0, 1]);

function blockItems(cable: Item[], cap: Item): Item[] {
	const back = cheekFrame(-5.6);
	const front = cheekFrame(4.2);
	const axle = G.frameOf([0, SHEAVE.y, SHEAVE.z], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
	return [
		{
			name: 'mast.block.back',
			svg: k.solidSvg(G.prismOf(back, blockOutline, 0, 1.4, P), { tone: 'mid' }),
			shapes: [shape('prism', back, blockOutline, 0, 1.4, { name: 'mast.block.back' })],
		},
		// Le réa en deux joues, de part et d'autre du câble couché dans sa gorge. Presque tout entier
		// caché par la flasque avant : seul un liseré de sa jante dépasse.
		{
			name: 'mast.sheave',
			svg: k.solidSvg(rod(-3, -0.8, SHEAVE.rim, sheaveFrame), { tone: 'mid' }),
			shapes: [shape('body', sheaveFrame, [[-3, 1.6], [-3, SHEAVE.rim], [-1.2, SHEAVE.rim], [-0.8, SHEAVE.r], [-0.8, 1.6]], { name: 'mast.sheave' })],
		},
		cap,
		...cable,
		{
			name: 'mast.sheave.front',
			svg: k.solidSvg(rod(0.8, 3, SHEAVE.rim, sheaveFrame), { tone: 'mid' }),
			shapes: [shape('body', sheaveFrame, [[0.8, 1.6], [0.8, SHEAVE.r], [1.2, SHEAVE.rim], [3, SHEAVE.rim], [3, 1.6]], { name: 'mast.sheave' })],
		},
		{
			name: 'mast.block.front',
			svg:
				k.solidSvg(G.prismOf(front, blockOutline, 0, 1.4, P), { tone: 'mid' }) +
				k.solidSvg(rod(5.6, 6.6, 2.4, axle), { tone: 'mid' }) +
				k.solidSvg(G.prismOf(G.frameOf([6.6, SHEAVE.y, SHEAVE.z], [1, 0, 0], [0, 1, 0], [0, 0, 1]), Array.from({ length: 6 }, (_, index) => [1.6 * Math.cos((index * Math.PI) / 3), 1.6 * Math.sin((index * Math.PI) / 3)] as [number, number]), 0, 1, P), { tone: 'hi' }) +
				k.dotsSvg([xy([5.6, -25.5, 553.5]), xy([5.6, 1.5, 553.5]), xy([5.6, -25.5, 528.5]), xy([5.6, 1.5, 528.5])], { size: 0.5, tone: 'hi' }),
			shapes: [
				shape('prism', front, blockOutline, 0, 1.4, { name: 'mast.block.front' }),
				shape('disc', axle, -4.2, 7.6, 1.6, { name: 'mast.axle' }),
			],
		},
	];
}

// ---------------------------------------------------------------- câble de repêchage

/** Point de tangence d'une droite issue de `p` sur un cercle du plan (y, z), côté `side`. */
function tangentFrom(p: [number, number], c: [number, number], r: number, side: 1 | -1): [number, number] {
	const dx = p[0] - c[0];
	const dy = p[1] - c[1];
	const d = Math.hypot(dx, dy);
	const a = Math.atan2(dy, dx) + side * Math.acos(r / d);
	return [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)];
}

/** Le câble : du tambour, par-dessus le réa, jusqu'au sommet de l'émerillon (qui descend de `depth`). */
export function cableRoute(depth: number, bottom = SWIVEL_TOP - depth): Point3[] {
	const wrap = SHEAVE.r + 0.8;
	const centre: [number, number] = [SHEAVE.y, SHEAVE.z];
	// Le brin montant quitte le tambour par son flanc côté colonne et prend le réa par l'arrière.
	let onDrum: [number, number] = [DRUM[0] + DRUM_R + 0.8, DRUM[1]];
	let onSheave: [number, number] = [SHEAVE.y - wrap, SHEAVE.z];
	for (let pass = 0; pass < 6; pass++) {
		onSheave = tangentFrom(onDrum, centre, wrap, -1);
		onDrum = tangentFrom(onSheave, [DRUM[0], DRUM[1]], DRUM_R + 0.8, -1);
	}
	const start = Math.atan2(onSheave[1] - centre[1], onSheave[0] - centre[0]);
	const over = Array.from({ length: 16 }, (_, index) => start + ((0 - start) * (index + 1)) / 16).map(
		(t) => [0, centre[0] + wrap * Math.cos(t), centre[1] + wrap * Math.sin(t)] as Point3,
	);
	// Le câble naît dans l'enroulement : son bout est sur le fût du tambour, sous les spires.
	const out = Math.atan2(onDrum[1] - DRUM[1], onDrum[0] - DRUM[0]);
	return [[0, DRUM[0] + DRUM_R * Math.cos(out), DRUM[1] + DRUM_R * Math.sin(out)], ...over, [0, 0, bottom]];
}

function cableItems(): Item[] {
	const route = cableRoute(DEPTH, SWIVEL_TOP - DEPTH);
	const last = route.length - 1;
	// Trois brins : les deux droits, peu échantillonnés, et l'enroulement sur le réa ; leurs raccords
	// tombent entre les flasques de la poulie, cachés par la flasque avant.
	const runs: [Point3[], number, [boolean, boolean]][] = [
		[route.slice(0, 2), 40, [true, false]],
		[route.slice(1, last), 1.6, [false, false]],
		[route.slice(last - 1), 40, [false, false]],
	];
	const svg = runs
		.flatMap(([points, spacing, caps]) => cablePieces(points, 0.8, P, { maxLength: 400, spacing, caps }))
		.map((chunk: unknown) => tubeSvg(chunk, { tone: 'mid' }))
		.join('');
	return [
		{
			name: 'cable',
			svg: `<defs><clipPath id="${ID}-cable"><path data-mp="cable-clip" clip-rule="evenodd" d="${cableClipAt(0)}"/></clipPath></defs><g clip-path="url(#${ID}-cable)">${svg}</g>`,
			shapes: [],
			route: { points: cableRoute(0), radius: 0.8, touch: ['mast.sheave', 'drum'] },
		},
	];
}

// ---------------------------------------------------------------- treuil

function winchItems(): Item[] {
	const axle = G.frameOf([0, DRUM[0], DRUM[1]], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
	const bracket: Plan = { x: -13, y: -65.4, w: 26, d: 7.4, r: 1 };
	const plate: [number, number][] = [
		[-62, 213],
		[-62, 236],
		[-74, 242],
		[-88, 238],
		[-92, 228],
		[-86, 213],
	];
	const flasque = (x: number) => G.frameOf([x, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
	const lever = G.frameAlong([11.8, DRUM[0] - 6, DRUM[1] - 4], [0.25, -0.5, 0.83]);
	const marks = drumMarks(0);
	return [
		{
			name: 'drum.bracket',
			svg: k.solidSvg(k.slabOf(bracket, 210, 3, P, 4, 0.4), { tone: 'lo' }) + k.dotsSvg([xy([-9, -61.7, 213]), xy([9, -61.7, 213])], { size: 0.5, tone: 'hi' }),
			shapes: [shape('slab', bracket, 210, 3, { name: 'drum.bracket' }, 4)],
		},
		{
			name: 'drum.flasque.back',
			svg: k.solidSvg(G.prismOf(flasque(-11.4), plate, 0, 1.4, P), { tone: 'mid' }),
			shapes: [shape('prism', flasque(-11.4), plate, 0, 1.4, { name: 'drum.flasque' })],
		},
		{
			name: 'drum',
			svg:
				k.solidSvg(rod(-CHEEK_X - 1.4, -CHEEK_X, 11.4, axle), { tone: 'mid' }) +
				k.solidSvg(rod(-CHEEK_X, CHEEK_X, DRUM_R, axle), {
					tone: 'mid',
					inner: k.lineSvg(
						Array.from({ length: 9 }, (_, index) => G.arcOf(G.frameOf([-CHEEK_X + 0.9 + index * 1.9, DRUM[0], DRUM[1]], [1, 0, 0], [0, 1, 0], [0, 0, 1]), 0, DRUM_R + 0.6, P)).join(''),
						{ tone: 'lo' },
					),
				}) +
				k.solidSvg(rod(CHEEK_X, CHEEK_X + 1.4, 11.4, axle), { tone: 'mid' }) +
				`<g class="iso-dots" data-tone="hi" data-mp="drum">${marks.map(([x, y]) => `<circle cx="${tenth(x)}" cy="${tenth(y)}" r="0.6"/>`).join('')}</g>`,
			shapes: [
				shape('disc', axle, -CHEEK_X - 1.4, -CHEEK_X, 11.4, { name: 'drum' }),
				shape('disc', axle, -CHEEK_X, CHEEK_X, DRUM_R, { name: 'drum' }),
				shape('disc', axle, CHEEK_X, CHEEK_X + 1.4, 11.4, { name: 'drum' }),
			],
		},
		{
			// La flasque avant porte le bout d'axe et le levier de frein du treuil.
			name: 'drum.flasque.front',
			svg:
				k.solidSvg(G.prismOf(flasque(10), plate, 0, 1.4, P), { tone: 'mid' }) +
				k.solidSvg(rod(11.4, 12.6, 2.2, axle), { tone: 'mid' }) +
				k.dotsSvg([xy([11.4, -64, 216]), xy([11.4, -84, 216])], { size: 0.5, tone: 'hi' }) +
				k.solidSvg(rod(0, 14, 0.9, lever), { tone: 'mid' }) +
				k.solidSvg(G.sphereOf(G.pointOf(lever, 15.4, 0, 0), 1.6, P, { steps: 20 }), { tone: 'hi' }),
			shapes: [
				shape('prism', flasque(10), plate, 0, 1.4, { name: 'drum.flasque' }),
				shape('disc', axle, 10, 12.6, 2.2, { name: 'drum.axle' }),
				shape('disc', lever, 0, 14, 0.9, { name: 'drum.brake' }),
				shape('ball', G.pointOf(lever, 15.4, 0, 0), 1.6, { name: 'drum.brake' }),
			],
		},
	];
}

// ---------------------------------------------------------------- log de sondage

function logItems(): Item[] {
	const [zb, zt] = LOG_Z;
	const [a0, a1] = LOG_A;
	const plateRing = (n0: number, n1: number, aa0: number, aa1: number) =>
		[
			[aa0, n0],
			[aa1, n0],
			[aa1, n1],
			[aa0, n1],
		].map(([a, n]) => onLog(a, n, 0)).map(([x, y]) => [x, y] as [number, number]);
	const plate = plateRing(-LOG_FACE, LOG_FACE, a0, a1);
	const face = (a: number, z: number) => xy(onLog(a, LOG_FACE, z));
	const rows: string[] = [];
	const ticks: string[] = [];
	const stops: Flat[] = [];
	for (let row = 0; row < STRATA.length; row++) {
		const z = rowZ(row);
		const slot = [
			[SLOT_A - 2.4, z - 1.1],
			[SLOT_A + 3 * NOTCH + 2.4, z - 1.1],
			[SLOT_A + 3 * NOTCH + 2.4, z + 1.1],
			[SLOT_A - 2.4, z + 1.1],
		].map(([a, zz]) => face(a, zz));
		rows.push(pathOf(slot, true));
		for (let notchIndex = 1; notchIndex <= 3; notchIndex++) {
			const a = SLOT_A + notchIndex * NOTCH;
			ticks.push(pathOf([face(a, z + 1.1), face(a, z + (notchIndex === 3 ? 3.4 : 2.4))]));
		}
		stops.push(face(a0 + 3.2, z));
	}
	const sliders = STRATA.map((_, row) => {
		const z = rowZ(row);
		const ring = plateRing(LOG_FACE, LOG_FACE + 1, SLOT_A - 1.3, SLOT_A + 1.3);
		return `<g data-mp="slider" data-row="${row}">${k.solidSvg(k.extrude(ring, z - 1.8, 3.6, P), { tone: 'hi' })}</g>`;
	});
	const lampAt = onLog(a1 - 4.4, LOG_FACE, zt - 4);
	const lampF = G.frameAlong(lampAt, [Math.SQRT1_2, Math.SQRT1_2, 0]);
	// Les pattes des colliers : du collier (rayon 5,2) jusque dans le chant de la plaque.
	const tab = plateRing(-1, 1, -4.9, a1 - 0.1);
	const tabs = [505, 527].map((z) => k.solidSvg(k.extrude(tab, z - 1, 2, P), { tone: 'mid' }));
	return [
		{
			name: 'log.tabs',
			svg: tabs.join(''),
			shapes: [505, 527].map((z) => shape('extruded', tab, z - 1, 2, { name: 'log.tab' })),
		},
		{
			name: 'log',
			svg:
				k.solidSvg(k.extrude(plate, zb, zt - zb, P), {
					tone: 'hi',
					inner: k.lineSvg(pathOf([face(a0 + 1.6, zb + 1.6), face(a1 - 1.6, zb + 1.6), face(a1 - 1.6, zt - 1.6), face(a0 + 1.6, zt - 1.6)], true), { tone: 'faint' }),
				}) +
				k.lineSvg(rows.join(''), { tone: 'mid' }) +
				k.lineSvg(ticks.join(''), { tone: 'lo' }) +
				k.dotsSvg(stops, { size: 0.55, tone: 'mid' }) +
				k.dotsSvg([face(a0 + 1.8, zt - 1.8), face(a1 - 1.8, zt - 1.8), face(a0 + 1.8, zb + 1.8), face(a1 - 1.8, zb + 1.8)], { size: 0.5, tone: 'hi' }) +
				sliders.join('') +
				k.solidSvg(rod(0, 0.8, 2.4, lampF), { tone: 'mid' }) +
				`<g data-mp="lamp">${k.solidSvg(G.sphereOf(G.pointOf(lampF, 1.4, 0, 0), 1.6, P, { steps: 20 }), { tone: 'mid' })}</g>`,
			shapes: [
				shape('extruded', plate, zb, zt - zb, { name: 'log' }),
				shape('disc', lampF, 0, 0.8, 2.4, { name: 'log.lamp' }),
				shape('ball', G.pointOf(lampF, 1.4, 0, 0), 1.6, { name: 'log.lamp' }),
			],
		},
	];
}

// ---------------------------------------------------------------- train de forage (mobile)

const RODS: [number, number][] = [
	[294, 342],
	[349, 397],
	[404, 452],
];
const ROD_R = 3.4;

/** Ce que l'écorché laisse voir du train de forage : au-dessus du tubage, et la bande ouverte entre les arêtes. */
function drillClip() {
	const lower = (t0: number, t1: number) => arc(BORE, t0 * DEG, t1 * DEG, TUBAGE_TOP, 3 * DEG);
	const [, yc] = xy([0, 0, TUBAGE_TOP]);
	const left = lower(135, 90);
	const right = lower(0, -45);
	const bottom = HEIGHT + 40;
	const d = pathOf(
		[
			[-40, -40],
			[WIDTH + 40, -40],
			[WIDTH + 40, yc],
			...right.reverse(),
			[xy([BORE, 0, 0])[0], bottom],
			[xy([0, BORE, 0])[0], bottom],
			...left,
			[-40, yc],
		],
		true,
	);
	return `<clipPath id="${ID}-drill"><path d="${d}"/></clipPath>`;
}

/** Carotte : six bandes vues par la fenêtre du carottier, la croûte en haut ; elle monte en se formant. */
function coreSvg() {
	const r = 6.2;
	const t0 = 6 * DEG;
	const t1 = 84 * DEG;
	let top = WINDOW[1] - 4;
	const bands = STRATA.map((stratum, index) => {
		const z1 = top;
		const z0 = top - stratum.requests * CORE_SCALE;
		top = z0;
		const band = (z: number) => arc(r, t0, t1, z, 13 * DEG);
		const d = pathOf([...band(z1), ...band(z0).reverse()], true);
		const shade = [3, 1, 2, 3, 1, 2][index];
		// Un rappel de la texture de la strate : les veines des risques, un lit pour l'urbanisme et les ventes.
		const marks = index === 2 ? pathOf(band((z0 + z1) / 2 + 2)) + pathOf(band((z0 + z1) / 2 - 2.5)) : index === 1 || index === 3 ? pathOf(band((z0 + z1) / 2)) : '';
		return `<g data-band="${index}">${fill(d, shade)}${marks ? k.lineSvg(marks, { tone: 'lo' }) : ''}${k.lineSvg(pathOf(band(z0)), { tone: 'mid' })}</g>`;
	});
	return bands.join('');
}

function drillItem(): Item {
	const tube = cyl(0, 0, 8, BARREL[0], BARREL[1]);
	const crown = cyl(0, 0, 9.6, CROWN[1], BARREL[0], 0.4);
	// Raccord du carottier aux tiges : un épaulement chanfreiné.
	const sub = cyl(0, 0, 5.4, BARREL[1], BARREL[1] + 6, 0.8);
	const windowOutline = pathOf([...arc(8, 8 * DEG, 82 * DEG, WINDOW[1], 4 * DEG), ...arc(8, 82 * DEG, 8 * DEG, WINDOW[0], 4 * DEG)], true);
	const recess = fill(windowOutline, 0);
	const core = `<defs><clipPath id="${ID}-window"><path d="${windowOutline}"/></clipPath></defs><g clip-path="url(#${ID}-window)">${recess}<g data-mp="core" transform="${k.translateAlong(P, [0, 0, -CORE_SCALE * TOTAL_REQUESTS])}">${coreSvg()}</g></g>`;
	const teeth = teethPaths(0).map((paths, index) => liveSolid(paths, `data-mp="tooth" data-index="${index}"`, 'hi'));
	const rods = RODS.map(([z0, z1]) => k.solidSvg(cyl(0, 0, ROD_R, z0, z1), { tone: 'mid' }));
	const couplings = COUPLINGS.map((_, index) => liveSolid(couplingPaths(index, 0), `data-mp="coupling" data-index="${index}"`, 'mid'));
	const barrel = pieceSvg(piece('carottier'), [
		k.solidSvg(tube, {
			tone: 'hi',
			inner: k.lineSvg(G.arcOf(AXIS, BARREL[1] - 4, 8, P) + G.arcOf(AXIS, BARREL[0] + 2, 8, P), { tone: 'faint' }),
		}),
		core,
		k.lineSvg(windowOutline, { tone: 'hi' }),
		k.solidSvg(sub, { tone: 'hi' }),
	]);
	const crownSvg = pieceSvg(piece('couronne'), [...teeth, k.solidSvg(crown, { tone: 'hi' })]);
	const string = [crownSvg, barrel, rods[0], couplings[0], rods[1], couplings[1], rods[2]].join('');
	return {
		name: 'drill',
		ride: true,
		svg: `<defs>${drillClip()}</defs><g clip-path="url(#${ID}-drill)"><g data-mp="ride">${string}</g></g>`,
		shapes: [
			shape('disc', AXIS, CROWN[0], BARREL[0], 9.6, { name: 'drill.crown' }),
			shape('disc', AXIS, BARREL[0], BARREL[1], 8, { name: 'drill.barrel' }),
			shape('disc', AXIS, BARREL[1], BARREL[1] + 6, 5.4, { name: 'drill.sub' }),
			...RODS.map(([z0, z1]) => shape('disc', AXIS, z0, z1, ROD_R, { name: 'drill.rod' })),
			...COUPLINGS.map(([z0, z1]) => shape('disc', AXIS, z0, z1, COUPLING_R, { name: 'drill.coupling' })),
		],
	};
}

/** Tête de forage et chariot : ils descendent avec le train. */
function headItems(): Item[] {
	const carriage: Plan = { x: -86, y: -17, w: 16, d: 34, r: 2 };
	const arm: Plan = { x: -70.4, y: -6, w: 59.6, d: 12, r: 1.2 };
	const box: Plan = { x: -11, y: -11, w: 22, d: 22, r: 2.5 };
	const ride = (svg: string) => `<g data-mp="ride">${svg}</g>`;
	const bushings = [...POSTS]
		.sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P))
		.flatMap((at) =>
			[
				[462, 470],
				[482, 490],
			].map(
				([z0, z1]) =>
					k.solidSvg(cyl(at[0], at[1], 6.2, z0, z1), { tone: 'mid', inner: k.lineSvg(G.arcOf(postFrame(at), (z0 + z1) / 2, 6.2, P), { tone: 'faint' }) }) +
					sleeve(at[0], at[1], POST_R, z1, z1 + 3),
			),
		);
	// La vis sort du chariot par un collier racleur.
	const wiper = k.solidSvg(cyl(MAST_X, 0, 4.6, 490, 491.4), { tone: 'mid' }) + sleeve(MAST_X, 0, SCREW_R, 491.4, 494);
	// La lumière du chariot : on y voit l'écrou d'avance en bronze.
	const win = [
		[-4.5, 464.5],
		[4.5, 464.5],
		[4.5, 472.5],
		[-4.5, 472.5],
	].map(([y, z]) => xy([-70, y, z]));
	const hex = Array.from({ length: 6 }, (_, index) => [MAST_X + 5 * Math.cos((index * Math.PI) / 3 + Math.PI / 6), 5 * Math.sin((index * Math.PI) / 3 + Math.PI / 6)] as [number, number]);
	const nut = k.extrude(hex, 465, 7, P);
	const windowSvg = `<defs><clipPath id="${ID}-nut"><path d="${pathOf(win, true)}"/></clipPath></defs>${fill(pathOf(win, true), 0)}<g clip-path="url(#${ID}-nut)">${k.solidSvg(nut, { tone: 'mid' })}</g>${k.lineSvg(pathOf(win, true), { tone: 'mid' })}`;
	const lockF = G.frameAlong([-70, 11.5, 481], [1, 0, 0]);
	const lock = k.solidSvg(rod(0, 2, 1.3, lockF), { tone: 'mid' }) + k.solidSvg(rod(2, 5, 2.6, lockF), { tone: 'mid', inner: k.fadedSvg(fadedRibs(lockF, 2, 5, 2.6, 18, P), { tone: 'lo' }) });
	const chuck = [cyl(0, 0, 6, 452, 453.6), cyl(0, 0, 9, 453.6, 464, 0.5), cyl(0, 0, 7.4, 464, 466)];
	const motor = cyl(0, 0, 11, 486, 508);
	const fins = k.fadedSvg(fadedRibs(AXIS, 488, 506, 11, 22, P, { seams: true }), { tone: 'lo' });
	// Levier d'embrayage : un bossage d'équerre sur le carter, puis la tige inclinée et sa boule.
	const boss = G.frameOf([0, 11, 476], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
	const lever = G.frameAlong([0, 12.8, 476], [0.15, 0.45, 0.88]);
	return [
		{
			name: 'carriage',
			ride: true,
			svg: ride(
				k.solidSvg(k.slabOf(carriage, 462, 28, P, 4, 0.6), { tone: 'mid', inner: k.lineSvg(k.sideSeam(carriage, 476, P, 4), { tone: 'faint' }) }) +
					windowSvg +
					bushings.join('') +
					wiper +
					lock,
			),
			shapes: [
				shape('slab', carriage, 462, 28, { name: 'carriage', cut: [shape('disc', up(MAST_X, 0), 460, 492, SCREW_R + 0.2)] }, 4),
				shape('ring', up(MAST_X, 0), 490, 491.4, SCREW_R, 4.6, { name: 'carriage.wiper' }),
				...POSTS.flatMap((at) => [shape('ring', postFrame(at), 462, 470, POST_R, 6.2, { name: 'carriage.bushing' }), shape('ring', postFrame(at), 482, 490, POST_R, 6.2, { name: 'carriage.bushing' })]),
			],
		},
		{
			name: 'arm',
			ride: true,
			svg: ride(k.solidSvg(k.slabOf(arm, 476, 10, P, 4, 0.5), { tone: 'mid', inner: k.lineSvg(k.planOutline(k.insetPlan(arm, 2.4), 486, P, 4), { tone: 'faint' }) })),
			shapes: [shape('slab', arm, 476, 10, { name: 'arm' }, 4)],
		},
		{
			name: 'head',
			ride: true,
			svg: ride(
				k.solidSvg(chuck[0], { tone: 'mid' }) +
					k.solidSvg(chuck[1], { tone: 'mid', inner: k.lineSvg(ribLines(AXIS, 453.6, 464, 9, 3, P, { least: 0.15, phase: 0.4 }), { tone: 'lo' }) }) +
					k.solidSvg(chuck[2], { tone: 'mid' }) +
					k.solidSvg(k.slabOf(box, 466, 20, P, 4, 0.8), { tone: 'mid', inner: k.lineSvg(k.sideSeam(box, 474, P, 4), { tone: 'faint' }) }) +
					k.dotsSvg(k.corners(box, 3).map(([x, y]) => xy([x, y, 486])), { size: 0.5, tone: 'hi' }) +
					k.solidSvg(rod(0, 2.4, 2.2, boss), { tone: 'mid' }) +
					k.solidSvg(rod(0, 11, 0.8, lever), { tone: 'mid' }) +
					k.solidSvg(G.sphereOf(G.pointOf(lever, 12.4, 0, 0), 1.9, P, { steps: 20 }), { tone: 'hi' }) +
					k.solidSvg(motor, { tone: 'mid', inner: fins }) +
					k.solidSvg(cyl(0, 0, 8.6, 508, 510), { tone: 'mid' }) +
					k.solidSvg(cyl(0, 0, 4.6, 510, 515), { tone: 'mid' }) +
					k.solidSvg(cyl(0, 0, 2.6, 515, 517), { tone: 'mid' }),
			),
			shapes: [
				shape('solid', AXIS, [[452, 6], [453.6, 6], [453.6, 9], [464, 9], [464, 7.4], [466, 7.4]], { name: 'head.chuck' }),
				shape('slab', box, 466, 20, { name: 'head.gearbox' }, 4),
				shape('disc', boss, 0, 2.4, 2.2, { name: 'head.lever' }),
				shape('disc', lever, 0, 11, 0.8, { name: 'head.lever' }),
				shape('ball', G.pointOf(lever, 12.4, 0, 0), 1.9, { name: 'head.lever' }),
				shape('disc', AXIS, 486, 510, 11, { name: 'head.motor' }),
				shape('disc', AXIS, 510, 517, 4.6, { name: 'head.swivel' }),
			],
		},
	];
}

/** Le chapeau de l'émerillon, où entre le câble : dessiné après le câble pour en couvrir le bout. */
function swivelCapItem(): Item {
	const cap = cyl(0, 0, 3.4, 517, SWIVEL_TOP);
	return {
		name: 'swivel.cap',
		ride: true,
		svg: `<g data-mp="ride">${k.solidSvg(cap, { tone: 'mid', inner: `<path class="iso-shade" data-shade="0" d="${G.circleOf(AXIS, SWIVEL_TOP, 1.2, P, 16)}"/>` })}</g>`,
		shapes: [shape('disc', AXIS, 517, SWIVEL_TOP, 3.4, { name: 'swivel.cap' })],
	};
}

/** La manivelle : moyeu fixe, bras et poignée moletée qui tournent avec la vis. */
function crankItem(): Item {
	const F = up(MAST_X, 0);
	const knob = (attrs: string) => {
		const end = crankEnd(0);
		const kf = up(end[0], end[1]);
		return `<g data-mp="knob" ${attrs}>${k.solidSvg(cyl(end[0], end[1], 2.4, CRANK_Z[1], CRANK_Z[1] + 9.6), { tone: 'mid', inner: k.fadedSvg(fadedRibs(kf, CRANK_Z[1] + 1.2, CRANK_Z[1] + 9.6, 2.4, 20, P, { seams: 'first' }), { tone: 'lo' }) })}</g>`;
	};
	return {
		name: 'crank',
		svg:
			knob('data-slot="back" visibility="hidden"') +
			k.solidSvg(cyl(MAST_X, 0, 4.2, 566, CRANK_Z[0]), { tone: 'mid' }) +
			liveSolid(crankPaths(0), 'data-mp="crank"', 'mid') +
			k.dotsSvg([xy([MAST_X, 0, CRANK_Z[1]])], { size: 0.7, tone: 'hi' }) +
			knob('data-slot="front"'),
		shapes: [shape('disc', F, 566, CRANK_Z[0], 4.2, { name: 'crank.hub' }), shape('extruded', [[MAST_X - 1.6, -2.2], [MAST_X + 22.2, -1.8], [MAST_X + 22.2, 1.8], [MAST_X - 1.6, 2.2]], CRANK_Z[0], CRANK_Z[1] - CRANK_Z[0], { name: 'crank.arm' })],
	};
}

// ---------------------------------------------------------------- forage (dynamique)

/** La paroi du forage et son fond : dessinées sur toute la hauteur, découpées à la profondeur atteinte. */
function boreItem(): Item {
	const interfaces = BOUNDS.slice(0, -1).map(([, bottom]) => pathOf(arc(BORE, 180 * DEG, 270 * DEG, bottom, 3 * DEG))).join('');
	return {
		name: 'bore',
		svg:
			`<defs><clipPath id="${ID}-bore"><path data-mp="bore-clip" d="${boreClipAt(SOIL_TOP, SOIL_TOP)}"/></clipPath></defs>` +
			`<g clip-path="url(#${ID}-bore)">${group(boreWall(SOIL_BOTTOM, SOIL_TOP))}${k.lineSvg(interfaces, { tone: 'lo' })}` +
			`<g class="iso-solid" data-mp="floor" transform="${k.translateAlong(P, [0, 0, SOIL_TOP])}">${topFill(boreFloorAt(0))}${edge(pathOf([xy([BORE, 0, 0]), xy([0, 0, 0]), xy([0, BORE, 0])]), 'lo')}</g></g>`,
		shapes: [],
	};
}

// ---------------------------------------------------------------- assemblage

export function items(): Item[] {
	const list: Item[] = [];
	const lugs = [140 * DEG, -50 * DEG].map(lugSvg);
	const drain = drainSvg();
	list.push({
		name: 'stand.base',
		svg: bottomSvg(),
		shapes: [shape('disc', AXIS, 0, SOIL_BOTTOM, R_BOTTOM, { name: 'stand.base' })],
	});
	list.push({ name: 'stand.lugs', svg: lugs.map((lug) => lug.svg).join(''), shapes: lugs.map((lug) => lug.shape) });
	list.push({ name: 'stand.drain', svg: drain.svg, shapes: drain.shapes });

	// Les viroles, du DPE à la croûte, chacune suivie de sa bride de jonction.
	// Chaque bride de jonction est peinte en deux temps autour de la virole qu'elle porte : son
	// dessus avant elle, son avant après elle. On ne peint jamais ce qu'elle a de caché.
	let band: Item | null = null;
	for (let index = STRATA.length - 1; index >= 0; index--) {
		const [top] = BOUNDS[index];
		const id = index === 0 ? 'croute' : 'viroles';
		list.push({
			name: `virole.${STRATA[index].id}`,
			bored: true,
			svg: pieceSvg(piece(id), viroleSvg(index)),
			shapes: viroleShapes(index),
		});
		if (band) list.push(band);
		band = null;
		if (index > 0) {
			const [z0, z1] = [top - HALF, top + HALF];
			list.push({
				name: `flange.${index}.top`,
				svg: pieceSvg(piece('viroles'), flangeTopSvg(top)),
				shapes: [shape('ring', AXIS, z1 - 0.4, z1, R_SHELL, R_FLANGE, { name: `flange.${index}`, cut: [notch(z0, z1), back(z0, z1)] })],
			});
			band = {
				name: `flange.${index}`,
				svg: pieceSvg(piece('viroles'), flangeBandSvg(top)),
				shapes: [shape('ring', AXIS, z0, z1, R_SHELL, R_FLANGE, { name: `flange.${index}`, cut: [notch(z0, z1), behindAxis(z0, z1)] })],
			};
		}
	}

	// Bride de tête, console du mât, treuil, plateau, tubage.
	// Le plateau est mince : le dos de la collerette de la bride de tête reste visible derrière lui.
	const lidBolts = boltsOnQuarter(61.2, LID[1], 16);
	const [gussetA, gussetB, ...mastBase] = consoleSvg();
	list.push(gussetA, gussetB);
	list.push({
		name: 'lid',
		svg: pieceSvg(piece('viroles'), cutPart(BORE, R_LID, LID[0], LID[1], 'lo', STEEL_SHADE, k.dotsSvg(lidBolts, { size: 0.6, tone: 'hi' }), { topIn: R_PLATEAU })),
		shapes: [cutRing('lid', LID[0], LID[1], BORE, R_LID)],
	});
	list.push(...mastBase);
	list.push(...winchItems());
	const plateauInner = k.lineSvg(plateauLines(PLATEAU[1]), { tone: 'lo' }) + parcelGroove(PLATEAU[1]);
	list.push({
		name: 'plateau',
		svg: pieceSvg(piece('plateau'), cutPart(BORE, R_PLATEAU, PLATEAU[0], PLATEAU[1], 'hi', [3, 2], plateauInner)),
		shapes: [cutRing('plateau', PLATEAU[0], PLATEAU[1], BORE, R_PLATEAU)],
	});
	const tubageBolts = [150, 210, 260, 320].map((t) => xy(polar(16.2, t * DEG, PLATEAU[1] + 2)));
	list.push({
		name: 'tubage',
		svg: pieceSvg(piece('tubage'), cutPart(BORE, 18, PLATEAU[1], PLATEAU[1] + 2, 'mid', STEEL_SHADE, k.dotsSvg(tubageBolts, { size: 0.5, tone: 'hi' })) + cutPart(BORE, 14, PLATEAU[1] + 2, TUBAGE_TOP, 'mid', STEEL_SHADE)),
		shapes: [cutRing('tubage', PLATEAU[1], PLATEAU[1] + 2, BORE, 18), cutRing('tubage', PLATEAU[1] + 2, TUBAGE_TOP, BORE, 14)],
	});
	list.push(boreItem());

	// Le mât et ce qu'il porte.
	list.push(...postsItems());
	list.push(screwItem());
	const [carriage, arm, head] = headItems();
	list.push(carriage, arm);
	list.push(drillItem());
	list.push(head);
	list.push(...blockItems(cableItems(), swivelCapItem()));
	list.push(...crossheadItems());
	list.push(crankItem());
	for (const item of logItems()) list.push({ ...item, svg: pieceSvg(piece('log'), item.svg) });
	return list;
}

export function renderRest(): RestFigure {
	return { width: WIDTH, height: HEIGHT, body: items().map((item) => item.svg).join('') };
}

export type { SolidPaths };
