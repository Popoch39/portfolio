// Géométrie du meuble à fiches, au repos : le tiroir 1 sorti, ses fiches levées, la fiche de
// demande engagée dans le gabarit. Elle tourne au build Astro et sous Node (audit : `audit.mjs`).
//
// La figure est un arbre : des pièces dessinées (`Item`, avec la forme vraie que l'audit enregistre)
// et des groupes que le mouvement déplace (`data-*`). L'ordre de l'arbre est l'ordre de peinture.
import {
	cylinder,
	extrude,
	faceTextSvg,
	haloOf,
	insetPlan,
	iso,
	knurl,
	lineOnTop,
	lineSvg,
	pathOf,
	planOutline,
	pointsAt,
	sideMatrix,
	sideRing,
	sideSeam,
	slabOf,
	solidSvg,
	translateAlong,
	dotsSvg,
	fadedSvg,
	type Plan,
	type Plane,
	type Point3,
	type SolidPaths,
	type SolidStyle,
} from '../../vendor/anatomy/iso-kit.ts';
import * as G from '../../vendor/anatomy/lathe.mjs';
import type { RestFigure } from '../contract.ts';
import { pieceSvg } from '../piece.ts';
import {
	BIN,
	BIN_Z,
	BODY_BOTTOM,
	BODY_TOP,
	CARD_LIFT,
	CARD_PITCH,
	CARD_STAIR,
	CARD_X0,
	CARD_Y,
	CARDS,
	CHUTE,
	chuteZ,
	DEPTH,
	FLAP_HINGE,
	flapPath,
	FRAME,
	HEIGHT,
	HOLE_DEPTH,
	holeX,
	HOME,
	openings,
	OUTLET,
	PIN_COUNT,
	PLINTH,
	projection as P,
	REJECT,
	REJECT_START,
	REQUEST,
	restDrop,
	SLOT_BOX,
	SLOT_TOP,
	SPAN,
	STILE,
	TOP,
	TOTALIZER,
	TOTALIZER_Z,
	TRAVEL,
	WHEEL_PITCH,
	WIDTH,
	WINDOW_Z,
	WINDOWS,
	type Opening,
} from './layout.ts';
import { FIELDS, notched, pageRequest, pieceOf, REST_PAGE, TOTAL, pagesOf } from './model.ts';

/** Une forme vraie, enregistrée par l'audit (`audit.mjs` la traduit en forme du kit). */
export type Shape =
	| { kind: 'slab'; plan: Plan; z: number; h: number; steps: number; cut?: Shape[] }
	| { kind: 'ring'; ring: Plane[]; z: number; h: number }
	| { kind: 'disc'; o: Point3; a: Point3; s0: number; s1: number; r: number }
	| { kind: 'prism'; o: Point3; a: Point3; u: Point3; v: Point3; poly: Plane[]; s0: number; s1: number };

export interface Item {
	kind: 'item';
	name: string;
	piece: string | null;
	/** Pièces solidaires (l'audit tolère qu'elles se pénètrent : la fiche et ses encoches, une broche et son guide). */
	owner?: string;
	/** Ce qui passe sous ce plan (z, en place) est caché dans une fente ou un guide, et rogné au dessin. */
	floor?: number;
	svg: string;
	shapes: Shape[];
}

export interface Group {
	kind: 'group';
	attrs: Record<string, string>;
	/** Décalage au repos, en unités du monde : écrit en `transform` et appliqué aux formes de l'audit. */
	offset?: Point3;
	/** Pour l'audit : ce groupe est la partie éclatée de la figure (les fiches levées). */
	lift?: Point3;
	children: Node[];
}

export type Node = Item | Group;

// ——— Briques ———

const solid = (paths: SolidPaths, style: SolidStyle = {}) => solidSvg(paths, style);
const slabShape = (plan: Plan, z: number, h: number, steps = 8): Extract<Shape, { kind: 'slab' }> => ({ kind: 'slab', plan, z, h, steps });

/** Un pavé arrondi : son dessin et sa forme. */
function block(plan: Plan, z: number, h: number, style: SolidStyle & { steps?: number; bevel?: number } = {}) {
	const { steps = 3, bevel = 0, ...rest } = style;
	return { svg: solid(slabOf(plan, z, h, P, steps, bevel), rest), shape: slabShape(plan, z, h, steps) };
}

/** Un disque (pièce tournée) sur un axe quelconque. */
function round(o: Point3, a: Point3, s0: number, s1: number, r: number, style: SolidStyle = {}, steps = 16) {
	const F = G.frameAlong(o, a);
	return { svg: solid(G.disc(s0, s1, r, F, P, { steps }), style), shape: { kind: 'disc', o, a, s0, s1, r } as Shape, F };
}

/** Un prisme dans le plan (y, z), extrudé le long de x : goulotte, fiche refusée. */
function prismYZ(poly: Plane[], x0: number, x1: number, style: SolidStyle = {}) {
	const frame = { o: [0, 0, 0] as Point3, a: [1, 0, 0] as Point3, u: [0, 1, 0] as Point3, v: [0, 0, 1] as Point3 };
	return {
		svg: solid(G.prismOf(frame, poly, x0, x1, P), style),
		shape: { kind: 'prism', ...frame, poly, s0: x0, s1: x1 } as Shape,
	};
}

const item = (name: string, piece: string | null, parts: { svg: string; shape?: Shape }[], extra: { owner?: string; svg?: string; floor?: number } = {}): Item => ({
	kind: 'item',
	name,
	piece,
	owner: extra.owner,
	floor: extra.floor,
	svg: parts.map((part) => part.svg).join('') + (extra.svg ?? ''),
	shapes: parts.flatMap((part) => (part.shape ? [part.shape] : [])),
});

const group = (attrs: Record<string, string>, children: Node[], extra: { offset?: Point3; lift?: Point3 } = {}): Group => ({ kind: 'group', attrs, children, ...extra });

/** Un polygone sur une face verticale d'abscisse y fixe, donné en (x, z). */
const faceY = (y: number, points: [number, number][], closed = true) => pathOf(points.map(([x, z]) => iso([x, y, z], P)), closed);
/** Un polygone sur une face verticale d'abscisse x fixe, donné en (y, z). */
const faceX = (x: number, points: [number, number][], closed = true) => pathOf(points.map(([y, z]) => iso([x, y, z], P)), closed);
const rect = (a0: number, a1: number, z0: number, z1: number): [number, number][] => [
	[a0, z0],
	[a1, z0],
	[a1, z1],
	[a0, z1],
];
const dots = (points: Point3[], size = 0.5, tone: 'mid' | 'lo' | 'hi' | 'faint' = 'mid') => dotsSvg(pointsAt(points, P), { size, tone });
/** Une surface sombre (intérieur, fente) peinte au ton le plus foncé des faces. */
const dark = (d: string, shade = 0) => `<path class="iso-shade" data-shade="${shade}" d="${d}"/>`;
const paper = (d: string) => `<path class="iso-fill" d="${d}"/>`;

// ——— Socle ———

const PLINTH_PLAN: Plan = { x: 12, y: 12, w: DEPTH - 24, d: SPAN - 24, r: 1 };

function base(): Node[] {
	// Sabots de laiton : deux plaques pliées sur l'angle de la plinthe, contre ses faces.
	const [x1, y1] = [PLINTH_PLAN.x + PLINTH_PLAN.w, PLINTH_PLAN.y + PLINTH_PLAN.d];
	const plates: Plan[][] = [
		[
			{ x: x1, y: y1 - 7, w: 1, d: 8, r: 0 },
			{ x: x1 - 7, y: y1, w: 8, d: 1, r: 0 },
		],
		[{ x: x1, y: PLINTH_PLAN.y - 1, w: 1, d: 8, r: 0 }],
		[{ x: PLINTH_PLAN.x - 1, y: y1, w: 8, d: 1, r: 0 }],
	];
	const shoes = plates.map((list, index) => item(`socle.sabot#${index + 1}`, 'corps', list.map((plan) => block(plan, 0, 13, { tone: 'lo', steps: 1 }))));
	return [
		item('stand.plinthe', 'corps', [block(PLINTH_PLAN, 0, PLINTH, { tone: 'lo', steps: 2 })], {
			owner: 'socle',
			svg: lineSvg(sideSeam(PLINTH_PLAN, 13, P, 2), { tone: 'faint' }),
		}),
		...shoes,
		item('socle.moulure', 'corps', [
			block(insetPlan({ x: 0, y: 0, w: DEPTH, d: SPAN, r: 0 }, 9), PLINTH, 2.5, { tone: 'lo', steps: 2 }),
			block(insetPlan({ x: 0, y: 0, w: DEPTH, d: SPAN, r: 1 }, 4), PLINTH + 2.5, BODY_BOTTOM - PLINTH - 2.5, { tone: 'mid', steps: 2, bevel: 0.6 }),
		]),
	];
}

