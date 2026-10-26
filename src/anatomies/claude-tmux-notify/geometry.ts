// Géométrie du tableau d'annonciateur, calculée au build (et sous Node pour l'audit) : chaque
// élément dessiné porte ses formes vraies, que l'audit du kit enregistre pour régler l'ordre de
// peinture d'après la profondeur réelle et pour tout vérifier (`audit.mjs`). Le mouvement ne
// l'importe pas : il relit `layout.ts`.
import {
	cylinder,
	fitProjection,
	depthOf,
	dotsSvg,
	fadedSvg,
	iso,
	knurl,
	lineSvg,
	pathOf,
	sideArc,
	sideSeam,
	slabOf,
	solidSvg,
	type Flat,
	type Plan,
	type Point3,
	type SolidPaths,
	type Tone,
} from '../../vendor/anatomy/iso-kit.ts';
import { circleOf, disc as discOf, frameAlong, ringBand, solidOf, sphereOf } from '../../vendor/anatomy/lathe.mjs';
import { tubeSvg } from '../../vendor/anatomy/tube.mjs';
import { boltsOf, filletOn, knurlOf, tubeOf } from './kit.mjs';
import type { RestFigure } from '../contract.ts';
import { pieceSvg } from '../piece.ts';
import {
	BOARD,
	BOARD_TOP,
	BODY,
	CORD_R,
	CORD_RINGS,
	CORD_SPACING,
	DANCER,
	DANCER_SPRING,
	EXTREMES,
	EYELET,
	FIT,
	FLAP,
	FLAP_BODY,
	FLAP_DOWN,
	FLAP_TAB,
	HOOK_LIFT,
	hookRingOf,
	turnUV,
	tapeHoles,
	FRONT,
	GUIDE,
	guidePaths,
	guideSpans,
	ropeSvg,
	HEIGHT,
	JACK_Y,
	LANE_Y,
	PANEL,
	PIVOTS,
	PLATINE,
	PLUG,
	R1,
	R2,
	TAPE,
	WIDTH,
	WIN,
	col,
	coilZ,
	cordRoute,
	dancerCoil,
	dancerZ,
	facing,
	flapAxisZ,
	flapFrame,
	flapPaths,
	jackZ,
	loopPaths,
	loopRuns,
	plateOf,
	projection as P,
	rect,
	windowBottom,
	windowTop,
	type Frame,
	type UV,
} from './layout.ts';
import { pieceOf, START_SIZE, WINDOWS } from './model.ts';
import { settledKeys } from './order.mjs';

type Meta = Record<string, unknown>;
export type Shape =
	| { kind: 'slab'; name: string; plan: Plan; z: number; h: number; steps: number; meta?: Meta }
	| { kind: 'prism'; name: string; F: Frame; poly: UV[]; s0: number; s1: number; meta?: Meta }
	| { kind: 'disc'; name: string; F: Frame; s0: number; s1: number; r: number; meta?: Meta }
	| { kind: 'ring'; name: string; F: Frame; s0: number; s1: number; rIn: number; rOut: number; meta?: Meta }
	| { kind: 'solid'; name: string; F: Frame; profile: number[][]; meta?: Meta }
	| { kind: 'ball'; name: string; at: Point3; r: number; meta?: Meta }
	| { kind: 'tube'; name: string; points: Point3[]; r?: number; radii?: number[]; meta?: Meta };

export interface Draw {
	name: string;
	piece?: string;
	at: Point3;
	bias?: number;
	svg: string;
	shapes: Shape[];
	route?: string;
	chunk?: number;
}
export interface Route {
	name: string;
	points: Point3[];
	r: number;
	options: Meta;
}
export interface Scene {
	draws: Draw[];
	routes: Route[];
}

const X: Point3 = [1, 0, 0];
const Y: Point3 = [0, 1, 0];
const Z: Point3 = [0, 0, 1];
const along = (o: Point3, a: Point3) => frameAlong(o, a) as Frame;
const onFace = (x: number, points: UV[]) => pathOf(points.map(([y, z]) => iso([x, y, z], P)));
const flat = (point: Point3): Flat => iso(point, P);
const S = (paths: SolidPaths, tone: Tone = 'mid', inner = '') => solidSvg(paths, { tone, inner });
const ringPath = (F: Frame, s: number, r: number) => circleOf(F, s, r, P) as string;
/** Une vis : un point et son anneau, sur une face tournée vers +x. */
const screw = (x: number, y: number, z: number, r = 0.9) => lineSvg(ringPath(along([x, y, z], X), 0, r), { tone: 'lo' }) + dotsSvg([flat([x, y, z])], { size: 0.45, tone: 'mid' });
const hole = (x: number, y: number, z: number, r: number) => `<g class="iso-dots" data-tone="hi"><circle cx="${flat([x, y, z])[0].toFixed(1)}" cy="${flat([x, y, z])[1].toFixed(1)}" r="${(r * 1.18).toFixed(2)}"/></g>`;
/** Cercle d'axe +x entre deux rayons : la face d'une bobine, des spires de bande. */
const turns = (F: Frame, s: number, radii: number[]) => radii.map((r) => lineSvg(ringPath(F, s, r), { tone: 'faint' })).join('');

/** Une pose de la figure : volets tombés, jack de la fiche, octets non lus dans la boucle. */
export interface Pose {
	fallen: number[];
	plug: number;
	bytes: number;
}
export const REST: Pose = { fallen: [], plug: 0, bytes: 0 };