// ——— Caisson : flanc, façade, ouvertures ———

const BODY: Plan = { x: 0, y: 0, w: DEPTH, d: SPAN, r: 1.5 };
/** Profondeur des ouvertures derrière le cadre de façade. */
const RECESS = 40;
const PANELS: [number, number][] = [
	[66, 250],
	[272, 364],
];

/** Les ouvertures, du fond vers le lecteur : la colonne du fond, puis celle du flanc, du bas vers le haut. */
const byDepth = [...openings].sort((a, b) => a.y0 - b.y0 || a.z0 - b.z0);

function carcass(): Node[] {
	// Le caisson est creusé de ses six ouvertures ; leurs parois ne se voient que par elles.
	const body = block(BODY, BODY_BOTTOM, BODY_TOP - BODY_BOTTOM, { tone: 'mid', steps: 3 });
	const cavities = openings.map(({ y0, y1, z0, z1 }) => slabShape({ x: DEPTH - RECESS, y: y0, w: RECESS + 1, d: y1 - y0, r: 0 }, z0, z1 - z0, 1));
	const shape: Shape = { ...slabShape(BODY, BODY_BOTTOM, BODY_TOP - BODY_BOTTOM, 3), cut: cavities };
	return [
		item('corps.caisson', 'corps', [{ svg: body.svg, shape }], {
			// La rainure d'assemblage court d'une arête à l'autre, sur le flanc contre la façade.
			svg: lineSvg(pathOf([iso([DEPTH - 8, SPAN, BODY_BOTTOM], P), iso([DEPTH - 8, SPAN, BODY_TOP], P)]), { tone: 'faint' }) + byDepth.map(recessSvg).join(''),
		}),
	];
}

function flank(): Node[] {
	// Poignée de levage en laiton, au milieu du panneau du bas : deux platines, deux pattes, l'anse.
	const face = SPAN + 2.5;
	const [hx0, hx1, hz] = [168, 232, 176];
	const handle = [hx0, hx1].flatMap((x) => [
		block({ x: x - 5, y: face, w: 10, d: 1, r: 1.5 }, hz - 6, 12, { tone: 'lo', steps: 2 }),
		block({ x: x - 1.5, y: face + 1, w: 3, d: 6, r: 0.6 }, hz - 1.5, 3, { tone: 'mid', steps: 1 }),
	]);
	const bail = block({ x: hx0 - 1.5, y: face + 7, w: hx1 - hx0 + 3, d: 3, r: 1.2 }, hz - 1.8, 3.6, { tone: 'mid', steps: 2, bevel: 0.3 });
	const screws = dots(
		[hx0, hx1].flatMap((x): Point3[] => [
			[x, face + 1, hz + 4],
			[x, face + 1, hz - 4],
		]),
		0.5,
	);
	const panels = PANELS.map(([z0, z1], index) => {
		const plan: Plan = { x: 28, y: SPAN, w: DEPTH - 56, d: 2.5, r: 0.5 };
		// La plate-bande : le chanfrein du champ, puis le champ lui-même.
		const field = faceY(SPAN + 2.5, rect(40, DEPTH - 40, z0 + 11, z1 - 11)) + faceY(SPAN + 2.5, rect(47, DEPTH - 47, z0 + 17, z1 - 17));
		return item(`corps.panneau#${index + 1}`, 'corps', [block(plan, z0, z1 - z0, { tone: 'mid', steps: 2, bevel: 0.5, inner: lineSvg(field, { tone: 'faint' }) })]);
	});
	return [...panels, item('corps.poignee-flanc', 'corps', handle, { svg: screws }), item('corps.anse', 'corps', [bail])];
}

/** Le cadre de façade : montants et traverses en saillie de 3 sur le caisson. */
const frameMember = (name: string, plan: Plan, z: number, h: number) => item(name, 'corps', [block({ ...plan, x: DEPTH, w: FRAME }, z, h, { tone: 'mid', steps: 2 })]);

/** Les glissières fixes au fond des ouvertures, puis les montants et les traverses qui les bordent. */
function facade(): Node[] {
	const stiles = [0, SPAN / 2 - STILE / 2, SPAN - STILE].map((y, index) => frameMember(`corps.montant#${index + 1}`, { x: DEPTH, y, w: FRAME, d: STILE, r: 0.4 }, BODY_BOTTOM, BODY_TOP - BODY_BOTTOM));
	const rails: [number, number][] = [];
	const bottoms = [...new Set(openings.map((opening) => opening.z0))].sort((a, b) => a - b);
	const tops = [...new Set(openings.map((opening) => opening.z1))].sort((a, b) => a - b);
	rails.push([BODY_BOTTOM, bottoms[0]]);
	for (let index = 0; index < tops.length - 1; index++) rails.push([tops[index], bottoms[index + 1]]);
	rails.push([tops[tops.length - 1], BODY_TOP]);
	// Une traverse par colonne, entre les montants.
	const columns = [...new Set(openings.map((opening) => opening.y0))].map((y0) => openings.find((opening) => opening.y0 === y0) as Opening);
	const traverses = rails.flatMap(([z0, z1], row) =>
		columns.map(({ y0, y1 }, column) => frameMember(`corps.traverse#${row * 2 + column + 1}`, { x: DEPTH, y: y0, w: FRAME, d: y1 - y0, r: 0 }, z0, z1 - z0)),
	);
	// Au même nu, du fond vers le lecteur : chaque montant cache le bout des traverses qu'il borde.
	const members = [...stiles.map((node, index) => ({ node, y: [0, SPAN / 2 - STILE / 2, SPAN - STILE][index] + STILE / 2 })), ...traverses.map((node, index) => ({ node, y: (columns[index % 2].y0 + columns[index % 2].y1) / 2 }))];
	return [...byDepth.map(fixedSlides), ...members.sort((a, b) => a.y - b.y).map(({ node }) => node)];
}

/** L'intérieur d'une ouverture : faux-fond sombre, plancher et paroi du fond, rognés à l'ouverture. */
function recessSvg(opening: Opening) {
	const { y0, y1, z0, z1, drawer } = opening;
	const back = DEPTH - RECESS;
	const svg = [
		dark(faceX(DEPTH, rect(y0, y1, z0, z1))),
		dark(pathOf([iso([DEPTH, y0, z0], P), iso([DEPTH, y1, z0], P), iso([back, y1, z0], P), iso([back, y0, z0], P)], true), 2),
		dark(pathOf([iso([DEPTH, y0, z0], P), iso([back, y0, z0], P), iso([back, y0, z1], P), iso([DEPTH, y0, z1], P)], true), 1),
		lineSvg(pathOf([iso([DEPTH, y0, z0], P), iso([back, y0, z0], P), iso([back, y1, z0], P)]), { tone: 'lo' }),
		lineSvg(pathOf([iso([back, y0, z0], P), iso([back, y0, z1], P)]), { tone: 'lo' }),
	].join('');
	return `<g clip-path="url(#trekker-ouverture-${drawer})">${svg}</g>`;
}

/** Les membres fixes des deux glissières, vissés aux parois de l'ouverture, et leurs butées à tampon. */
function fixedSlides(opening: Opening): Node {
	const { y0, y1, z0, drawer } = opening;
	const back = DEPTH - RECESS;
	const rail = block({ x: back, y: y0, w: RECESS - 4, d: 2, r: 0 }, z0 + 34, 10, { tone: 'lo', steps: 1 });
	// Le membre fixe du devant affleure au nu du cadre : le membre intermédiaire vient y porter.
	const stop = block({ x: DEPTH - 4, y: y0, w: 4, d: 3.2, r: 0 }, z0 + 32, 14, { tone: 'mid', steps: 1 });
	const nearRail = block({ x: back, y: y1 - 2.6, w: RECESS + FRAME, d: 2.6, r: 0 }, z0 + 34, 10, { tone: 'lo', steps: 1 });
	return group({ 'clip-path': `url(#trekker-ouverture-${drawer})` }, [item(`glissieres.fixe#${drawer}`, 'glissieres', [nearRail, rail, stop])]);
}

// ——— Façade d'un tiroir (fermée, ou à l'avant du tiroir tiré) ———

/** Façades en applique : elles recouvrent l'ouverture de 2 et viennent contre le cadre. */
const FRONT_LAP = 2;
const FRONT_X = DEPTH + FRAME + 5.5;

function drawerFront(opening: Opening, prefix: string): Node[] {
	const { y0, y1, z0, z1 } = opening;
	const yc = (y0 + y1) / 2;
	const front = block({ x: DEPTH + FRAME, y: y0 - FRONT_LAP, w: FRONT_X - DEPTH - FRAME, d: y1 - y0 + FRONT_LAP * 2, r: 0.8 }, z0 - FRONT_LAP, z1 - z0 + FRONT_LAP * 2, {
		tone: 'mid',
		steps: 2,
		bevel: 0.8,
	});
	// Porte-étiquette : un cadre de laiton riveté, sa carte à trois filets (du texte).
	const holder = { y0: yc - 24, y1: yc + 24, z0: z1 - 31, z1: z1 - 14 };
	const frame = block({ x: FRONT_X, y: holder.y0, w: 1.2, d: holder.y1 - holder.y0, r: 0 }, holder.z0, holder.z1 - holder.z0, { tone: 'lo', steps: 1 });
	const cardFace = FRONT_X + 1.2;
	const label = [
		lineSvg(faceX(cardFace, rect(holder.y0 + 2.4, holder.y1 - 2.4, holder.z0 + 2, holder.z1 - 2)), { tone: 'faint' }),
		...[0, 1, 2].map((index) => {
			const z = holder.z1 - 5.5 - index * 3.6;
			const length = [30, 22, 26][index];
			return lineSvg(faceX(cardFace, [[holder.y1 - 6, z], [holder.y1 - 6 - length, z]], false), { tone: 'lo', free: true });
		}),
	].join('');
	const rivets = dots(
		[
			[cardFace, holder.y0 + 1.2, (holder.z0 + holder.z1) / 2],
			[cardFace, holder.y1 - 1.2, (holder.z0 + holder.z1) / 2],
		],
		0.5,
	);
	// Poignée en coquille : un demi-bol de laiton qui sort de la façade, creux dessous.
	const cupZ = z1 - 50;
	const cup: Plane[] = Array.from({ length: 9 }, (_, index) => {
		const angle = (index / 8) * Math.PI;
		return [FRONT_X + 7.5 * Math.sin(angle), yc + 17 * Math.cos(angle)];
	});
	const pull = { svg: solid(extrude(cup, cupZ, 10, P), { tone: 'mid', crease: 'lo' }), shape: { kind: 'ring', ring: cup, z: cupZ, h: 10 } as Shape };
	const hollow = dark(pathOf([iso([FRONT_X, yc - 15, cupZ], P), iso([FRONT_X + 5, yc - 11, cupZ], P), iso([FRONT_X + 5, yc + 11, cupZ], P), iso([FRONT_X, yc + 15, cupZ], P)], true), 0);
	// Bouton de tige, sous la poignée : le bout de la tige qui traverse le pied des fiches. La tige
	// elle-même reste invisible, cachée par la joue du devant.
	const knob = round([FRONT_X, yc, z0 + 18], [1, 0, 0], 0, 4.5, 3.8, { tone: 'mid', crease: 'lo' }, 10);
	const face = lineSvg(G.circleOf(knob.F, 4.5, 2, P, 10), { tone: 'lo' });
	return [
		item(`${prefix}.facade`, 'corps', [front, frame], { svg: label + rivets }),
		group({ 'data-pull': '' }, [item(`${prefix}.poignee`, 'corps', [pull], { svg: hollow })]),
		item(`${prefix}.bouton`, 'tige', [knob], { svg: face }),
	];
}

// ——— Le tiroir tiré : caisson, glissières, tige, presse-fiches, tracés, fiches ———

const BOX_X0 = 44;
/** Le caisson du tiroir s'arrête contre sa façade en applique. */
const BOX_X1 = DEPTH + FRAME;
const BOX = (opening: Opening) => ({ y0: opening.y0 + 5, y1: opening.y1 - 5, z0: opening.z0 + 3, side: opening.z0 + 88, floor: opening.z0 + 9 });

function drawerBody(opening: Opening): { back: Node[]; cards: Node; front: Node[] } {
	const { y0, y1, z0 } = opening;
	const yc = (y0 + y1) / 2;
	const b = BOX(opening);
	const near = b.y1 - 6;
	const floor = block({ x: BOX_X0, y: b.y0, w: BOX_X1 - BOX_X0, d: b.y1 - b.y0, r: 0.6 }, b.z0, 6, { tone: 'lo', steps: 2 });
	const farSide = block({ x: BOX_X0, y: b.y0, w: BOX_X1 - BOX_X0, d: 6, r: 0.5 }, b.floor, b.side - b.floor, { tone: 'mid', steps: 2, bevel: 0.4 });
	const backPanel = block({ x: BOX_X0, y: b.y0 + 6, w: 6, d: b.y1 - b.y0 - 12, r: 0.4 }, b.floor, b.side - 4 - b.floor, { tone: 'mid', steps: 2 });
	const partition = block({ x: 280, y: b.y0 + 6, w: 4, d: b.y1 - b.y0 - 12, r: 0.4 }, b.floor, 62, { tone: 'mid', steps: 2, bevel: 0.3 });
	// Feuillets de tracé pliés en accordéon : ils restent au fond pendant que les fiches montent.
	const traces = [0, 1, 2].map((index) => {
		const plan: Plan = { x: 64 + index * 70, y: b.y0 + 14, w: 58, d: b.y1 - b.y0 - 28, r: 0.4 };
		const h = 7 + index * 3;
		const folds = [1, 2, 3, 4].map((fold) => lineOnTop([plan.x + fold * 11.6, plan.y], [plan.x + fold * 11.6, plan.y + plan.d], b.floor + h, P)).join('');
		return item(`fiche-resume.trace#${index + 1}`, 'fiche-resume', [block(plan, b.floor, h, { tone: 'mid', steps: 2, inner: lineSvg(folds, { tone: 'faint' }) })]);
	});
	// Presse-fiches : la plaque qui serre les fiches vers l'avant, dépassant des joues, et son patin.
	const press = block({ x: CARD_X0 - 10, y: yc - 56, w: 4, d: 112, r: 0.6 }, b.floor, 90, { tone: 'hi', steps: 2, bevel: 0.4 });
	const shoe = block({ x: CARD_X0 - 16, y: yc - 9, w: 6, d: 18, r: 1 }, b.floor, 16, { tone: 'hi', steps: 2 });
	// Joue du devant et ses queues d'aronde contre la façade.
	const nearSide = block({ x: BOX_X0, y: near, w: BOX_X1 - BOX_X0, d: 6, r: 0.5 }, b.floor, b.side - b.floor, { tone: 'mid', steps: 2, bevel: 0.4 });
	const tails = [0, 1, 2, 3].map((index) => {
		const zA = b.floor + 8 + index * 19;
		return faceY(near + 6, [
			[BOX_X1, zA],
			[BOX_X1 - 9, zA - 2.5],
			[BOX_X1 - 9, zA + 11.5],
			[BOX_X1, zA + 9],
		]);
	});
	// Glissière du devant : le membre mobile vissé à la joue, le membre intermédiaire (demi-course)
	// et sa cage à billes ; une butée à tampon à son bout.
	const slideY = near + 6;
	const inner = block({ x: 60, y: slideY, w: 330, d: 1.2, r: 0.2 }, z0 + 34, 10, { tone: 'lo', steps: 2 });
	const middle = block({ x: 70, y: slideY + 1.2, w: 320, d: 1.2, r: 0.2 }, z0 + 35, 8, { tone: 'mid', steps: 2 });
	const pad = block({ x: 386, y: slideY + 2.4, w: 4, d: 1.4, r: 0.4 }, z0 + 33, 12, { tone: 'mid', steps: 2 });
	const balls = dots(
		Array.from({ length: 9 }, (_, index): Point3 => [330 + index * 6, slideY + 2.4, z0 + 39]),
		0.55,
	);
	const back: Node[] = [
		item('corps.tiroir.fond', 'corps', [floor, farSide, backPanel]),
		group({ 'data-traces': '' }, traces),
		item('corps.tiroir.cloison', 'corps', [partition]),
		item('tige.presse', 'tige', [shoe, press]),
	];
	const front: Node[] = [
		item('corps.tiroir.joue', 'corps', [nearSide], { svg: lineSvg(tails.join(''), { tone: 'faint' }) }),
		item('glissieres.mobile', 'glissieres', [inner]),
		group({ 'data-middle': '' }, [item('glissieres.intermediaire', 'glissieres', [middle, pad], { svg: balls })], { offset: [-TRAVEL / 2, 0, 0] }),
	];
	return { back, cards: cardStack(opening), front };
}