/** Toute la figure dans une pose (au repos par défaut) : les éléments dessinés et les tracés. */
export function scene(pose: Pose = REST): Scene {
	const draws: Draw[] = [];
	const routes: Route[] = [];
	const put = (name: string, at: Point3, svg: string, shapes: Shape[], { piece, bias, ctn }: { piece?: string; bias?: number; ctn?: string } = {}) => {
		const body = ctn ? `<g data-ctn="${ctn}">${svg}</g>` : svg;
		draws.push({ name, piece, at, bias, svg: piece ? pieceSvg(pieceOf(piece), body) : body, shapes });
	};
	const slabShape = (name: string, plan: Plan, z: number, h: number, steps = 3, meta?: Meta): Shape => ({ kind: 'slab', name, plan, z, h, steps, meta });
	const slab = (name: string, plan: Plan, z: number, h: number, o: { tone?: Tone; steps?: number; bevel?: number; inner?: string; extra?: string; piece?: string; bias?: number; ctn?: string; meta?: Meta; halo?: boolean } = {}) =>
		put(name, [plan.x + plan.w / 2, plan.y + plan.d / 2, z + h / 2], solidSvg(slabOf(plan, z, h, P, o.steps ?? 3, o.bevel ?? 0), { tone: o.tone ?? 'mid', inner: o.inner, halo: o.halo }) + (o.extra ?? ''), [slabShape(name, plan, z, h, o.steps ?? 3, o.meta)], o);
	const F0 = facing(0);
	const prism = (name: string, F: Frame, poly: UV[], s0: number, s1: number, meta?: Meta): Shape => ({ kind: 'prism', name, F, poly, s0, s1, meta });
	/** Plaque de façade, de x0 à x1, contour en (y, z). */
	const plate = (name: string, x0: number, x1: number, rings: UV[][], o: { tone?: Tone; inner?: string; extra?: string; piece?: string; bias?: number; ctn?: string; shapes?: Shape[]; meta?: Meta } = {}) => {
		const ys = rings[0].map(([y]) => y);
		const zs = rings[0].map(([, z]) => z);
		const at: Point3 = [(x0 + x1) / 2, (Math.min(...ys) + Math.max(...ys)) / 2, (Math.min(...zs) + Math.max(...zs)) / 2];
		put(name, at, S(plateOf(F0, rings, x0, x1), o.tone, o.inner) + (o.extra ?? ''), o.shapes ?? [prism(name, F0, rings[0], x0, x1, o.meta)], o);
	};
	const discShape = (name: string, F: Frame, s0: number, s1: number, r: number, meta?: Meta): Shape => ({ kind: 'disc', name, F, s0, s1, r, meta });
	// Les facettes ne servent qu'aux tons : peu suffisent sur une petite pièce (le contour reste exact).
	const stepsOf = (r: number) => (r < 3 ? 10 : r < 6 ? 16 : r < 10 ? 22 : 32);
	const discSvg = (F: Frame, s0: number, s1: number, r: number, tone: Tone = 'mid', inner = '') => S(discOf(s0, s1, r, F, P, { steps: stepsOf(r) }), tone, inner);
	/** Pièce tournée à épaulements (collerette et douille, flasque et tambour) : un seul profil. */
	const turnedSvg = (F: Frame, profile: number[][], tone: Tone = 'mid', inner = '') => S(solidOf(profile, F, P, { steps: stepsOf(Math.max(...profile.map(([, r]) => r))) }), tone, inner);
	const turnedShape = (name: string, F: Frame, profile: number[][], meta?: Meta): Shape => ({ kind: 'solid', name, F, profile, meta });
	/** Disque d'axe +x posé sur la face x = x0. */
	const knob = (name: string, x0: number, y: number, z: number, t: number, r: number, o: { tone?: Tone; inner?: (F: Frame) => string; piece?: string; bias?: number; ctn?: string; meta?: Meta } = {}) => {
		const F = along([x0, y, z], X);
		put(name, [x0 + t / 2, y, z], discSvg(F, 0, t, r, o.tone, o.inner?.(F) ?? ''), [discShape(name, F, 0, t, r, o.meta)], o);
		return F;
	};
	const ball = (name: string, at: Point3, r: number, o: { piece?: string; ctn?: string; meta?: Meta } = {}) =>
		put(name, at, S(sphereOf(at, r, P), 'mid'), [{ kind: 'ball', name, at, r, meta: o.meta }], o);
	const helix = (cx: number, cy: number, z0: number, z1: number, r: number, count: number, r1 = r) => {
		const points: Point3[] = [];
		const steps = Math.round(count * 14);
		for (let index = 0; index <= steps; index++) {
			const angle = (index / steps) * count * Math.PI * 2;
			const radius = r + ((r1 - r) * index) / steps;
			points.push([cx + radius * Math.cos(angle), cy + radius * Math.sin(angle), z0 + ((z1 - z0) * index) / steps]);
		}
		return points;
	};

	// --- Fixation murale --------------------------------------------------------------------
	const boardInner = lineSvg(onFace(BOARD.w, [[4, 4], [BOARD.d - 4, 4], [BOARD.d - 4, BOARD_TOP - 4], [4, BOARD_TOP - 4], [4, 4]]), { tone: 'faint' });
	slab('stand.board', BOARD, 0, BOARD_TOP, { tone: 'lo', steps: 3, bevel: 1.6, inner: boardInner, halo: true });
	for (const [y, z] of [[14, 14], [222, 14], [14, 406], [222, 406]] as UV[]) {
		const F = along([BOARD.w, y, z], X);
		// Tête fendue : la fente va d'un bord à l'autre de la tête.
		const slot = onFace(BOARD.w + 1.2, [[y - 2.0, z - 1.25], [y + 2.0, z + 1.25]]);
		put(`board.screw-${y}-${z}`, [BOARD.w + 1, y, z], S(discOf(0, 1.2, 2.4, F, P, { steps: 12, bevel: 0.4 }), 'mid', lineSvg(slot, { tone: 'mid' })), [discShape('board.screw', F, 0, 1.2, 2.4)]);
	}

	// Rosace murale et câble des autres fenêtres, jusqu'au bornier du chapeau.
	const ROSE: Point3 = [0, -36, 412];
	knob('stand.pattress', 0, ROSE[1], ROSE[2], 8, 12, { tone: 'lo', inner: (F) => lineSvg(ringPath(F, 8, 10.6), { tone: 'faint' }) });
	const capF = along([8, ROSE[1], ROSE[2]], X);
	const capProfile = [[0, 10], [1.6, 10], [1.6, 8.2], [3.4, 8.2]];
	put('rosace.cap', [10, ROSE[1], ROSE[2]], S(solidOf(capProfile, capF, P), 'mid') + screw(11.4, ROSE[1] - 5.6, ROSE[2] + 3.2, 0.7) + screw(11.4, ROSE[1] + 5.6, ROSE[2] - 3.2, 0.7), [
		{ kind: 'solid', name: 'rosace.cap', F: capF, profile: capProfile },
	]);
	// Le câble quitte la rosace par un coude à rotule, la rotule posée sur la bague par son bord.
	knob('rosace.bague', 11.7, ROSE[1], ROSE[2], 1.6, 2.6, { meta: { seatedOn: 'rosace.coude' } });
	const ELBOW: Point3 = [13.3 + Math.sqrt(3.2 ** 2 - 2.6 ** 2), ROSE[1], ROSE[2]];
	ball('rosace.coude', ELBOW, 3.2);
	const CABLE_R = 1.6;
	const cableStart: Point3 = [ELBOW[0], ELBOW[1] + Math.sqrt(3.2 ** 2 - CABLE_R ** 2), ELBOW[2]];
	const GLAND_TOP = 378;
	const cable = [cableStart, [ELBOW[0], 58, ROSE[2]], [ELBOW[0], 58, GLAND_TOP]] as Point3[];
	const STRAPS = [24, 48];
	const cableGaps: [number, number][] = STRAPS.map((y) => [y - 1.8 - cableStart[1], y + 1.8 - cableStart[1]]);
	const cableRoute = filletOn(cable, 6, P, CABLE_R);
	routes.push({ name: 'cable', points: cableRoute, r: CABLE_R, options: { gaps: cableGaps, touch: STRAPS.map((y) => `pontet-${y}`) } });
	tubeOf(cableRoute, CABLE_R, P, { gaps: cableGaps, maxLength: 400, spacing: CORD_SPACING, rings: { ...CORD_RINGS, pitch: 4.6 } }).forEach((piece, index) =>
		draws.push({ name: `cable:${index}`, at: piece.mid, svg: tubeSvg(piece, { tone: 'mid' }), shapes: [{ kind: 'tube', name: `cable:${index}`, points: piece.points, radii: piece.radii }], route: 'cable', chunk: index }),
	);
	for (const y of STRAPS) slab(`pontet-${y}`, { x: BOARD.w, y: y - 1.8, w: ELBOW[0] + CABLE_R + 1.2 - BOARD.w, d: 3.6, r: 0.6 }, ROSE[2] - 3.4, 6.8, { steps: 2, bevel: 0.3, extra: screw(ELBOW[0] + CABLE_R + 1.2, y, ROSE[2] + 2.3, 0.5) + screw(ELBOW[0] + CABLE_R + 1.2, y, ROSE[2] - 2.3, 0.5) });

	// --- Caisse -----------------------------------------------------------------------------------
	slab('tasseau-bas', { x: BOARD.w, y: 30, w: 12, d: 176, r: 1 }, 28, 12, { tone: 'lo', bevel: 0.6 });
	slab('plinthe-basse', { x: BOARD.w, y: 12, w: 44, d: 212, r: 1.5 }, 40, 12, { bevel: 1, inner: lineSvg(sideSeam({ x: BOARD.w, y: 12, w: 44, d: 212, r: 1.5 }, 46, P, 3), { tone: 'faint' }) });
	slab('plinthe-haute', { x: BOARD.w, y: 16, w: 40, d: 204, r: 1 }, 52, 12, { bevel: 0.8 });
	slab('montant-droit', { x: BOARD.w, y: 20, w: 36, d: 10, r: 0.8 }, BODY.z0, BODY.z1 - BODY.z0, { bevel: 0.6 });
	slab('montant-gauche', { x: BOARD.w, y: 206, w: 36, d: 10, r: 0.8 }, BODY.z0, BODY.z1 - BODY.z0, { bevel: 0.6 });
	slab('meneau', { x: BOARD.w, y: 104, w: 36, d: 8, r: 0.6 }, BODY.z0, BODY.z1 - BODY.z0, { bevel: 0.5 });
	slab('chapeau-bas', { x: BOARD.w, y: 16, w: 40, d: 204, r: 1 }, BODY.z1, 12, { bevel: 0.8 });
	slab('chapeau-haut', { x: BOARD.w, y: 12, w: 44, d: 212, r: 1.5 }, BODY.z1 + 12, 14, { bevel: 1.2, inner: lineSvg(sideSeam({ x: BOARD.w, y: 12, w: 44, d: 212, r: 1.5 }, BODY.z1 + 19, P, 3), { tone: 'faint' }) });
	const panelGroove = lineSvg(onFace(PANEL, [[116, 68], [202, 68], [202, 340], [116, 340], [116, 68]]), { tone: 'faint' });
	slab('panneau', { x: BOARD.w, y: 112, w: PANEL - BOARD.w, d: 94, r: 0 }, BODY.z0, BODY.z1 - BODY.z0, { inner: panelGroove });
	slab('platine', { x: BOARD.w, y: 30, w: PLATINE - BOARD.w, d: 74, r: 0 }, BODY.z0, BODY.z1 - BODY.z0, { tone: 'lo' });
	// Feuillure du capot déposé : un rebord de 2 autour de l'ouverture, et les trous de ses vis.
	const LEDGE = 41;
	const rebateHoles = (y: number) => hole(LEDGE, y, 72, 0.55) + hole(LEDGE, y, 336, 0.55);
	slab('feuillure-droite', { x: PLATINE, y: 30, w: LEDGE - PLATINE, d: 2, r: 0 }, BODY.z0, BODY.z1 - BODY.z0, { steps: 1, extra: rebateHoles(31) });
	slab('feuillure-gauche', { x: PLATINE, y: 102, w: LEDGE - PLATINE, d: 2, r: 0 }, BODY.z0, BODY.z1 - BODY.z0, { steps: 1, extra: rebateHoles(103) });
	slab('feuillure-basse', { x: PLATINE, y: 32, w: LEDGE - PLATINE, d: 70, r: 0 }, BODY.z0, 3, { steps: 1 });
	slab('feuillure-haute', { x: PLATINE, y: 32, w: LEDGE - PLATINE, d: 70, r: 0 }, BODY.z1 - 3, 3, { steps: 1 });

	// Tasseau haut à crémaillère, biseauté, sur le chapeau.
	const CLEAT: Frame = { o: [0, 0, 0], a: Y, u: Z, v: X };
	const cleatRing: UV[] = [[370, BOARD.w], [370, 20], [375, 20], [380, BOARD.w]];
	put('tasseau-haut', [14, 138, 375], S(plateOf(CLEAT, [cleatRing], 80, 196), 'lo'), [prism('tasseau-haut', CLEAT, cleatRing, 80, 196)]);

	// --- Colonne des volets -------------------------------------------------------------------------
	for (let index = 0; index < WINDOWS.length; index++) {
		const top = windowTop(index);
		const bottom = windowBottom(index);
		const axis = flapAxisZ(index);
		const bars = [
			rect(WIN.y0, bottom, WIN.y1, bottom + 4),
			rect(WIN.y0, top - 4, WIN.y1, top),
			rect(WIN.open1, bottom + 4, WIN.y1, top - 4),
			rect(WIN.y0, bottom + 4, WIN.open0, top - 4),
		];
		const screws = [120, 164].flatMap((y) => [screw(PANEL + 2, y, bottom + 2, 0.7), screw(PANEL + 2, y, top - 2, 0.7)]).join('');
		plate(`enjoliveur-${index}`, PANEL, PANEL + 2, [rect(WIN.y0, bottom, WIN.y1, top), rect(WIN.open0, bottom + 4, WIN.open1, top - 4)], {
			extra: screws,
			shapes: bars.map((ring, bar) => prism(`enjoliveur-${index}.${bar}`, F0, ring, PANEL, PANEL + 2)),
		});
		// Carte d'indicateur : le libellé en lignes libres et le voyant de niveau, derrière le volet.
		const cardX = PANEL + 0.3;
		const midZ = (bottom + top) / 2;
		const textLines = [
			[131, 158, midZ + 6],
			[131, 152, midZ],
			[131, 155, midZ - 6],
		]
			.map(([y0, y1, z]) => lineSvg(onFace(cardX, [[y0, z], [y1, z]]), { tone: 'mid', free: true }))
			.join('');
		const lampF = along([cardX, 124.5, midZ], X);
		const lamps = `<g data-ctn="lamp-${index}-warn">${dotsSvg([flat([cardX, 124.5, midZ])], { size: 2.1, tone: 'hi' })}</g><g data-ctn="lamp-${index}-info" visibility="hidden">${lineSvg(ringPath(lampF, 0, 2.1), { tone: 'hi' })}${lineSvg(ringPath(lampF, 0, 1.2), { tone: 'lo' })}</g>`;
		plate(`carte-${index}`, PANEL, cardX, [rect(119.5, bottom + 6, 164.5, top - 5)], { tone: 'lo', extra: textLines + lamps });
		// Charnière basse (charnon et axe) et butées du volet tombé.
		const hinge = along([FLAP.axisX, FLAP.y0, axis], Y);
		put(`charnon-${index}`, [FLAP.axisX, (FLAP.y0 + FLAP.y1) / 2, axis], discSvg(hinge, 0, FLAP.y1 - FLAP.y0, 1, 'mid'), [discShape(`charnon-${index}`, hinge, 0, FLAP.y1 - FLAP.y0, 1)]);
		slab(`butee-${index}`, { x: PANEL + 2, y: 140.5, w: 4, d: 3, r: 0.4 }, bottom + 1.5, 2.5, { steps: 2 });
		// Le volet, pièce maîtresse, levé (ou tombé dans la pose) ; sa languette sous le crochet d'armature.
		const fallen = pose.fallen.includes(index);
		const angle = fallen ? FLAP_DOWN : 0;
		const [body, tab] = flapPaths(index, angle);
		const F = flapFrame(index, angle);
		put(`volet-${index}`, [FLAP.axisX, (FLAP.y0 + FLAP.y1) / 2, axis + 17], S(body, 'hi') + S(tab, 'hi'), [prism(`volet-${index}`, F, FLAP_BODY.ring, FLAP_BODY.s0, FLAP_BODY.s1), prism(`volet-${index}.languette`, F, FLAP_TAB.ring, FLAP_TAB.s0, FLAP_TAB.s1)], {
			piece: 'volet',
			ctn: `flap-${index}`,
		});
		// Crochet d'armature : levier sur la traverse haute, son bec devant la languette.
		const pivot = PIVOTS.hook(index);
		const hookRing = turnUV(hookRingOf(index), pivot, fallen ? HOOK_LIFT : 0);
		// L'axe, caché derrière le levier, est enregistré sans être dessiné ; sa tête est un rivet.
		const pinF = along([PANEL + 2, pivot[1], pivot[2]], X);
		put(`crochet-${index}`, [pivot[0] + 0.6, 148, top - 3], S(plateOf(F0, [hookRing], pivot[0], pivot[0] + 1.2), 'mid', screw(pivot[0] + 1.2, pivot[1], pivot[2], 0.8)), [
			discShape(`crochet-${index}.axe`, pinF, 0, pivot[0] - PANEL - 2, 0.8),
			prism(`crochet-${index}`, F0, hookRing, pivot[0], pivot[0] + 1.2),
		], { ctn: `hook-${index}` });
		// Jack de fenêtre : douille à collerette vissée dans le panneau.
		const z = jackZ(index);
		const collar = along([PANEL, JACK_Y, z], X);
		const jackProfile = [[0, 5.5], [1.5, 5.5], [1.5, 3.5], [5, 3.5]];
		const collarScrews = dotsSvg([flat([PANEL + 1.5, JACK_Y, z + 4.5]), flat([PANEL + 1.5, JACK_Y, z - 4.5])], { size: 0.45, tone: 'mid' });
		put(`jack-${index}`, [PANEL + 2.5, JACK_Y, z], turnedSvg(collar, jackProfile, 'mid', collarScrews + lineSvg(ringPath(collar, 5, 2.6), { tone: 'faint' })) + hole(PLUG.face, JACK_Y, z, 1.7), [turnedShape(`jack-${index}`, collar, jackProfile, index === pose.plug ? { owner: 'prise' } : undefined)], { piece: 'cordon' });
	}
	// Peigne de fils lecture → volets, le long du meneau : chaque fil finit sur la borne de son volet.
	const COMB_X = FRONT + 0.55;
	slab('peigne.bornier', { x: FRONT, y: 105.5, w: 2, d: 6.2, r: 0.5 }, 70, 6, { steps: 2, bevel: 0.3 });
	WINDOWS.forEach((_, index) => {
		const y = 106.3 + index * 1.15;
		const post = (windowBottom(index) + windowTop(index)) / 2;
		knob(`peigne.borne-${index}`, FRONT, y, post, 1.4, 0.6, { tone: 'mid' });
		const wire: Point3[] = [[COMB_X, y, 76], [COMB_X, y, post - 0.6]];
		routes.push({ name: `peigne-${index}`, points: wire, r: 0.32, options: { limp: true } });
		tubeOf(wire, 0.32, P, { maxLength: 400, spacing: 8 }).forEach((piece, chunk) =>
			draws.push({ name: `peigne-${index}:${chunk}`, at: piece.mid, svg: tubeSvg(piece, { tone: 'mid' }), shapes: [{ kind: 'tube', name: `peigne-${index}:${chunk}`, points: piece.points, radii: piece.radii }], route: `peigne-${index}`, chunk }),
		);
	});

	// --- Fiche à cordon -----------------------------------------------------------------------------
	const plugZ = jackZ(pose.plug);
	const plugF = along([PLUG.tip, JACK_Y, plugZ], X);
	// La pointe vit dans la douille du jack (même propriétaire : elle y est enfoncée par conception).
	const tipProfile = [[0, 0], [0, 0.6, 1], [0.7, 1.05, 1], [1.6, 1.2], [2.2, 1.2], [2.2, 0.8], [2.6, 0.8], [2.6, 1.6], [3.4, 1.6]];
	const bodyProfile = [[3.4, 1.6], [8.4, 1.6], [8.4, 2.0], [10.4, 2.0], [10.4, 2.6], [16.4, 2.6], [16.4, 3.6], [30.4, 3.6], [32, 2.9, 1], [33.4, 2.2]];
	put('fiche.pointe', [43.3, JACK_Y, plugZ], S(solidOf(tipProfile, plugF, P), 'mid'), [{ kind: 'solid', name: 'fiche.pointe', F: plugF, profile: tipProfile, meta: { owner: 'prise' } }], { piece: 'cordon', ctn: 'plug-tip' });
	const knurled = fadedSvg(knurlOf(plugF, 16.7, 30.1, 3.6, 30, P), { tone: 'lo' });
	put('fiche', [60, JACK_Y, plugZ], S(solidOf(bodyProfile, plugF, P), 'mid', knurled), [{ kind: 'solid', name: 'fiche', F: plugF, profile: bodyProfile }], { piece: 'cordon', ctn: 'plug' });
	const cord = cordRoute(plugZ, 0);
	routes.push({ name: 'cordon', points: cord, r: CORD_R, options: {} });
	draws.push({
		name: 'cordon',
		piece: 'cordon',
		at: [52, LANE_Y, 120],
		svg: pieceSvg(pieceOf('cordon'), `<g data-ctn="cord">${ropeSvg(cord, CORD_R)}</g>`),
		shapes: [{ kind: 'tube', name: 'cordon', points: cord, r: CORD_R }],
	});
	// Passe-cordon (œillet dans la plinthe) et son ressort de garde.
	const eyeF = along([EYELET.x, EYELET.y, EYELET.z], Z);
	put('passe-cordon', [EYELET.x, EYELET.y, EYELET.z + 0.8], discSvg(eyeF, 0, EYELET.top - EYELET.z, 3.2, 'mid', lineSvg(ringPath(eyeF, EYELET.top - EYELET.z, 2.3), { tone: 'faint' })), [discShape('passe-cordon', eyeF, 0, EYELET.top - EYELET.z, 3.2)], { piece: 'cordon' });
	// Ressort de garde conique : posé sur l'œillet, il se resserre jusqu'à mordre le cordon.
	const GUARD = { r0: 2.3, r1: CORD_R + 0.25, turns: 6 };
	const guard = coilZ(EYELET.x, EYELET.y, EYELET.top, EYELET.guard, GUARD.r0, GUARD.turns, 14, GUARD.r1);
	const guardPoints = helix(EYELET.x, EYELET.y, EYELET.top, EYELET.guard, GUARD.r0, GUARD.turns, GUARD.r1);
	const V = [Math.cos((18 * Math.PI) / 180), Math.sin((18 * Math.PI) / 180)];
	const nearHalf = (point: Point3) => (point[0] - EYELET.x) * V[0] + (point[1] - EYELET.y) * V[1] > 0;
	put('garde.arriere', [EYELET.x - 1, EYELET.y, 72], lineSvg(guard.back, { tone: 'mid' }), [{ kind: 'tube', name: 'garde.arriere', points: guardPoints.filter((p) => !nearHalf(p)), r: 0.25 }], { piece: 'cordon', bias: -2 });
	put('garde.avant', [EYELET.x + 1, EYELET.y, 72], lineSvg(guard.front, { tone: 'mid' }), [{ kind: 'tube', name: 'garde.avant', points: guardPoints.filter(nearHalf), r: 0.25 }], { piece: 'cordon', bias: 2 });
	// Clé de verrou à levier (suppress_focused), engagée, sur la plinthe.
	put('cle.plaque', [52.4, 150, 46], S(plateOf(F0, [rect(143, 42.5, 157, 49.5)], 52, 52.8), 'mid') + screw(52.8, 145, 46, 0.5) + screw(52.8, 155, 46, 0.5), [prism('cle.plaque', F0, rect(143, 42.5, 157, 49.5), 52, 52.8)], { piece: 'cordon' });
	const leverAxis: Point3 = [Math.cos(0.5), 0, Math.sin(0.5)];
	const leverF = along([52.8, 150, 46], leverAxis);
	const leverProfile = [[0, 1.6], [1.2, 1.6], [1.2, 0.9], [9, 0.9]];
	// La boule repose sur le bout du levier par son bord : centre à √(1,6² − 0,9²) au-delà.
	const knobS = 9 + Math.sqrt(1.6 ** 2 - 0.9 ** 2);
	const knobAt: Point3 = [52.8 + leverAxis[0] * knobS, 150, 46 + leverAxis[2] * knobS];
	put('cle.levier', [56, 150, 49], S(solidOf(leverProfile, leverF, P), 'mid'), [{ kind: 'solid', name: 'cle.levier', F: leverF, profile: leverProfile }], { piece: 'cordon' });
	ball('cle.boule', knobAt, 1.6, { piece: 'cordon' });

	// --- Colonne de bande --------------------------------------------------------------------------
	const TX = (TAPE.x0 + TAPE.x1) / 2;
	/**
	 * Galet : flasque arrière et tambour, puis flasque avant et écrou, deux éléments autour de la
	 * bande. L'axe, entièrement caché derrière le flasque arrière, est enregistré sans être dessiné.
	 */
	const pulley = (name: string, c: number, z: number, r: number, R: number) => {
		const y = col(c);
		const F = along([PLATINE, y, z], X);
		const back = [[2, R], [3, R], [3, r], [13, r]];
		const front = [[13, R], [14, R], [14, 1.6], [15, 1.6]];
		put(`${name}.arriere`, [PLATINE + 2, y, z], turnedSvg(F, back), [discShape(`${name}.axe`, F, 0, 2, 1.2), turnedShape(`${name}.arriere`, F, back)]);
		put(`${name}.avant`, [PLATINE + 14, y, z], turnedSvg(F, front, 'mid', lineSvg(ringPath(F, 14, R - 1.2), { tone: 'faint' })), [turnedShape(`${name}.avant`, F, front)], { bias: 1 });
		return F;
	};

	// Bobine débitrice de bande vierge : flasque arrière, galette de bande, flasque avant ajouré.
	const D = { c: 18.5, z: 318, R: 15, pack: 10.5, hub: 4 };
	const DF = along([PLATINE, col(D.c), D.z], X);
	const debitBack = [[2, D.R], [3, D.R], [3, D.pack], [13, D.pack]];
	put('debitrice.arriere', [PLATINE + 2, col(D.c), D.z], turnedSvg(DF, debitBack, 'mid', turns(DF, 13, [6.2, 8.1, 9.6])), [
		discShape('debitrice.axe', DF, 0, 2, 1.4),
		turnedShape('debitrice.arriere', DF, debitBack),
	], { piece: 'bobine' });
	const spokes = [0, 1, 2].map((k) => {
		const angle = Math.PI / 2 + (k * 2 * Math.PI) / 3;
		const [cy, cz] = [col(D.c), D.z];
		const ring: UV[] = [-1.2, 1.2].flatMap((w) => [D.hub - 0.2, D.R - 1.4].map((r) => [cy + Math.cos(angle) * r - Math.sin(angle) * w, cz + Math.sin(angle) * r + Math.cos(angle) * w] as UV));
		return [ring[0], ring[1], ring[3], ring[2]] as UV[];
	});
	const spider = discSvg(DF, 13, 14, D.R, 'mid') + spokes.map((ring) => S(plateOf(F0, [ring], PLATINE + 13, PLATINE + 14))).join('') + discSvg(DF, 13, 14.8, D.hub) + discSvg(DF, 14.8, 15.6, 1.6);
	const rimHole = (F: Frame) => lineSvg(ringPath(F, 14, D.R - 1.4), { tone: 'faint' });
	// Le flasque avant est ajouré : un anneau, trois rayons et le moyeu, qui tournent ensemble.
	put('debitrice.avant', [PLATINE + 14, col(D.c), D.z], spider.replace(discSvg(DF, 13, 14, D.R, 'mid'), S(ringBand(13, 14, D.R - 1.4, D.R, DF, P), 'mid', rimHole(DF))), [
		{ kind: 'ring', name: 'debitrice.anneau', F: DF, s0: 13, s1: 14, rIn: D.R - 1.4, rOut: D.R },
		...spokes.map((ring, k) => prism(`debitrice.rayon-${k}`, F0, ring, PLATINE + 13, PLATINE + 14)),
		discShape('debitrice.moyeu', DF, 13, 14.8, D.hub),
		discShape('debitrice.ecrou', DF, 14.8, 15.6, 1.6),
	], { piece: 'bobine', ctn: 'spider', bias: 1 });

	// Bande : brin horizontal sous le perforateur, trous perforés sur son dessus.
	const tapeTop = D.z - D.pack;
	// Le brin part juste après le point tangent : sous la galette, il ne ferait que la frôler.
	const T1 = { x: TAPE.x0, y: col(R1.c), w: TAPE.x1 - TAPE.x0, d: col(D.c + 3) - col(R1.c), r: 0 };
	slab('bande.haut', T1, tapeTop - TAPE.t, TAPE.t, { tone: 'mid', steps: 1, piece: 'bobine', extra: `<g data-ctn="holes">${dotsSvg(tapeHoles(START_SIZE),{ size: 0.32, tone: 'hi' })}</g>` });
	// Perforateur : bloc à poinçons, frappeur, matrice et guide-bande.
	const PERF = { y: col(44), d: 10 };
	slab('perforateur.matrice', { x: PLATINE, y: PERF.y, w: 14, d: PERF.d, r: 0.4 }, 300, tapeTop - TAPE.t - 300, { piece: 'perforateur', steps: 2, bevel: 0.4 });
	slab('perforateur.guide', { x: PLATINE + 14, y: PERF.y - 1, w: 1, d: PERF.d + 2, r: 0.3 }, 300.5, 5.4, { piece: 'perforateur', steps: 2, extra: screw(PLATINE + 15, PERF.y + 0.8, 303, 0.4) + screw(PLATINE + 15, PERF.y + PERF.d - 0.8, 303, 0.4) });
	// Les neuf poinçons (huit pistes et l'entraînement) sortent sous le bloc ; le frappeur est dessus.
	// Poinçons carrés (0,6 de côté) : quatre faces suffisent à des pièces de cette taille.
	const pinPlan = (track: number) => ({ x: TAPE.x0 + 0.7 + track, y: col(39) - 0.3, w: 0.6, d: 0.6, r: 0 });
	put('perforateur.poincons', [32, col(39), tapeTop + 0.8], Array.from({ length: 9 }, (_, track) => S(slabOf(pinPlan(track), tapeTop + 0.1, 1.5, P, 1))).join(''), Array.from({ length: 9 }, (_, track) => slabShape(`perforateur.poincon-${track}`, pinPlan(track), tapeTop + 0.1, 1.5, 1)), { piece: 'perforateur', ctn: 'punches' });
	slab('perforateur.bloc', { x: PLATINE, y: PERF.y, w: 14, d: PERF.d, r: 0.6 }, tapeTop + 1.6, 8, { piece: 'perforateur', steps: 2, bevel: 0.5 });
	const strikerPlan = { x: PLATINE + 2, y: PERF.y + 1, w: 10, d: PERF.d - 2, r: 0.5 };
	slab('perforateur.frappeur', strikerPlan, tapeTop + 9.6, 2, { piece: 'perforateur', steps: 2, bevel: 0.3, ctn: 'striker' });

	// Galets de renvoi.
	pulley('galet-1', R1.c, R1.z, R1.r, 7);
	pulley('galet-2', R2.c, R2.z, R2.r, 8);
	// Poulie lestée du bras danseur, au repos : boucle vide.
	const zp = dancerZ(pose.bytes);
	const DPF = along([PLATINE, col(DANCER.c), zp], X);
	const dancerBack = [[2, 8.5], [3, 8.5], [3, DANCER.r], [13, DANCER.r]];
	put('danseur.poulie-arriere', [PLATINE + 2, col(DANCER.c), zp], turnedSvg(DPF, dancerBack), [turnedShape('danseur.poulie-arriere', DPF, dancerBack, { owner: 'danseur' })], { piece: 'lecture', ctn: 'dancer-back' });
	const loops = loopPaths(zp);
	put('boucle', [TX, col(60), (zp + R2.z) / 2], `<g data-ctn="loop">${loops.map((paths) => S(paths, 'mid')).join('')}</g>`, loopRuns(zp).map((run, k) => prism(`boucle-${k}`, run.frame, run.ring, 0, TAPE.x1 - TAPE.x0)), { piece: 'bobine' });
	const armRing = rect(col(71), zp - 1.5, col(56.6), zp + 1.5);
	const dancerFrontProfile = [[13, 8.5], [14, 8.5], [14, 1.6], [15, 1.6]];
	const dancerFront = turnedSvg(DPF, dancerFrontProfile, 'mid', lineSvg(ringPath(DPF, 14, 7.3), { tone: 'faint' })) + S(plateOf(F0, [armRing], PLATINE + 15, PLATINE + 16.4), 'mid', screw(PLATINE + 16.4, col(DANCER.c), zp, 1.1) + screw(PLATINE + 16.4, col(69.5), zp, 0.7));
	put('danseur.bras', [PLATINE + 15, col(64), zp], dancerFront, [
		turnedShape('danseur.poulie-avant', DPF, dancerFrontProfile, { owner: 'danseur' }),
		prism('danseur.bras', F0, armRing, PLATINE + 15, PLATINE + 16.4, { owner: 'danseur' }),
	], { piece: 'lecture', ctn: 'dancer-front', bias: 2 });
	// Tige de guidage, consoles, chariot et ressort de rappel.
	const ROD = { x: DANCER.rodX, y: col(DANCER.rod) };
	slab('danseur.console-basse', { x: PLATINE, y: col(72), w: 10, d: 4, r: 0.4 }, GUIDE.z0 - 3, 3, { piece: 'lecture', steps: 2, meta: { owner: 'danseur' } });
	slab('danseur.console-haute', { x: PLATINE, y: col(72), w: 10, d: 4, r: 0.4 }, GUIDE.z1, 3, { piece: 'lecture', steps: 2, meta: { owner: 'danseur' } });
	// Barre de guidage carrée, en deux tronçons de part et d'autre du chariot qui coulisse dessus.
	// Mêmes plaques que celles que le mouvement redessine quand le chariot coulisse.
	const guides = guidePaths(zp);
	guideSpans(zp).forEach(([z0, z1], index) => {
		const name = index ? 'danseur.tige-haute' : 'danseur.tige-basse';
		put(name, [GUIDE.plan.x + 0.8, GUIDE.plan.y + 0.8, (z0 + z1) / 2], S(guides[index]), [slabShape(name, GUIDE.plan, z0, z1 - z0, 1, { owner: 'danseur' })], { piece: 'lecture', ctn: index ? 'guide-high' : 'guide-low' });
	});
	const carriage = { x: ROD.x - 3, y: ROD.y - 2, w: 6, d: 4, r: 0.6 };
	const link = { x: ROD.x + 3, y: col(71), w: PLATINE + 15 - ROD.x - 3, d: 3, r: 0.3 };
	put('danseur.chariot', [ROD.x + 4, ROD.y, zp], S(slabOf(carriage, zp - 3, 6, P, 2, 0.4), 'mid') + S(slabOf(link, zp - 1.5, 3, P, 2), 'mid'), [
		slabShape('danseur.chariot', carriage, zp - 3, 6, 2, { owner: 'danseur' }),
		slabShape('danseur.lien', link, zp - 1.5, 3, 2, { owner: 'danseur' }),
	], { piece: 'lecture', ctn: 'carriage', bias: 1 });
	const spring0 = dancerCoil(zp);
	const springPoints = helix(ROD.x, ROD.y, zp + GUIDE.carriage, DANCER_SPRING.top, DANCER_SPRING.r, DANCER_SPRING.turns);
	const nearRod = (point: Point3) => (point[0] - ROD.x) * V[0] + (point[1] - ROD.y) * V[1] > 0;
	put('ressort.arriere', [ROD.x - 1, ROD.y, 280], `<g data-ctn="coil-back">${lineSvg(spring0.back, { tone: 'mid' })}</g>`, [{ kind: 'tube', name: 'ressort.arriere', points: springPoints.filter((p) => !nearRod(p)), r: 0.25, meta: { owner: 'danseur' } }], { piece: 'lecture', bias: -1 });
	put('ressort.avant', [ROD.x + 1, ROD.y, 280], `<g data-ctn="coil-front">${lineSvg(spring0.front, { tone: 'mid' })}</g>`, [{ kind: 'tube', name: 'ressort.avant', points: springPoints.filter(nearRod), r: 0.25, meta: { owner: 'danseur' } }], { piece: 'lecture', bias: 1 });

	// Brin principal, du galet 2 à la bobine réceptrice, le long de la lecture.
	const MAIN = { c0: R2.c - R2.r - TAPE.t, c1: R2.c - R2.r };
	const takeup = { c: MAIN.c0 - 10, z: 120, R: 18, pack: 10 };
	const runPlan = { x: TAPE.x0, y: col(MAIN.c1), w: TAPE.x1 - TAPE.x0, d: TAPE.t, r: 0 };
	slab('bande.principale', runPlan, takeup.z, R2.z - takeup.z, { steps: 1, piece: 'bobine' });
	// Tête de lecture : huit palpeurs sur son dessus, contre la bande.
	const head = { x: PLATINE, y: col(MAIN.c0), w: 14, d: MAIN.c0 - 29, r: 0.6 };
	const feelers = Array.from({ length: 8 }, (_, k) => flat([PLATINE + 3 + k * 1.3, col(MAIN.c0 - 1.4), 266]));
	slab('lecture.tete', head, 252, 14, { piece: 'lecture', steps: 2, bevel: 0.5, extra: dotsSvg(feelers, { size: 0.42, tone: 'hi' }) + screw(PLATINE + 14, col(31), 255, 0.6) + screw(PLATINE + 14, col(31), 263, 0.6) });
	// Roue d'entraînement de lecture (dents dans la piste d'entraînement) et son index.
	const SPR = { c: MAIN.c0 - 6, z: 238, r: 6 };
	const gear = (cy: number, cz: number, count: number, root: number, tip: number, phase = 0): UV[] => {
		const ring: UV[] = [];
		for (let k = 0; k < count; k++) {
			const a0 = phase + (k / count) * Math.PI * 2;
			const step = (Math.PI * 2) / count;
			for (const [share, r] of [[0, root], [0.3, tip], [0.55, root]] as [number, number][]) ring.push([cy + Math.cos(a0 + share * step) * r, cz + Math.sin(a0 + share * step) * r]);
		}
		return ring;
	};
	const sprY = col(SPR.c);
	const sprF = along([PLATINE, sprY, SPR.z], X);
	const index = [[sprY - 0.5, SPR.z], [sprY + 0.5, SPR.z], [sprY, SPR.z + 4.6]] as UV[];
	// Les arbres, cachés derrière leurs roues, sont enregistrés sans être dessinés.
	put('lecture.roue', [33, sprY, SPR.z], S(plateOf(F0, [gear(sprY, SPR.z, 16, SPR.r - 1.1, SPR.r)], 32.4, 33.6), 'mid') + discSvg(sprF, 9.6, 10.6, 1.8) + S(plateOf(F0, [index], 34.6, 35.2), 'hi'), [
		discShape('lecture.arbre', sprF, 0, 8.4, 1.1),
		prism('lecture.roue', F0, gear(sprY, SPR.z, 16, SPR.r - 1.1, SPR.r), 32.4, 33.6),
		discShape('lecture.moyeu', sprF, 9.6, 10.6, 1.8),
		prism('lecture.index', F0, index, 34.6, 35.2),
	], { piece: 'lecture', ctn: 'sprocket' });
	// Échappement : roue de trente dents, ancre, balancier à spiral, raquette.
	const ESC = { c: SPR.c - 15, z: 238 };
	const escY = col(ESC.c);
	const escF = along([PLATINE, escY, ESC.z], X);
	const windows3 = [0, 1, 2].map((k) => {
		const a0 = Math.PI / 2 + (k * 2 * Math.PI) / 3 + 0.32;
		const a1 = a0 + (2 * Math.PI) / 3 - 0.64;
		const ring: UV[] = [];
		for (let step = 0; step <= 8; step++) ring.push([escY + Math.cos(a0 + ((a1 - a0) * step) / 8) * 6.4, ESC.z + Math.sin(a0 + ((a1 - a0) * step) / 8) * 6.4]);
		for (let step = 8; step >= 0; step--) ring.push([escY + Math.cos(a0 + ((a1 - a0) * step) / 8) * 2.6, ESC.z + Math.sin(a0 + ((a1 - a0) * step) / 8) * 2.6]);
		return ring;
	});
	const escRing = gear(escY, ESC.z, 30, 7.6, 9, 0.05);
	put('echappement.roue', [33, escY, ESC.z], S(plateOf(F0, [escRing, ...windows3], 32.4, 33.6), 'mid') + discSvg(escF, 9.6, 10.4, 1.5), [
		discShape('echappement.arbre', escF, 0, 8.4, 1),
		prism('echappement.roue', F0, escRing, 32.4, 33.6),
		discShape('echappement.moyeu', escF, 9.6, 10.4, 1.5),
	], { piece: 'echappement', ctn: 'escape' });
	const AN = { z: 252.5 };
	const anchorRing: UV[] = [
		[escY - 7.4, AN.z - 1.2], [escY - 6.2, AN.z - 6.1], [escY - 5.0, AN.z - 5.8], [escY - 5.4, AN.z - 1.4],
		[escY - 0.9, AN.z - 0.4], [escY - 0.7, AN.z + 8.6], [escY + 0.7, AN.z + 8.6], [escY + 0.9, AN.z - 0.4],
		[escY + 5.4, AN.z - 1.4], [escY + 5.0, AN.z - 5.8], [escY + 6.2, AN.z - 6.1], [escY + 7.4, AN.z - 1.2],
		[escY + 1.4, AN.z + 1.4], [escY - 1.4, AN.z + 1.4],
	];
	const anF = along([PLATINE, escY, AN.z], X);
	put('echappement.ancre', [33, escY, AN.z + 1], S(plateOf(F0, [anchorRing], 32.4, 33.4), 'mid') + discSvg(anF, 9.4, 10, 1.1), [
		discShape('echappement.axe-ancre', anF, 0, 8.4, 0.8),
		prism('echappement.ancre', F0, anchorRing, 32.4, 33.4),
		discShape('echappement.vis-ancre', anF, 9.4, 10, 1.1),
	], { piece: 'echappement', ctn: 'anchor' });
	const BAL = { z: 270, r: 8 };
	const balF = along([PLATINE, escY, BAL.z], X);
	const circle = (cy: number, cz: number, r: number, count = 40): UV[] => Array.from({ length: count }, (_, k) => [cy + Math.cos((k / count) * Math.PI * 2) * r, cz + Math.sin((k / count) * Math.PI * 2) * r]);
	const crossRing: UV[] = [
		[escY - 7.1, BAL.z - 0.6], [escY - 0.6, BAL.z - 0.6], [escY - 0.6, BAL.z - 7.1], [escY + 0.6, BAL.z - 7.1], [escY + 0.6, BAL.z - 0.6], [escY + 7.1, BAL.z - 0.6],
		[escY + 7.1, BAL.z + 0.6], [escY + 0.6, BAL.z + 0.6], [escY + 0.6, BAL.z + 7.1], [escY - 0.6, BAL.z + 7.1], [escY - 0.6, BAL.z + 0.6], [escY - 7.1, BAL.z + 0.6],
	];
	const spiral: Flat[] = [];
	for (let step = 0; step <= 140; step++) {
		const t = step / 140;
		const angle = t * Math.PI * 2 * 4.5;
		const r = 1.6 + t * 3.8;
		spiral.push(flat([34.5, escY + Math.cos(angle) * r, BAL.z + Math.sin(angle) * r]));
	}
	const stud: Point3 = [34.5, escY + Math.cos(Math.PI * 9) * 5.4, BAL.z];
	put('echappement.balancier', [33.8, escY, BAL.z], S(plateOf(F0, [circle(escY, BAL.z, BAL.r, 40), circle(escY, BAL.z, BAL.r - 1, 40)], 33.4, 34.4), 'mid') + S(plateOf(F0, [crossRing], 33.4, 34.2), 'mid') + discSvg(balF, 9.4, 10.6, 1.6) + lineSvg(pathOf(spiral), { tone: 'lo' }), [
		discShape('echappement.balancier-axe', balF, 0, 9.4, 0.7),
		prism('echappement.balancier', F0, circle(escY, BAL.z, BAL.r, 56), 33.4, 34.4),
		discShape('echappement.virole', balF, 9.4, 10.6, 1.6),
	], { piece: 'echappement', ctn: 'balance' });
	// Coq du balancier, piton du spiral et raquette avance-retard.
	const cockPost = { c: ESC.c - 12.4, z: BAL.z + 6 };
	const postF = along([PLATINE, col(cockPost.c), cockPost.z], X);
	const cockRing: UV[] = [[col(cockPost.c) - 1.8, cockPost.z + 1.8], [col(cockPost.c) + 1.8, cockPost.z + 1.8], [col(cockPost.c) + 1.8, cockPost.z - 1.8], [escY + 1.8, BAL.z - 1.6], [escY - 1.8, BAL.z - 1.6], [escY - 1.8, BAL.z + 1.6]];
	const raquette: UV[] = [[escY - 0.5, BAL.z], [escY + 0.5, BAL.z], [escY + 0.2, BAL.z + 6.4], [escY - 0.2, BAL.z + 6.4]];
	put('echappement.coq', [35, escY - 6, BAL.z + 3], discSvg(postF, 0, 10.6, 1.6) + S(plateOf(F0, [cockRing], 34.6 + 0.0, 35.6), 'mid') + discSvg(along([34.2, stud[1], stud[2]], X), 0, 0.4, 0.6) + S(plateOf(F0, [raquette], 35.6, 36.1), 'hi') + discSvg(along([36.1, escY, BAL.z], X), 0, 0.5, 0.9), [
		discShape('echappement.pilier', postF, 0, 10.6, 1.6),
		prism('echappement.coq', F0, cockRing, 34.6, 35.6),
		discShape('echappement.piton', along([34.2, stud[1], stud[2]], X), 0, 0.4, 0.6),
		prism('echappement.raquette', F0, raquette, 35.6, 36.1),
		discShape('echappement.vis-raquette', along([36.1, escY, BAL.z], X), 0, 0.5, 0.9),
	], { piece: 'echappement', bias: 2 });

	// Massicot : lame et contre-lame de part et d'autre du brin principal.
	const blade: UV[] = [[col(MAIN.c0), 214], [col(MAIN.c0), 220.5], [col(30), 223], [col(30), 216]];
	const counter: UV[] = [[col(MAIN.c1), 214], [col(MAIN.c1 + 8), 214], [col(MAIN.c1 + 8), 220], [col(MAIN.c1), 220]];
	const bladePost = along([PLATINE, col(31.5), 219.5], X);
	// Deux éléments : la contre-lame derrière la bande, la lame devant (vue de la gauche).
	put('massicot.contre-lame', [32, col(44), 217], S(plateOf(F0, [counter], PLATINE, TAPE.x1 + 1), 'mid'), [prism('massicot.contre-lame', F0, counter, PLATINE, TAPE.x1 + 1)], { piece: 'bobine' });
	put('massicot.lame', [32, col(34), 218.5], S(plateOf(F0, [blade], PLATINE + 2, TAPE.x1 + 1), 'mid', screw(TAPE.x1 + 1, col(31.5), 219.5, 0.7)), [
		discShape('massicot.axe', bladePost, 0, 2, 1.4),
		prism('massicot.lame', F0, blade, PLATINE + 2, TAPE.x1 + 1),
	], { piece: 'bobine' });

	// Bobine réceptrice ouverte : flasque arrière, galette, moyeu à trois vis ; palpeur sur la galette.
	const TF = along([PLATINE, col(takeup.c), takeup.z], X);
	put('receptrice.arriere', [PLATINE + 2, col(takeup.c), takeup.z], discSvg(TF, 0, 2, 1.4) + discSvg(TF, 2, 3, takeup.R, 'mid', lineSvg(ringPath(TF, 3, takeup.R - 1.4), { tone: 'faint' })), [
		discShape('receptrice.axe', TF, 0, 2, 1.4),
		discShape('receptrice.flasque', TF, 2, 3, takeup.R),
	], { piece: 'bobine' });
	put('receptrice.galette', [TX, col(takeup.c), takeup.z], discSvg(TF, 3, 13, takeup.pack, 'mid', turns(TF, 13, [5.6, 7.2, 8.7])), [discShape('receptrice.galette', TF, 3, 13, takeup.pack)], { piece: 'bobine' });
	const hubDots = boltsOf(TF, 14.4, 2.6, 3, P, Math.PI / 2);
	put('receptrice.moyeu', [PLATINE + 13.7, col(takeup.c), takeup.z], discSvg(TF, 13, 14.4, 4, 'mid', dotsSvg(hubDots, { size: 0.45, tone: 'hi' })), [discShape('receptrice.moyeu', TF, 13, 14.4, 4)], { piece: 'bobine', ctn: 'hub' });
	// Palpeur : bras pivotant, galet sur la galette, queue devant un seul repère, 1 Mio.
	const feel = { c: 62, z: 150 };
	const contact = (rho: number): UV => {
		const angle = (100 * Math.PI) / 180;
		return [takeup.c + Math.cos(angle) * (rho + 2), takeup.z + Math.sin(angle) * (rho + 2)];
	};
	const [rc, rz] = contact(takeup.pack);
	const dir = [rc - feel.c, rz - feel.z];
	const length = Math.hypot(dir[0], dir[1]);
	const [ux, uz] = [dir[0] / length, dir[1] / length];
	const bar = (c0: number, z0: number, c1: number, z1: number, w: number): UV[] => {
		const [nx, nz] = [-(z1 - z0), c1 - c0];
		const n = Math.hypot(nx, nz);
		const [ox, oz] = [(nx / n) * w, (nz / n) * w];
		return [[col(c0 + ox), z0 + oz], [col(c1 + ox), z1 + oz], [col(c1 - ox), z1 - oz], [col(c0 - ox), z0 - oz]];
	};
	const armRingF = bar(feel.c - ux * 6, feel.z - uz * 6, rc, rz, 1.1);
	const quadrant: UV[] = [[col(feel.c), feel.z], [col(feel.c + 9), feel.z - 2], [col(feel.c + 9.4), feel.z + 3.4], [col(feel.c + 7), feel.z + 7]];
	const markAt = (rho: number) => {
		const [mc, mz] = contact(rho);
		const angle = Math.atan2(mz - feel.z, mc - feel.c) + Math.PI;
		return [Math.cos(angle), Math.sin(angle)];
	};
	const [mx, mz] = markAt(17);
	const mark = onFace(PLATINE + 0.8, [[col(feel.c + mx * 8.2), feel.z + mz * 8.2], [col(feel.c + mx * 6.2), feel.z + mz * 6.2]]);
	plate('palpeur.secteur', PLATINE, PLATINE + 0.8, [quadrant], { piece: 'bobine', extra: lineSvg(mark, { tone: 'hi' }) });
	const pivotF = along([PLATINE, col(feel.c), feel.z], X);
	const rollF = along([PLATINE + 4, col(rc), rz], X);
	put('palpeur', [PLATINE + 15, col((feel.c + rc) / 2), (feel.z + rz) / 2], discSvg(pivotF, 0.8, 14.5, 1.6) + discSvg(rollF, 0, 8, 2) + discSvg(rollF, 8, 10.5, 0.6) + S(plateOf(F0, [armRingF], PLATINE + 14.5, PLATINE + 15.7), 'mid') + discSvg(along([PLATINE + 15.7, col(feel.c), feel.z], X), 0, 0.6, 1.2), [
		discShape('palpeur.pivot', pivotF, 0.8, 14.5, 1.6),
		discShape('palpeur.galet', rollF, 0, 8, 2),
		discShape('palpeur.axe', rollF, 8, 10.5, 0.6),
		prism('palpeur.bras', F0, armRingF, PLATINE + 14.5, PLATINE + 15.7),
		discShape('palpeur.vis', along([PLATINE + 15.7, col(feel.c), feel.z], X), 0, 0.6, 1.2),
	], { piece: 'bobine', bias: 2 });

	// Commutateur rotatif marche-arrêt, moleté, au pied de la colonne.
	const SW = { c: 60, z: 86 };
	const swF = along([PLATINE, col(SW.c), SW.z], X);
	const swKnurl = fadedSvg(knurlOf(swF, 4.2, 9.8, 5, 26, P), { tone: 'lo' });
	const pointer = onFace(PLATINE + 10, [[col(SW.c), SW.z], [col(SW.c) - 2.6, SW.z + 3.4]]);
	put('commutateur', [PLATINE + 5, col(SW.c), SW.z], discSvg(swF, 0, 1.2, 7.4, 'mid', screw(PLATINE + 1.2, col(SW.c) + 5.8, SW.z - 4.4, 0.5)) + discSvg(swF, 1.2, 4.2, 2) + S(solidOf([[4.2, 5], [9.8, 5], [10, 4.4, 1], [10.01, 0]], swF, P), 'mid', swKnurl) + lineSvg(pointer, { tone: 'hi', free: 'end' }), [
		discShape('commutateur.embase', swF, 0, 1.2, 7.4),
		discShape('commutateur.axe', swF, 1.2, 4.2, 2),
		{ kind: 'solid', name: 'commutateur.bouton', F: swF, profile: [[4.2, 5], [9.8, 5], [10, 4.4, 1], [10.01, 0]] },
	]);

	// --- Sonnette sur le chapeau -----------------------------------------------------------------------
	const CHAP = BODY.z1 + 26;
	slab('sonnette.equerre', { x: 22, y: 80, w: 26, d: 110, r: 1.2 }, CHAP, 2, { piece: 'sonnette', bevel: 0.4, extra: screw(46.2, 84, CHAP + 2.01, 0.8) + screw(46.2, 186, CHAP + 2.01, 0.8) });
	// Le timbre est assez haut pour que le marteau frappe son bord par en dessous.
	const GONG: Point3 = [40, 158, CHAP + 22];
	const pillar = cylinder(GONG[0], GONG[1], 2.5, CHAP + 2, 20, P, 20);
	put('sonnette.pilier', [GONG[0], GONG[1], CHAP + 12], S(pillar, 'mid', lineSvg(sideArc(GONG[0], GONG[1], 2.5, CHAP + 4, P, 16), { tone: 'faint' })), [{ kind: 'disc', name: 'sonnette.pilier', F: along([GONG[0], GONG[1], CHAP + 2], Z), s0: 0, s1: 20, r: 2.5 }], { piece: 'sonnette' });
	const gongF = along(GONG, Z);
	const DOME = 14;
	const domeAt = (s: number) => 30 * Math.sqrt(Math.max(0, 1 - (s / DOME) ** 2));
	const domeProfile: number[][] = [[0, 0], [0, 30]];
	for (let k = 1; k <= 12; k++) {
		const s = DOME * (1 - (1 - k / 12) ** 1.6);
		domeProfile.push([s, domeAt(s), 1]);
	}
	domeProfile[domeProfile.length - 1] = [DOME, 0];
	const slope = (s: number) => (-30 * (s / DOME ** 2)) / Math.sqrt(Math.max(1e-4, 1 - (s / DOME) ** 2));
	const dome = solidOf(domeProfile.slice(1, -1), gongF, P, { smooth: { slope, radius: domeAt }, steps: 56 });
	const nutF = along([GONG[0], GONG[1], GONG[2] + DOME - 0.2], Z);
	put('sonnette.timbre', [GONG[0], GONG[1], GONG[2] + 5], S(dome, 'hi'), [{ kind: 'solid', name: 'sonnette.timbre', F: gongF, profile: domeProfile.slice(1, -1) }], { piece: 'sonnette' });
	put('sonnette.ecrou', [GONG[0], GONG[1], GONG[2] + DOME + 1], S(cylinder(GONG[0], GONG[1], 2.6, GONG[2] + DOME - 0.2, 2, P, 6), 'mid') + S(cylinder(GONG[0], GONG[1], 1.1, GONG[2] + DOME + 1.8, 1.2, P, 14), 'mid'), [
		{ kind: 'disc', name: 'sonnette.ecrou', F: nutF, s0: 0, s1: 2, r: 2.6 },
		{ kind: 'disc', name: 'sonnette.tige', F: nutF, s0: 2, s1: 3.2, r: 1.1 },
	], { piece: 'sonnette' });
	// Électro-aimant double sur sa culasse, armature, lame-ressort, marteau et vis de contact.
	const COIL_X = 36;
	slab('sonnette.culasse', { x: 31, y: 99, w: 10, d: 18, r: 0.6 }, CHAP + 2, 2, { piece: 'sonnette', steps: 2, bevel: 0.3 });
	for (const y of [104, 112]) {
		const coilF = along([COIL_X, y, CHAP + 4], Z);
		const coilProfile = [[0, 3.2], [10, 3.2], [10, 1.4], [11.2, 1.4]];
		const windings = [6, 8, 10].map((z) => lineSvg(sideArc(COIL_X, y, 3.2, CHAP + 4 + z / 2 + 2, P, 16), { tone: 'faint' })).join('');
		put(`sonnette.bobine-${y}`, [COIL_X, y, CHAP + 10], turnedSvg(coilF, coilProfile, 'mid', windings), [turnedShape(`sonnette.bobine-${y}`, coilF, coilProfile)], { piece: 'sonnette' });
	}
	slab('sonnette.poteau', { x: 32, y: 92, w: 8, d: 5, r: 0.5 }, CHAP + 2, 9, { piece: 'sonnette', steps: 2, bevel: 0.3 });
	const HAM = PIVOTS.hammer;
	// Armature sur sa lame-ressort, marteau au bout : la boule attend sous le bord du timbre.
	const leaf = { x: 33, y: 96.6, w: 6, d: 0.8, r: 0 };
	const armature = { x: 32, y: 97.4, w: 8, d: 19, r: 0.5 };
	const ARM_Z = HAM[2] - 0.8;
	const stemF = along([COIL_X, 116.4, HAM[2]], Y);
	const BALL_R = 2.4;
	const ballAt: Point3 = [COIL_X, GONG[1] - Math.sqrt(30 ** 2 - (GONG[0] - COIL_X) ** 2), HAM[2]];
	const stemLength = ballAt[1] - 116.4 - Math.sqrt(BALL_R ** 2 - 0.6 ** 2);
	put('sonnette.marteau', [COIL_X, 108, HAM[2]], S(slabOf(leaf, CHAP + 11, ARM_Z - CHAP - 11 + 1.6, P, 1), 'mid') + S(slabOf(armature, ARM_Z, 1.6, P, 2, 0.3), 'mid') + discSvg(stemF, 0, stemLength, 0.6, 'mid') + S(sphereOf(ballAt, BALL_R, P), 'hi'), [
		slabShape('sonnette.lame', leaf, CHAP + 11, ARM_Z - CHAP - 11 + 1.6, 1),
		slabShape('sonnette.armature', armature, ARM_Z, 1.6, 2),
		discShape('sonnette.tige-marteau', stemF, 0, stemLength, 0.6),
		{ kind: 'ball', name: 'sonnette.boule', at: ballAt, r: BALL_R },
	], { piece: 'sonnette', ctn: 'hammer' });
	slab('sonnette.pilier-contact', { x: 26, y: 95, w: 4, d: 4, r: 0.4 }, CHAP + 2, 18, { piece: 'sonnette', steps: 2, bevel: 0.3 });
	const contactF = along([30, 97, CHAP + 17], X);
	const contactProfile = [[0, 1.6], [1.2, 1.6], [1.2, 0.7], [3, 0.7]];
	put('sonnette.vis-contact', [31.5, 97, CHAP + 17], turnedSvg(contactF, contactProfile), [turnedShape('sonnette.vis-contact', contactF, contactProfile)], { piece: 'sonnette' });
	/** Borne à écrou moleté, d'axe z : écrou, puis tige filetée. */
	const terminal = (name: string, x: number, y: number, z: number, r: number, h: number, piece?: string) => {
		const F = along([x, y, z], Z);
		const profile = [[0, r], [h, r], [h, r / 2], [h + 0.8, r / 2]];
		put(name, [x, y, z + h / 2], turnedSvg(F, profile, 'mid', lineSvg(knurl(x, y, r, z, z + h, 14, P, 0.3), { tone: 'faint' })), [turnedShape(name, F, profile)], { piece });
	};
	// Bornes de sonnette.
	for (const y of [86, 92]) terminal(`sonnette.borne-${y}`, 45, y, CHAP + 2, 1.5, 2.2, 'sonnette');
	// Fil commun volets → sonnette : il monte le long du montant droit depuis sa boîte d'entrée,
	// passe sous le chapeau, en ressort par un passe-fil et finit sur la première borne.
	const WIRE_R = 0.35;
	const wire = (name: string, points: Point3[]) => {
		const route = points.length > 2 ? filletOn(points, 2, P, WIRE_R) : points;
		routes.push({ name, points: route, r: WIRE_R, options: { limp: true } });
		tubeOf(route, WIRE_R, P, { maxLength: 400, spacing: 8 }).forEach((piece, chunk) =>
			draws.push({ name: `${name}:${chunk}`, at: piece.mid, svg: tubeSvg(piece, { tone: 'mid' }), shapes: [{ kind: 'tube', name: `${name}:${chunk}`, points: piece.points, radii: piece.radii }], route: name, chunk }),
		);
	};
	slab('fil.boite', { x: FRONT, y: 22.5, w: 2, d: 5, r: 0.5 }, 66, 6, { steps: 2, bevel: 0.3, extra: screw(FRONT + 2, 25, 69, 0.6) });
	wire('fil-montant', [[FRONT + WIRE_R + 0.25, 25, 72], [FRONT + WIRE_R + 0.25, 25, BODY.z1]]);
	const grommetF = along([45, 26, CHAP], Z);
	put('fil.passe-fil', [45, 26, CHAP + 0.5], discSvg(grommetF, 0, 1, 1.3, 'mid', lineSvg(ringPath(grommetF, 1, 0.7), { tone: 'faint' })), [discShape('fil.passe-fil', grommetF, 0, 1, 1.3)]);
	wire('fil-chapeau', [[45, 26, CHAP + 1], [45, 26, CHAP + 3.4], [45, 86 - 1.5, CHAP + 3.4]]);
	// Sélecteur trembleur / coup simple : un petit couteau sur son socle.
	const SEL = PIVOTS.selector;
	slab('sonnette.socle-selecteur', { x: 44, y: 98, w: 4, d: 12, r: 0.4 }, CHAP + 2, 3, { piece: 'sonnette', steps: 2, bevel: 0.3 });
	const knife: UV[] = [[SEL[1] - 0.5, CHAP + 3], [SEL[1] + 0.5, CHAP + 3], [SEL[1] + 0.4, CHAP + 10], [SEL[1] - 0.4, CHAP + 10]];
	put('sonnette.selecteur', [48.5, SEL[1], CHAP + 7], S(plateOf(F0, [knife], 48, 49), 'hi', screw(49, SEL[1], SEL[2], 0.6)), [prism('sonnette.couteau', F0, knife, 48, 49)], { piece: 'sonnette', ctn: 'selector' });
	// Bornier d'entrée des deux crochets (Notification, Stop), hors nomenclature.
	const BORN = { x: 9, y: 49, w: ELBOW[0] * 2 - 18, d: 18, r: 1 };
	slab('bornier', BORN, CHAP, 6, { bevel: 0.4 });
	for (const y of [53, 63]) terminal(`bornier.borne-${y}`, ELBOW[0], y, CHAP + 6, 1.8, 2.4);
	const glandF = along([ELBOW[0], 58, CHAP + 6], Z);
	put('bornier.presse-etoupe', [ELBOW[0], 58, CHAP + 7], discSvg(glandF, 0, GLAND_TOP - CHAP - 6, 2.2), [discShape('bornier.presse-etoupe', glandF, 0, GLAND_TOP - CHAP - 6, 2.2)]);

	return { draws, routes };
}