/** Les vingt fiches résumé, onglets décalés par tiers, et la fiche-guide en tête. */
function cardStack(opening: Opening): Node {
	const { y0, y1 } = opening;
	const yc = (y0 + y1) / 2;
	const floor = BOX(opening).floor;
	const width = 125;
	const height = 75;
	const cards: Node[] = [];
	for (let index = 0; index < CARDS; index++) {
		const x = CARD_X0 + index * CARD_PITCH;
		const guide = index === CARDS - 1;
		const plan: Plan = { x, y: yc - width / 2, w: 1.2, d: width, r: 0 };
		const tabWidth = guide ? 40 : 30;
		const tabY = guide ? yc - tabWidth / 2 : yc - width / 2 + 6 + (index % 3) * ((width - 12 - tabWidth) / 2);
		const tab: Plan = { x, y: tabY, w: 1.2, d: tabWidth, r: 0 };
		const face = x + 1.2;
		// Le nom de l'itinéraire, écrit sur l'onglet (du texte) : seul l'onglet dépasse de la fiche de devant.
		const tabTop = floor + height + (guide ? 13 : 8);
		const rule = lineSvg(faceX(face, [[tabY + tabWidth - 5, tabTop - 4], [tabY + 5, tabTop - 4]], false), { tone: 'lo', free: true });
		const parts = [block(plan, floor, height, { tone: guide ? 'hi' : 'mid', steps: 1, crease: 'none' }), block(tab, floor + height, tabTop - floor - height, { tone: guide ? 'hi' : 'mid', steps: 1, crease: 'none' })];
		const lift = CARD_STAIR * (CARDS - 1 - index);
		cards.push(group({ 'data-card': String(index) }, [item(`fiche-resume.fiche#${index + 1}`, 'fiche-resume', parts, { svg: rule })], { offset: [0, 0, lift] }));
	}
	return group({ 'data-cards': '' }, cards, { offset: [0, 0, CARD_LIFT], lift: [0, 0, CARD_LIFT] });
}

/** Le tiroir tiré entier, construit dans l'ouverture 1 et rogné à ce qui sort de la façade. */
function pulledDrawer(): { node: Node; clip: string } {
	const body = drawerBody(HOME);
	const front = drawerFront(HOME, 'tire');
	const { y0, y1, z0, z1 } = HOME;
	// Tout ce qui sort de l'ouverture : l'ouverture balayée vers le lecteur. Ce qui reste dans le
	// caisson ne se voit que par elle. Les fiches ne se lèvent que tiroir sorti : au-dessus de
	// l'ouverture, seul compte ce qui est déjà loin devant la façade.
	const far = DEPTH + TRAVEL + 40;
	const sweep = (x0: number, za: number, zb: number) =>
		pathOf(
			G.hullOf(
				[x0, far].flatMap((x): Point3[] => [
					[x, y0, za],
					[x, y1, za],
					[x, y1, zb],
					[x, y0, zb],
				]).map((point) => iso(point, P)),
			),
			true,
		);
	// Entre le caisson et le nu du cadre, seul se voit ce qui est dans l'ouverture : le cadre cache le reste.
	const opening = faceX(DEPTH, rect(y0, y1, z0, z1));
	const clip = `<path d="${opening}"/><path d="${sweep(DEPTH + FRAME, z0, z1)}"/><path d="${sweep(DEPTH + CARD_X0 - 160, z1 - 20, z1 + 120)}"/>`;
	const node = group({ 'data-drawer': '', 'clip-path': 'url(#trekker-tiroir)' }, [
		group({ 'data-pull-out': '' }, [...body.back, body.cards, ...body.front, ...front], { offset: [TRAVEL, 0, 0] }),
	]);
	return { node, clip };
}

// ——— Corniche et dessus ———

function cornice(): Node[] {
	const grow = (by: number): Plan => ({ x: -by, y: -by, w: DEPTH + by * 2, d: SPAN + by * 2, r: 1 + by / 4 });
	const brass = (
		[
			[DEPTH + 5, SPAN + 5, -1, -1],
			[DEPTH + 5, -5, -1, 1],
			[-5, SPAN + 5, 1, -1],
		] as [number, number, number, number][]
	).map(([x, y, sx, sy], index) => {
		const legX: Plan = { x: sx < 0 ? x - 20 : x, y: sy < 0 ? y - 5 : y, w: 20, d: 5, r: 0.4 };
		const legY: Plan = { x: sx < 0 ? x - 5 : x, y: sy < 0 ? y - 20 : y, w: 5, d: 20, r: 0.4 };
		return item(`corps.corniere#${index + 1}`, 'corps', [block(legX, TOP, 1.2, { tone: 'lo', steps: 1 }), block(legY, TOP, 1.2, { tone: 'lo', steps: 1 })], {
			owner: 'corniere',
			svg: dots(
				[
					[legX.x + legX.w / 2 + sx * 4, legX.y + 2.5, TOP + 1.2],
					[legY.x + 2.5, legY.y + legY.d / 2 + sy * 4, TOP + 1.2],
				],
				0.5,
			),
		});
	});
	return [
		item('corps.corniche', 'corps', [
			block(grow(3), BODY_TOP, 5, { tone: 'mid', steps: 2 }),
			block(grow(8), BODY_TOP + 5, 9, { tone: 'mid', steps: 3, bevel: 1 }),
			block(grow(5), BODY_TOP + 14, TOP - BODY_TOP - 14, { tone: 'mid', steps: 3, bevel: 1.2, inner: lineSvg(planOutline(insetPlan(grow(5), 14), TOP, P, 3), { tone: 'faint' }) }),
		]),
		...brass,
	];
}

// ——— Flanc : totalisateur et bac de rejet ———

function wheelSvg(window: (typeof WINDOWS)[number], first: number, value: number[]) {
	const face = TOTALIZER.y + TOTALIZER.d;
	const width = (window.x1 - window.x0) / window.wheels;
	const size = 15;
	const corners = rect(window.x0, window.x1, WINDOW_Z[0], WINDOW_Z[1]);
	const clipId = `trekker-fenetre-${first}`;
	const clip = `<clipPath id="${clipId}"><path d="${faceY(face, corners)}"/></clipPath>`;
	const wheels = Array.from({ length: window.wheels }, (_, index) => {
		const x = window.x0 + width * (index + 0.5);
		const digits = Array.from({ length: 11 }, (_, digit) => `<text class="iso-face-text" data-tone="hi" x="0" y="${digit * WHEEL_PITCH}" font-size="${size}" text-anchor="middle">${digit % 10}</text>`).join('');
		// Le chiffre k se lit quand la colonne est remontée de k pas : `translate(0, -k·pas)`.
		return `<g transform="${sideMatrix([x, face], WINDOW_Z[0] + (WHEEL_PITCH - size * 0.7) / 2, P, 'left')}"><g data-wheel="${first + index}" transform="translate(0 ${-value[index] * WHEEL_PITCH})">${digits}</g></g>`;
	}).join('');
	// La courbure de la roue : le haut et le bas de la fenêtre s'assombrissent.
	const shade = [
		dark(faceY(face, rect(window.x0, window.x1, WINDOW_Z[1] - 3, WINDOW_Z[1])), 1),
		dark(faceY(face, rect(window.x0, window.x1, WINDOW_Z[0], WINDOW_Z[0] + 3)), 1),
	].join('');
	const separators = Array.from({ length: window.wheels - 1 }, (_, index) => {
		const x = window.x0 + width * (index + 1);
		return lineSvg(faceY(face, [[x, WINDOW_Z[0]], [x, WINDOW_Z[1]]], false), { tone: 'lo' });
	}).join('');
	const back = paper(faceY(face, corners));
	return `<defs>${clip}</defs>${back}<g clip-path="url(#${clipId})">${wheels}${shade}</g>${separators}${lineSvg(faceY(face, corners), { tone: 'mid' })}`;
}

/** Les chiffres d'un nombre sur `count` roues, de la plus forte à la plus faible. */
export const digitsOf = (value: number, count: number) => Array.from({ length: count }, (_, index) => Math.floor(value / 10 ** (count - 1 - index)) % 10);

function flankParts(): Node[] {
	const plate: Plan = { x: TOTALIZER.x - 6, y: SPAN + 2.5, w: TOTALIZER.w + 12, d: 2, r: 1 };
	const plateZ = [TOTALIZER_Z[0] - 10, TOTALIZER_Z[1] + 10] as const;
	const housing = block(TOTALIZER, TOTALIZER_Z[0], TOTALIZER_Z[1] - TOTALIZER_Z[0], { tone: 'mid', steps: 3, bevel: 0.8 });
	const screws = dots(
		[
			[plate.x + 3, plate.y + 2, plateZ[0] + 3],
			[plate.x + plate.w - 3, plate.y + 2, plateZ[0] + 3],
			[plate.x + 3, plate.y + 2, plateZ[1] - 3],
			[plate.x + plate.w - 3, plate.y + 2, plateZ[1] - 3],
		],
		0.55,
	);
	const pages = pagesOf(TOTAL);
	const windows = wheelSvg(WINDOWS[0], 0, digitsOf(TOTAL, 3)) + wheelSvg(WINDOWS[1], 3, [pages]);
	return [
		item('totalisateur.platine', 'totalisateur', [block(plate, plateZ[0], plateZ[1] - plateZ[0], { tone: 'lo', steps: 2 })], { svg: screws }),
		item('totalisateur.boitier', 'totalisateur', [housing], { svg: windows }),
	];
}

function binBack(): Node {
	const { x, y, w, d } = BIN;
	const [z0, z1] = BIN_Z;
	const t = 1.5;
	const outer = slabOf(BIN, z0, z1 - z0, P, 2);
	// L'intérieur du bac : la paroi du fond et la paroi gauche vues de face, le fond vu du dessus.
	const inside = [
		dark(pathOf([iso([x + t, y + t, z0 + t], P), iso([x + w - t, y + t, z0 + t], P), iso([x + w - t, y + d - t, z0 + t], P), iso([x + t, y + d - t, z0 + t], P)], true), 2),
		dark(faceY(y + t, rect(x + t, x + w - t, z0 + t, z1)), 1),
		dark(faceX(x + t, rect(y + t, y + d - t, z0 + t, z1)), 2),
		lineSvg(pathOf([iso([x + t, y + d - t, z0 + t], P), iso([x + t, y + t, z0 + t], P), iso([x + w - t, y + t, z0 + t], P)]), { tone: 'lo' }),
		lineSvg(pathOf([iso([x + t, y + t, z0 + t], P), iso([x + t, y + t, z1], P)]), { tone: 'lo' }),
	].join('');
	const rim = [
		lineSvg(pathOf([iso([x, y, z1], P), iso([x + w, y, z1], P), iso([x + w, y + d, z1], P), iso([x, y + d, z1], P)], true), { tone: 'mid' }),
		lineSvg(pathOf([iso([x + t, y + t, z1], P), iso([x + w - t, y + t, z1], P), iso([x + w - t, y + d - t, z1], P), iso([x + t, y + d - t, z1], P)], true), { tone: 'lo' }),
	].join('');
	return item('bac-rejet.fond', 'bac-rejet', [{ svg: `${paper(outer.fill)}${inside}${rim}`, shape: slabShape(BIN, z0, z1 - z0, 2) }], {
		svg: dots(
			[
				[x + 8, y + t, z1 - 6],
				[x + w - 8, y + t, z1 - 6],
			],
			0.5,
		),
	});
}

function binFront(): Node {
	const { x, y, w, d } = BIN;
	const [z0, z1] = BIN_Z;
	const t = 1.5;
	// Les deux parois vues de l'extérieur (devant et côté), et le rebord roulé.
	const outer = slabOf(BIN, z0, z1 - z0, P, 2);
	const walls = outer.shades.map((shade, index) => (shade ? `<path class="iso-shade" data-shade="${index}" d="${shade}"/>` : '')).join('');
	const lip = [
		pathOf([iso([x + w, y + t, z1], P), iso([x + w, y + d, z1], P), iso([x, y + d, z1], P)]),
		pathOf([iso([x + w - t, y + t, z1], P), iso([x + w - t, y + d - t, z1], P), iso([x + t, y + d - t, z1], P)]),
	];
	const hem = sideSeam(BIN, z1 - 4, P, 2);
	return item('bac-rejet.devant', 'bac-rejet', [
		{
			svg: `<g class="iso-solid">${walls}${lineSvg(hem, { tone: 'faint' })}<path class="iso-line iso-edge" data-tone="mid" d="${outer.outline}"/>${lineSvg(lip[1], { tone: 'lo' })}${lineSvg(pathOf([iso([x + w, y + t, z1], P), iso([x + w - t, y + t, z1], P)]), { tone: 'lo' })}${lineSvg(pathOf([iso([x, y + d - t, z1], P), iso([x + t, y + d - t, z1], P)]), { tone: 'lo' })}</g>`,
		},
	]);
}

// ——— Dessus : gabarit, fente, goulotte, arbre du totalisateur ———

const PLATE: Plan = { x: 104, y: 160, w: 200, d: 84, r: 3 };
const PLATE_TOP = TOP + 4;
const GUIDE_Z = [500, 506] as const;
/** La broche posée sur la tranche de la fiche, sans s'y enfoncer. */
const PIN_TIP = REQUEST.z1 + 0.1;
const PIN_BODY_TOP = 514;
const PIN_HEAD = 3;
const CROSSBAR_Z = [529, 538] as const;

/** Les quatre vis moletées de réglage aux coins de la platine du gabarit. */
function screwAt([x, y]: Plane, index: number) {
	const head = { svg: solid(cylinder(x, y, 4, PLATE_TOP, 4.5, P, 14), { tone: 'mid', crease: 'lo', inner: lineSvg(knurl(x, y, 4, PLATE_TOP, PLATE_TOP + 4.5, 14, P), { tone: 'lo' }) }), shape: { kind: 'disc', o: [x, y, 0], a: [0, 0, 1], s0: PLATE_TOP, s1: PLATE_TOP + 4.5, r: 4 } as Shape };
	const slot = lineSvg(lineOnTop([x - 2.4, y + 1.6], [x + 2.4, y - 1.6], PLATE_TOP + 4.5, P), { tone: 'hi', free: true });
	return item(`gabarit.vis#${index + 1}`, 'gabarit', [head], { svg: slot, owner: 'gabarit' });
}

function plate(): Node[] {
	const corners: Plane[] = [
		[PLATE.x + 9, PLATE.y + 9],
		[PLATE.x + PLATE.w - 9, PLATE.y + 9],
		[PLATE.x + 9, PLATE.y + PLATE.d - 9],
		[PLATE.x + PLATE.w - 9, PLATE.y + PLATE.d - 9],
	];
	return [
		item('gabarit.platine', 'gabarit', [block(PLATE, TOP, 4, { tone: 'mid', steps: 3, bevel: 0.6 })], {
			owner: 'gabarit',
			svg: lineSvg(planOutline(insetPlan(PLATE, 4), PLATE_TOP, P, 3), { tone: 'faint' }),
		}),
		...corners.slice(0, 2).map((corner, index) => screwAt(corner, index)),
	];
}

const plateFrontScrews = () =>
	[
		[PLATE.x + 9, PLATE.y + PLATE.d - 9],
		[PLATE.x + PLATE.w - 9, PLATE.y + PLATE.d - 9],
	].map((corner, index) => screwAt(corner as Plane, index + 2));

const FORK_X = [104, 116] as const;
const UPRIGHT_X = [292, 304] as const;

function slotBox(): Node[] {
	const box = SLOT_BOX;
	const face = box.y + box.d;
	const slot: Plan = { x: 138, y: CARD_Y - 2.6, w: 132, d: 5.2, r: 2.6 };
	// La serrure à cylindre, à gauche de la goulotte : la session exigée par l'`AuthGuard`.
	const [lx, lz] = [135, 424];
	const lock = round([lx, face, lz], [0, 1, 0], 0, 3, 5, { tone: 'mid', crease: 'lo' });
	const lockFace = G.frameAlong([lx, face, lz], [0, 1, 0]);
	const keyway = [lineSvg(G.circleOf(lockFace, 3, 3.4, P), { tone: 'faint' }), lineSvg(pathOf([iso([lx, face + 3, lz + 1.8], P), iso([lx, face + 3, lz - 1.8], P)]), { tone: 'hi', free: true })].join('');
	// La sortie vers la goulotte : une fente basse sur la face avant, que le clapet ferme ; la route au-dessus.
	const outlet = dark(faceY(face, rect(OUTLET.x0, OUTLET.x1, OUTLET.z0, OUTLET.z1)), 0);
	const label = faceTextSvg(sideMatrix([158, face], OUTLET.z1 + 3.4, P, 'left'), '/v1/treks', { size: 5, tone: 'mid' });
	return [
		item('fente.boitier', 'fente', [block(box, PLATE_TOP, SLOT_TOP - PLATE_TOP, { tone: 'mid', steps: 3, bevel: 0.8 })], {
			svg: dark(planOutline(slot, SLOT_TOP, P, 3), 0) + lineSvg(planOutline(slot, SLOT_TOP, P, 3), { tone: 'lo' }) + outlet + lineSvg(faceY(face, rect(OUTLET.x0, OUTLET.x1, OUTLET.z0, OUTLET.z1)), { tone: 'lo' }) + label,
		}),
		item('fente.serrure', 'fente', [lock], { svg: keyway }),
		item('fente.levre-fond', 'fente', [block({ x: 136, y: CARD_Y - 6, w: 136, d: 3.4, r: 1 }, SLOT_TOP, 2, { tone: 'mid', steps: 2, bevel: 0.5 })]),
	];
}