const tenths = (value: number) => {
	const text = (value / 10).toString();
	return text.replace(/^(-?)0\./, '$1.');
};

/** Écart toléré à la simplification, en dixièmes d'unité du viewBox (sous l'arrondi du kit). */
const SIMPLIFY = 0.6;

/** Douglas-Peucker sur une ligne de points entiers (dixièmes) : garde les deux bouts. */
function simplify(points: Flat[]): Flat[] {
	if (points.length < 3) return points;
	const keep = new Array(points.length).fill(false);
	keep[0] = keep[points.length - 1] = true;
	const stack: Array<[number, number]> = [[0, points.length - 1]];
	while (stack.length) {
		const [from, to] = stack.pop() ?? [0, 0];
		const [ax, ay] = points[from];
		const [bx, by] = points[to];
		const length = Math.hypot(bx - ax, by - ay);
		let worst = -1;
		let far = 0;
		for (let index = from + 1; index < to; index++) {
			const [px, py] = points[index];
			const distance = length ? Math.abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / length : Math.hypot(px - ax, py - ay);
			if (distance > far) [far, worst] = [distance, index];
		}
		if (worst >= 0 && far > SIMPLIFY) {
			keep[worst] = true;
			stack.push([from, worst], [worst, to]);
		}
	}
	return points.filter((_, index) => keep[index]);
}