const nearLip = () => item('fente.levre-devant', 'fente', [block({ x: 136, y: CARD_Y + 2.6, w: 136, d: 3.4, r: 1 }, SLOT_TOP, 2, { tone: 'mid', steps: 2, bevel: 0.5 })]);

/** Aiguillage du clapet : un levier sur pivot, sur le dessus, du côté de la goulotte. */
function switchLever(): Node {
	const lever = block({ x: 242, y: 214, w: 22, d: 4, r: 1.2 }, SLOT_TOP, 2.5, { tone: 'mid', steps: 2 });
	const pivot = { svg: solid(cylinder(246, 216, 3, SLOT_TOP + 2.5, 2.5, P, 16), { tone: 'mid', crease: 'lo' }), shape: { kind: 'disc', o: [246, 216, 0], a: [0, 0, 1], s0: SLOT_TOP + 2.5, s1: SLOT_TOP + 5, r: 3 } as Shape };
	return item('bac-rejet.aiguillage', 'bac-rejet', [lever, pivot]);
}

/** La fiche de demande, à encoches marginales : un trou par paramètre, encoché s'il est présent. */
function requestCard(): { node: Node; clip: string } {
	const { x0, x1, z0, z1 } = REQUEST;
	const face = CARD_Y + 0.6;
	const plan: Plan = { x: x0, y: CARD_Y - 0.6, w: x1 - x0, d: 1.2, r: 0 };
	// Le pied de la fiche est dans la fente : seule compte la partie au-dessus du boîtier.
	const request = pageRequest(REST_PAGE);
	const holeZ = z1 - HOLE_DEPTH;
	// Les encoches de la requête au repos sont de vrais creux : la broche `page` y tombe.
	const cut = FIELDS.flatMap((field, index) => (notched(request, field) ? [slabShape({ x: holeX(index) - 1.5, y: plan.y - 1, w: 3, d: plan.d + 2, r: 0 }, holeZ - 1.5, z1 + 1 - (holeZ - 1.5), 1)] : []));
	const drawn = block(plan, z0, z1 - z0, { tone: 'hi', steps: 1, crease: 'lo' });
	const card = { svg: drawn.svg, shape: { ...slabShape(plan, z0, z1 - z0, 1), cut } };
	const holes = FIELDS.map((_, index) => lineSvg(sideRing([holeX(index), face, holeZ], 1.5, 'y', P, 16), { tone: 'mid' })).join('');
	const notches = FIELDS.map((field, index) => {
		const x = holeX(index);
		const arc = Array.from({ length: 9 }, (_, step): [number, number] => {
			const angle = Math.PI + (step / 8) * Math.PI;
			return [x + 1.5 * Math.cos(angle), holeZ + 1.5 * Math.sin(angle)];
		});
		const outline: [number, number][] = [[x - 1.5, z1], ...arc, [x + 1.5, z1]];
		const d = faceY(face, outline, false);
		return `<g data-notch="${index}"${notched(request, field) ? '' : ' visibility="hidden"'}>${paper(faceY(face, outline))}${lineSvg(d, { tone: 'mid' })}</g>`;
	}).join('');
	// Trois filets en bas de la fiche : la requête écrite à la main (du texte).
	const rules = [0, 1]
		.map((line) => lineSvg(faceY(face, [[x0 + 8, z0 + 16 + line * 5], [x0 + 8 + [52, 36][line], z0 + 16 + line * 5]], false), { tone: 'lo', free: true }))
		.join('');
	// Seule la partie au-dessus des lèvres se voit : le reste est dans la fente.
	const clip = pathOf(
		[
			[x0 - 140, SLOT_TOP],
			[x1 + 40, SLOT_TOP],
			[x1 + 40, z1 + 60],
			[x0 - 140, z1 + 60],
		].map(([x, z]) => iso([x, CARD_Y, z], P)),
		true,
	);
	const node = group({ 'data-request-clip': '', 'clip-path': 'url(#trekker-fente)' }, [
		group({ 'data-request': '' }, [item('fiche.demande', null, [card], { owner: 'gabarit', floor: SLOT_TOP, svg: holes + notches + rules })]),
	]);
	return { node, clip };
}

/** Une broche : la partie sous le guide (peinte avant lui) et la partie au-dessus, avec sa tête. */
function pinParts(index: number) {
	const x = holeX(index);
	// Aussi épaisse que la fiche et aussi large que l'encoche : elle y tombe juste, dans le plan de la fiche.
	const body: Plan = { x: x - 1.5, y: CARD_Y - 0.6, w: 3, d: 1.2, r: 0 };
	const lower = block(body, PIN_TIP, GUIDE_Z[0] - PIN_TIP, { tone: 'hi', steps: 1, crease: 'none' });
	const upper = block(body, GUIDE_Z[1], PIN_BODY_TOP - GUIDE_Z[1], { tone: 'hi', steps: 1, crease: 'none' });
	const head = block({ x: x - 2.2, y: CARD_Y - 2.2, w: 4.4, d: 4.4, r: 0 }, PIN_BODY_TOP, PIN_HEAD, { tone: 'hi', steps: 1 });
	return { lower, upper, head };
}

const fieldIndex = (field: (typeof FIELDS)[number]) => FIELDS.indexOf(field);

function pinsBelow(): Node[] {
	const nodes: Node[] = [];
	for (let index = 0; index < PIN_COUNT; index++) {
		const { lower } = pinParts(index);
		const parts = [lower];
		const x = holeX(index);
		// La broche `pageSize` porte un bras qui vient buter sur le pied de sa butée.
		if (FIELDS[index] === 'pageSize') parts.push(block({ x: x - 1.6, y: CARD_Y + 0.6, w: 3.2, d: 4.4, r: 0.4 }, 495.5, 2, { tone: 'hi', steps: 1 }));
		// Le loquet `bbox` : un bras qui passe devant la broche voisine et vient condamner la barre.
		if (FIELDS[index] === 'bbox') parts.push(block({ x: x - 8.5, y: CARD_Y + 0.6, w: 9.7, d: 3, r: 0.4 }, 496, 2, { tone: 'hi', steps: 1 }));
		const drop = restDrop(index);
		nodes.push(group({ 'data-pin': String(index) }, [item(`gabarit.broche#${index + 1}`, 'gabarit', parts, { owner: 'gabarit' })], drop ? { offset: [0, 0, drop] } : {}));
	}
	// Le verrou triple : une barre commune aux broches lat, lon et radiusKm.
	const [a, b] = [holeX(fieldIndex('lat')), holeX(fieldIndex('radiusKm'))];
	nodes.push(group({ 'data-bar': '' }, [item('gabarit.verrou', 'gabarit', [block({ x: a - 3.4, y: CARD_Y + 0.6, w: b - a + 6.8, d: 3, r: 0.6 }, 491.5, 3, { tone: 'hi', steps: 2, bevel: 0.3 })], { owner: 'gabarit' })]));
	return nodes;
}

function guideBar(): Node[] {
	const x = holeX(fieldIndex('pageSize'));
	// La butée de la broche `pageSize` : une patte pendue au guide, et son pied sous le bras.
	const strap = block({ x: x - 2, y: CARD_Y + 6, w: 4, d: 2.4, r: 0.3 }, 491, GUIDE_Z[0] - 491, { tone: 'hi', steps: 1 });
	const foot = block({ x: x - 2.4, y: CARD_Y + 1.6, w: 4.8, d: 6.8, r: 0.6 }, 491, 2.5, { tone: 'hi', steps: 2 });
	// Curseurs min et max sur une même glissière, séparés par un ergot : ils ne se croisent pas.
	const [m0, m1] = [holeX(fieldIndex('minDistanceMeters')), holeX(fieldIndex('maxDistanceMeters'))];
	const rail = block({ x: m0 - 6, y: CARD_Y + 6, w: m1 - m0 + 12, d: 1.6, r: 0.3 }, 501.5, 3, { tone: 'hi', steps: 1 });
	const sliders = [m0 - 1.5, m1 + 1.5].map((sx) => block({ x: sx - 2.6, y: CARD_Y + 7.6, w: 5.2, d: 2.4, r: 0.6 }, 500.5, 5, { tone: 'hi', steps: 2, bevel: 0.3 }));
	const peg = dots([[(m0 + m1) / 2, CARD_Y + 7.6, 503]], 0.7, 'hi');
	return [
		item('gabarit.guide', 'gabarit', [block({ x: FORK_X[1], y: CARD_Y - 6, w: UPRIGHT_X[0] - FORK_X[1], d: 12, r: 1 }, GUIDE_Z[0], GUIDE_Z[1] - GUIDE_Z[0], { tone: 'hi', steps: 2, bevel: 0.5 })], {
			owner: 'gabarit',
			svg: dots(
				Array.from({ length: PIN_COUNT }, (_, index): Point3 => [holeX(index), CARD_Y + 6, GUIDE_Z[1] - 1.5]),
				0.4,
			),
		}),
		item('gabarit.butee', 'gabarit', [strap, foot], { owner: 'gabarit' }),
		item('gabarit.curseurs', 'gabarit', [rail, ...sliders], { owner: 'gabarit', svg: peg }),
	];
}

function pinsAbove(): Node[] {
	const nodes: Node[] = [];
	const comb = FIELDS.map((field, index) => ({ field, index })).filter(({ field }) => ['facile', 'moyen', 'difficile', 'tres_difficile'].includes(field));
	for (let index = 0; index < PIN_COUNT; index++) {
		const { upper, head } = pinParts(index);
		const drop = restDrop(index);
		nodes.push(group({ 'data-pin': String(index) }, [item(`gabarit.tete#${index + 1}`, 'gabarit', [upper, head], { owner: 'gabarit', floor: GUIDE_Z[1] })], drop ? { offset: [0, 0, drop] } : {}));
	}
	// Le peigne `difficulty` : quatre dents reliées par un dos, posé sur leurs têtes.
	const [c0, c1] = [holeX(comb[0].index), holeX(comb[comb.length - 1].index)];
	nodes.push(
		group({ 'data-comb': '' }, [
			item('gabarit.peigne', 'gabarit', [block({ x: c0 - 2.6, y: CARD_Y - 2.6, w: c1 - c0 + 5.2, d: 5.2, r: 0.8 }, PIN_BODY_TOP + PIN_HEAD, 2.5, { tone: 'hi', steps: 2, bevel: 0.3 })], { owner: 'gabarit' }),
		]),
	);
	return nodes;
}

function frame(): { fork: Node[]; forkFront: Node; upright: Node; crossbar: Node[] } {
	const post = (y: number) => block({ x: FORK_X[0], y, w: FORK_X[1] - FORK_X[0], d: 8, r: 1 }, PLATE_TOP + 6, CROSSBAR_Z[0] - PLATE_TOP - 6, { tone: 'hi', steps: 2, bevel: 0.4 });
	const foot = block({ x: FORK_X[0], y: 186, w: FORK_X[1] - FORK_X[0], d: 28, r: 1 }, PLATE_TOP, 6, { tone: 'hi', steps: 2, bevel: 0.4 });
	const upright = block({ x: UPRIGHT_X[0], y: 186, w: UPRIGHT_X[1] - UPRIGHT_X[0], d: 28, r: 1 }, PLATE_TOP, CROSSBAR_Z[0] - PLATE_TOP, { tone: 'hi', steps: 2, bevel: 0.5 });
	const bar: Plan = { x: FORK_X[0], y: 190, w: UPRIGHT_X[1] - FORK_X[0], d: 20, r: 2 };
	// Sélecteur `matchOn` à deux crans, sur `start` : un plateau, un bouton moleté, son index.
	const cx = 278;
	const cy = CARD_Y;
	const top = CROSSBAR_Z[1];
	const dial = { svg: solid(cylinder(cx, cy, 7.5, top, 1.6, P, 28), { tone: 'hi', crease: 'lo' }), shape: { kind: 'disc', o: [cx, cy, 0], a: [0, 0, 1], s0: top, s1: top + 1.6, r: 7.5 } as Shape };
	const knob = { svg: solid(cylinder(cx, cy, 3.8, top + 1.6, 5, P, 20), { tone: 'hi', crease: 'lo', inner: lineSvg(knurl(cx, cy, 3.8, top + 1.6, top + 6.6, 20, P), { tone: 'lo' }) }), shape: { kind: 'disc', o: [cx, cy, 0], a: [0, 0, 1], s0: top + 1.6, s1: top + 6.6, r: 3.8 } as Shape };
	const detents = dots(
		[
			[cx + 6, cy - 2.2, top + 1.6],
			[cx + 6, cy + 2.2, top + 1.6],
		],
		0.6,
		'hi',
	);
	const pointer = lineSvg(lineOnTop([cx, cy], [cx + 3.8 * Math.cos(-0.35), cy + 3.8 * Math.sin(-0.35)], top + 6.6, P), { tone: 'hi', free: 'start' });
	return {
		fork: [item('gabarit.fourche', 'gabarit', [foot, post(186)], { owner: 'gabarit' })],
		forkFront: item('gabarit.fourche-devant', 'gabarit', [post(206)], { owner: 'gabarit' }),
		upright: item('gabarit.montant', 'gabarit', [upright], { owner: 'gabarit' }),
		crossbar: [
			item('gabarit.traverse', 'gabarit', [block(bar, CROSSBAR_Z[0], CROSSBAR_Z[1] - CROSSBAR_Z[0], { tone: 'hi', steps: 3, bevel: 0.6 })], {
				owner: 'gabarit',
				svg: dots(
					[
						[FORK_X[0] + 6, 200, top],
						[UPRIGHT_X[1] - 6, 194, top],
					],
					0.5,
					'hi',
				),
			}),
			item('gabarit.selecteur', 'gabarit', [dial, knob], { owner: 'gabarit', svg: detents + pointer }),
		],
	};
}

/** Le clapet de sortie, sur charnière, et son ressort de rappel ; le mouvement le fait basculer. */
function flap(): Node {
	const face = SLOT_BOX.y + SLOT_BOX.d;
	const hinge = round([OUTLET.x0 - 4, face + 1.6, FLAP_HINGE], [1, 0, 0], 0, OUTLET.x1 - OUTLET.x0 + 8, 1.6, { tone: 'mid', crease: 'none' });
	const spring = G.frameAlong([OUTLET.x1 + 4, face + 1.6, FLAP_HINGE], [1, 0, 0]);
	const coil = Array.from({ length: 5 }, (_, index) => G.arcOf(spring, 1 + index * 1.6, 2.2, P, { least: -1 })).join('');
	const svg = `<path class="iso-fill" data-flap d="${flapPath(0)}"/><path class="iso-line iso-edge" data-flap data-tone="mid" d="${flapPath(0)}"/>`;
	return item('bac-rejet.clapet', 'bac-rejet', [hinge, round([OUTLET.x1 + 4, face + 1.6, FLAP_HINGE], [1, 0, 0], 0, 9, 1, { tone: 'mid', crease: 'none' })], {
		owner: 'aiguillage',
		svg: svg + lineSvg(coil, { tone: 'lo' }),
	});
}

function chute(): { floor: Node[]; nearLipItem: Node } {
	const [ys, zs] = CHUTE.start;
	const [ye, ze] = CHUTE.end;
	const t = 2;
	const floor = prismYZ(
		[
			[ys, zs],
			[ye, ze],
			[ye, ze - t],
			[ys, zs - t],
		],
		CHUTE.x0,
		CHUTE.x1,
		{ tone: 'mid', crease: 'lo' },
	);
	const lip = (x0: number, x1: number) =>
		prismYZ(
			[
				[ys, zs - t],
				[ye, ze - t],
				[ye, ze + 6],
				[ys, zs + 6],
			],
			x0,
			x1,
			{ tone: 'mid', crease: 'lo' },
		);
	const legs = [288, 334].map((y, index) => {
		const z1 = chuteZ(y) - t;
		return item(`bac-rejet.patte#${index + 1}`, 'bac-rejet', [block({ x: 194, y, w: 12, d: 3, r: 0.4 }, TOP, z1 - TOP, { tone: 'mid', steps: 1 })], { owner: 'goulotte' });
	});
	return {
		floor: [...legs, item('bac-rejet.goulotte', 'bac-rejet', [floor, lip(CHUTE.x0 - 2, CHUTE.x0)], { owner: 'goulotte' })],
		nearLipItem: item('bac-rejet.goulotte-bord', 'bac-rejet', [lip(CHUTE.x1, CHUTE.x1 + 2)], { owner: 'goulotte' }),
	};
}