/**
 * Réécrit un tracé `M…L…Z` du kit (coordonnées absolues arrondies au dixième) en relatif, sans
 * les segments nuls que les fonds des pièces tournées répètent ni les points alignés à moins de
 * 0,06 près : même dessin, bien moins lourd. Un tracé qui contient une autre commande est laissé
 * tel quel.
 */
export function compactPath(d: string) {
	if (/[^MLZ0-9 .\-]/.test(d)) return d;
	const subpaths: Array<{ points: Flat[]; closed: boolean }> = [];
	for (const [, op, args] of d.matchAll(/([MLZ])([^MLZ]*)/g)) {
		if (op === 'Z') {
			const current = subpaths[subpaths.length - 1];
			if (current) current.closed = true;
			continue;
		}
		const [ax, ay] = args.trim().split(/\s+/).map((value) => Math.round(Number(value) * 10));
		if (op === 'M' || !subpaths.length || subpaths[subpaths.length - 1].closed) subpaths.push({ points: [], closed: false });
		const { points } = subpaths[subpaths.length - 1];
		const previous = points[points.length - 1];
		if (!previous || previous[0] !== ax || previous[1] !== ay) points.push([ax, ay]);
	}
	let out = '';
	let last = '';
	let [x, y] = [0, 0];
	const push = (text: string) => {
		const glued = /[a-z]$/.test(out) || text.startsWith('-') || (text.startsWith('.') && last.includes('.'));
		out += glued ? text : ` ${text}`;
		last = text;
	};
	for (const { points, closed } of subpaths) {
		// Une ligne fermée se simplifie en deux moitiés, pour garder un point d'appui de chaque côté.
		const half = Math.floor(points.length / 2);
		const kept = closed && points.length > 4 ? [...simplify(points.slice(0, half + 1)), ...simplify([...points.slice(half), points[0]]).slice(1, -1)] : simplify(points);
		kept.forEach(([ax, ay], index) => {
			if (!index) out += 'm';
			push(tenths(ax - x));
			push(tenths(ay - y));
			[x, y] = [ax, ay];
		});
		if (closed) {
			out += 'z';
			[x, y] = kept[0];
		}
	}
	return out;
}

export const compactSvg = (svg: string) => svg.replace(/ d="([^"]*)"/g, (_, d: string) => ` d="${compactPath(d)}"`);

let cached: RestFigure | null = null;

/** La figure au repos : l'ordre de peinture vient de l'audit (profondeur vraie des recouvrements). */
export function renderRest(): RestFigure {
	if (cached) return cached;
	const { width, height, ...camera } = FIT;
	const fitted = fitProjection(EXTREMES, width, height, camera);
	if (Math.abs(fitted.scale - P.scale) > 1e-9 || fitted.origin.some((value, axis) => Math.abs(value - P.origin[axis]) > 1e-6)) {
		throw new Error(`Anatomie « claude-tmux-notify » : la caméra de layout.ts ne cadre plus la figure (attendu ${JSON.stringify(fitted)})`);
	}
	const built = scene();
	const keys: number[] = settledKeys(P, built);
	const order = built.draws.map((draw, index) => ({ draw, key: keys[index] ?? depthOf(draw.at, P) })).sort((a, b) => a.key - b.key);
	cached = { width: WIDTH, height: HEIGHT, body: compactSvg(order.map(({ draw }) => draw.svg).join('')) };
	return cached;
}

export { P as projection };