/** La fiche refusée posée à plat dans la goulotte ; rognée à la sortie du boîtier. */
function rejectCard(): { node: Node; clip: string } {
	const slope = Math.atan2(CHUTE.end[1] - CHUTE.start[1], CHUTE.end[0] - CHUTE.start[0]);
	const along: [number, number] = [Math.cos(slope), Math.sin(slope)];
	const y0 = REJECT_START;
	const z0 = chuteZ(y0);
	const poly: Plane[] = [
		[y0, z0],
		[y0 + along[0] * REJECT.length, z0 + along[1] * REJECT.length],
		[y0 + along[0] * REJECT.length, z0 + along[1] * REJECT.length + REJECT.thickness],
		[y0, z0 + REJECT.thickness],
	];
	const card = prismYZ(poly, REJECT.x0, REJECT.x1, { tone: 'hi', crease: 'lo' });
	const face = SLOT_BOX.y + SLOT_BOX.d;
	// Elle n'existe pour l'œil qu'une fois sortie du boîtier par la sortie basse.
	const clip = pathOf(
		G.hullOf(
			[
				[OUTLET.x0, face, OUTLET.z0 - 4],
				[OUTLET.x1, face, OUTLET.z0 - 4],
				[OUTLET.x1, face, OUTLET.z1],
				[OUTLET.x0, face, OUTLET.z1],
				[OUTLET.x0 - 20, BIN.y + BIN.d + 40, BIN_Z[0] - 10],
				[OUTLET.x1 + 20, BIN.y + BIN.d + 40, BIN_Z[0] - 10],
				[OUTLET.x1 + 20, BIN.y + BIN.d + 40, OUTLET.z1 + 4],
				[OUTLET.x0 - 20, BIN.y + BIN.d + 40, OUTLET.z1 + 4],
			].map((point) => iso(point as Point3, P)),
		),
		true,
	);
	const node = group({ 'data-reject-clip': '', 'clip-path': 'url(#trekker-sortie)' }, [group({ 'data-reject': '', visibility: 'hidden' }, [item('fiche.refusee', null, [card])])]);
	return { node, clip };
}

/** L'arbre et le pignon qui relient la fente au totalisateur, par un renvoi d'angle au bord du dessus. */
function shaft(): Node[] {
	const x = 276;
	const z = 430;
	const face = SLOT_BOX.y + SLOT_BOX.d;
	const gear: Plan = { x: x - 8, y: SPAN + 8, w: 16, d: 16, r: 2 };
	const pinion = round([x, face, z], [0, 1, 0], 0, 3, 6, { tone: 'mid', crease: 'lo' });
	// Les dents, d'un bord à l'autre de la jante, s'effacent vers le limbe au lieu de s'arrêter net.
	const teeth = Array.from({ length: 18 }, (_, index) => {
		const angle = (index / 18) * Math.PI * 2;
		const rim = (s: number): Point3 => {
			const [px, py, pz] = G.pointOf(pinion.F, s, 6, angle);
			return [px, py, pz];
		};
		const d = pathOf([iso(rim(0), P), iso(rim(3), P)]);
		return { d, alpha: G.fadeOf(G.facingOf(pinion.F, angle, P), [0.05, 0.4]) };
	});
	// Le palier coupe l'arbre en deux : chaque tronçon s'arrête sur une de ses faces.
	const bearingY = [326, 334];
	const before = round([x, face + 3, z], [0, 1, 0], 0, bearingY[0] - face - 3, 1.8, { tone: 'mid', crease: 'none' });
	const after = round([x, bearingY[1], z], [0, 1, 0], 0, gear.y - bearingY[1], 1.8, { tone: 'mid', crease: 'none' });
	const bearing = block({ x: x - 6, y: bearingY[0], w: 12, d: bearingY[1] - bearingY[0], r: 1.5 }, TOP, z + 4 - TOP, { tone: 'mid', steps: 2, bevel: 0.4 });
	const box = block(gear, z - 8, 16, { tone: 'mid', steps: 2, bevel: 0.5 });
	const down = { svg: solid(cylinder(x, SPAN + 16, 1.8, TOTALIZER_Z[1], z - 8 - TOTALIZER_Z[1], P, 16), { tone: 'mid', crease: 'none' }), shape: { kind: 'disc', o: [x, SPAN + 16, 0], a: [0, 0, 1], s0: TOTALIZER_Z[1], s1: z - 8, r: 1.8 } as Shape };
	return [
		item('totalisateur.pignon', 'totalisateur', [pinion], { svg: fadedSvg(teeth, { tone: 'lo' }) }),
		item('totalisateur.arbre', 'totalisateur', [before]),
		item('totalisateur.palier', 'totalisateur', [bearing], { svg: dots([[x - 3.5, bearingY[0] + 4, z + 4], [x + 3.5, bearingY[0] + 4, z + 4]], 0.5) }),
		item('totalisateur.arbre#2', 'totalisateur', [after]),
		item('totalisateur.descente', 'totalisateur', [down]),
		item('totalisateur.renvoi', 'totalisateur', [box], { svg: dots([[gear.x + 3, gear.y + gear.d, z + 5], [gear.x + gear.w - 3, gear.y + gear.d, z - 5]], 0.5) }),
	];
}

// ——— Assemblage ———

export interface Figure {
	nodes: Node[];
	defs: string;
}

/** L'arbre de la figure au repos, dans l'ordre de peinture. */
export function figure(): Figure {
	const drawer = pulledDrawer();
	const request = requestCard();
	const reject = rejectCard();
	const { fork, forkFront, upright, crossbar } = frame();
	const { floor, nearLipItem } = chute();
	const fronts = openings.map((opening) =>
		group({ 'data-front': String(opening.drawer), ...(opening.drawer === REST_PAGE ? { visibility: 'hidden' } : {}) }, drawerFront(opening, `facade#${opening.drawer}`)),
	);
	const nodes: Node[] = [
		...base(),
		...carcass(),
		...facade(),
		...flank(),
		...flankParts(),
		...fronts,
		...cornice(),
		...plate(),
		...fork,
		...slotBox(),
		flap(),
		request.node,
		nearLip(),
		switchLever(),
		...plateFrontScrews(),
		...pinsBelow(),
		forkFront,
		...guideBar(),
		// Au-dessus du guide, les broches sortent de leurs trous : rognées à sa face supérieure.
		group({ 'clip-path': 'url(#trekker-guide)' }, pinsAbove()),
		upright,
		...crossbar,
		binBack(),
		...floor,
		reject.node,
		nearLipItem,
		binFront(),
		...shaft(),
		drawer.node,
	];
	const defs = [
		`<clipPath id="trekker-tiroir">${drawer.clip}</clipPath>`,
		...openings.map(({ drawer: n, y0, y1, z0, z1 }) => `<clipPath id="trekker-ouverture-${n}"><path d="${faceX(DEPTH, rect(y0, y1, z0, z1))}"/></clipPath>`),
		`<clipPath id="trekker-fente"><path d="${request.clip}"/></clipPath>`,
		`<clipPath id="trekker-sortie"><path d="${reject.clip}"/></clipPath>`,
		`<clipPath id="trekker-guide"><path d="${faceY(CARD_Y + 0.6, rect(FORK_X[0], UPRIGHT_X[1], GUIDE_Z[1], CROSSBAR_Z[1] + 20))}"/></clipPath>`,
	].join('');
	return { nodes, defs };
}

const attrsOf = (attrs: Record<string, string>) =>
	Object.entries(attrs)
		.map(([key, value]) => (value === '' ? ` ${key}` : ` ${key}="${value}"`))
		.join('');

export function renderNode(node: Node): string {
	if (node.kind === 'item') return node.piece ? pieceSvg(pieceOf(node.piece), node.svg) : `<g>${node.svg}</g>`;
	const transform = node.offset ? ` transform="${translateAlong(P, node.offset)}"` : '';
	return `<g${attrsOf(node.attrs)}${transform}>${node.children.map(renderNode).join('')}</g>`;
}

export function renderRest(): RestFigure {
	const { nodes, defs } = figure();
	const plinthHalo = `<path class="iso-halo" d="${haloOf(insetPlan(BODY, -6), 0, 2, P)}"/>`;
	return { width: WIDTH, height: HEIGHT, body: `<defs>${defs}</defs>${plinthHalo}${nodes.map(renderNode).join('')}` };
}
