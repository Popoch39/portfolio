// Plan du banc de duel, en unités du monde (≈ 1 px) : x en profondeur (0 au dos, 96 devant), y le
// long du banc (B à 0, A à 380), z vers le haut. Partagé par la géométrie au repos et par le
// mouvement, qui n'importe que ce module léger et le modèle.
import { depthOf, extrude, fadedSvg, iso, pathOf, type Flat, type Plane, type Point3, type Projection } from '../../vendor/anatomy/iso-kit.ts';
import { ARMS, MANIAC_STEP, RAIL_ENDS } from './model.ts';

export const WIDTH = 900;
export const HEIGHT = 470;

export const BENCH = { x: 0, y: 0, w: 96, d: 380, h: 14, r: 6 };
/** Goulotte creusée dans l'axe, sur toute la longueur. */
export const CHANNEL = { x0: 41, x1: 55, floor: 7 };

/** Tour d'arbitrage, posée au milieu du banc. */
export const TOWER = {
	base: { x: 8, y: 144, w: 80, d: 92, r: 3 },
	baseTop: 18,
	caseTop: 84,
	capTop: 92,
	cheekTop: 96,
};
/** L'embrasure de la porte sur la face avant de la caisse (x = 78), et la niche du guichet. */
export const NICHE = { face: 78, back: 50, y0: 166, y1: 214, z0: 28, z1: 72 };
/** Rail du guichet, de l'entrée (côté A) à la sortie (côté B). */
export const RAIL = { x: 62, from: 214, to: 166, z: 29.4 };
export const TOKEN = { r: 2.6, h: 2.2 };
/** Les quatre bras : pivots alternés derrière et devant le rail, pour qu'un bras ouvert n'en touche aucun autre. */
export const ARM = { length: 9.5, width: 1.6, z: 29.8, h: 1.4 };
export const PIVOTS: Plane[] = ARMS.map((at, index) => [index % 2 ? 68.5 : 55.5, RAIL.from + (RAIL.to - RAIL.from) * at]);

export const railPoint = (at: number): Point3 => [RAIL.x, RAIL.from + (RAIL.to - RAIL.from) * at, RAIL.z];

/** Mât : tube carré de 6 × 6 sur le chapiteau, 24 crans puis Maniac. */
export const MAST = { x: 27, y: 187, w: 6, z0: 92, z1: 194, rack: 1.4 };
export const NOTCH = { z0: 100, pitch: 3.6 };
export const notchZ = (step: number) => NOTCH.z0 + Math.min(step, MANIAC_STEP) * NOTCH.pitch;
/** Curseurs de rang, un par face : A sur la face +y, B sur la face −y. */
export const SLIDER = { w: 8, d: 7, h: 5 };
export const sliderPlan = (side: number) => ({
	x: MAST.x - 1,
	y: side ? MAST.y - MAST.rack - SLIDER.d : MAST.y + MAST.w + MAST.rack,
	w: SLIDER.w,
	d: SLIDER.d,
	r: 0.8,
});

/** Tambour de temps sur le chapiteau, axe le long du banc. */
export const DRUM = { x: 62, y0: 172, y1: 204, z: 101, r: 7 };
/** Sélecteur de format, sur le chapiteau. */
export const KNOB = { x: 74, y: 167, r: 3.4, z: TOWER.capTop, h: 3 };
/** Index du sélecteur : un point pour Défi, deux pour Classé. */
export const KNOB_ANGLE = { ranked: 2.2, challenge: 0.9 };
/** Disjoncteur de cadence, sur la face extérieure de la joue A. */
export const BREAKER = { x: 30, y: 232, w: 14, d: 3, z: 56, h: 10 };

/** Tourne un point du clavier A en celui du clavier B (demi-tour autour du centre du banc). */
export const turn = (side: number, [x, y]: Plane): Plane => (side ? [BENCH.w - x, BENCH.d - y] : [x, y]);

/** Barre de verrouillage : levée en manche, posée sur la rangée qwer pendant le compte à rebours et la pause. */
/** Ses deux guides glissent contre les colonnettes (x = 9,5 et 86,5, rayon 1,3). */
export const BAR = { y: 335.2, up: 31.5, down: 23.3 + 2.4, h: 2, d: 2.4, x0: 10.85, x1: 85.15 };

/** Bandeau de texte, sur le capot du clavier : fenêtre et sens de lecture pour chaque joueur. */
export const WINDOW = { x0: 17, x1: 69, y0: 320.6, y1: 328.2, z: 27.5, depth: 0.8 };
/** Quinze caractères de 3,2 de chasse : six tapés à gauche du curseur, neuf à venir. */
export const GLYPH = { size: 5, advance: 3.2, cursor: 6, span: 15 };

/** Le repère du bandeau : `u` le long de la ligne de texte, `v` vers le bas des lettres. */
export function windowMatrix(side: number, P: Projection) {
	const [x, y] = turn(side, [WINDOW.x0 + 1.6, WINDOW.y1 - 1.9]);
	const z = WINDOW.z - WINDOW.depth;
	const origin = iso([x, y, z], P);
	const along = iso([x + (side ? -1 : 1), y, z], P);
	const down = iso([x, y + (side ? -1 : 1), z], P);
	const f = (value: number) => Math.round(value * 1000) / 1000;
	return `matrix(${f(along[0] - origin[0])} ${f(along[1] - origin[1])} ${f(down[0] - origin[0])} ${f(down[1] - origin[1])} ${f(origin[0])} ${f(origin[1])})`;
}

export const SEND_BOX = { x: 72, y: 320, w: 9, d: 8, z: 27.5, h: 4.4 };

/** Câbles : le tracé de A (clavier → tour) ; celui de B en est le demi-tour. */
export const CABLE_R = 2.2;
/** Le connecteur du clavier, assez haut pour que la fiche ne touche pas la semelle. */
export const PLUG_Z = 18;
/** Le câble court dans la goulotte, au-dessus du fond, sous le bord du banc. */
export const IN_CHANNEL = CHANNEL.floor + CABLE_R + 1.15;
/** Le connecteur de la tour, sur la joue, bien au-dessus de l'arête de l'embase. */
export const SOCKET_Z = 28;
export const CABLE_A: Point3[] = [
	[48, 312.4, PLUG_Z],
	[48, 305, PLUG_Z],
	[48, 295, IN_CHANNEL],
	[48, 264, IN_CHANNEL],
	[48, 251, SOCKET_Z],
	[48, 238.7, SOCKET_Z],
];
export const cableRoute = (side: number): Point3[] => (side ? CABLE_A.map(([x, y, z]) => [BENCH.w - x, BENCH.d - y, z]) : CABLE_A);

/** Porte de la tour, battue de côté sur sa charnière (bord B de l'embrasure). */
export const DOOR = { hinge: [80.2, 164.4] as Plane, width: 50, z0: 27, z1: 73, t: 1.6, angle: 100 };
export const doorDirection = (): Plane => {
	const a = (DOOR.angle * Math.PI) / 180;
	return [Math.sin(a), Math.cos(a)];
};

/** Les points que la projection cadre : le banc, la pointe du mât et la porte ouverte, avec la marge du halo. */
export const framed = (): Point3[] => [
	[0, 0, 0],
	[96, 0, 0],
	[0, 380, 0],
	[96, 380, 0],
	[0, 0, 40],
	[0, 380, 40],
	[MAST.x, MAST.y, MAST.z1 + 9],
	[DOOR.hinge[0] + doorDirection()[0] * DOOR.width, DOOR.hinge[1] + doorDirection()[1] * DOOR.width, DOOR.z0],
];
export const FIT = { pad: 34, azimuth: 35 };

/**
 * `fitProjection(framed(), WIDTH, HEIGHT, FIT)`, écrite en chiffres pour que le mouvement n'ait pas
 * à la recalculer ; la géométrie vérifie au build qu'elle n'a pas dérivé.
 */
export const P: Projection = { origin: [648.52, 206.19], scale: 1.2251, azimuth: 35, elevation: 30 };

// --- Pièces qui changent de forme : reconstruites à chaque image par le mouvement ---

/** Contour au sol d'un bras de barrière tourné de `opening` (0 : en travers, 1 : le long du rail). */
export function armRing(index: number, opening: number): Plane[] {
	const [px, py] = PIVOTS[index];
	// Les bras de derrière pointent vers +x, ceux de devant vers −x ; ouverts, tous suivent le jeton (−y).
	const closed = index % 2 ? Math.PI : 0;
	const angle = closed + (index % 2 ? 1 : -1) * opening * (Math.PI / 2);
	const ux = Math.cos(angle);
	const uy = Math.sin(angle);
	const half = ARM.width / 2;
	const back = 1.6;
	return [
		[px - ux * back - uy * half, py - uy * back + ux * half],
		[px + ux * ARM.length - uy * half, py + uy * ARM.length + ux * half],
		[px + ux * ARM.length + uy * half, py + uy * ARM.length - ux * half],
		[px - ux * back + uy * half, py - uy * back - ux * half],
	];
}

export const armPaths = (index: number, opening: number) => extrude(armRing(index, opening), ARM.z, ARM.h, P);

/** Ticks visibles du tambour pour un temps de manche `t` (s) : mineurs, majeurs, et le secteur de tolérance. */
export const DRUM_SPAN = 300 / 30.4;
export const DRUM_INDEX = 38;
export function drumMarksSvg(t: number) {
	// Mineures, majeures (toutes les 5 s), et le secteur de 30 à 30,4 s : des traits serrés en bande.
	const marks: { d: string; alpha: number }[][] = [[], [], []];
	const y0 = DRUM.y1 - 1.2;
	for (const second of [...Array(31).keys(), 30.13, 30.27, 30.4]) {
		const angle = ((DRUM_INDEX + (second - t) * DRUM_SPAN) * Math.PI) / 180;
		const face = 0.71 * Math.cos(angle) + 0.5 * Math.sin(angle);
		const point = (y: number): Flat => iso([DRUM.x + DRUM.r * Math.cos(angle), y, DRUM.z + DRUM.r * Math.sin(angle)], P);
		const kind = second % 1 ? 2 : second % 5 ? 0 : 1;
		if (face > 0.05) marks[kind].push({ d: pathOf([point(y0), point(y0 - (kind ? 7 + 2 * (kind & 1) : 4.5))]), alpha: Math.min(1, (face - 0.05) / 0.35) });
	}
	return fadedSvg(marks[0], { tone: 'lo' }) + fadedSvg(marks[1], { tone: 'hi' }) + fadedSvg(marks[2], { tone: 'hi' });
}

/** Drapeau de bouclier : une plaquette qui bascule autour d'un axe le long de x, posée à plat ou dressée. */
export function flagPath(side: number, z: number, raised: number) {
	const plan = sliderPlan(side);
	const outer = side ? plan.y + 1.2 : plan.y + plan.d - 1.2;
	const out = side ? -1 : 1;
	const angle = raised * (Math.PI / 2) * 0.92;
	const corner = (x: number, along: number): Flat => iso([x, outer - out * along * Math.cos(angle), z + 0.6 + along * Math.sin(angle)], P);
	return pathOf([corner(plan.x + 1.6, 0), corner(plan.x + 5.4, 0), corner(plan.x + 5.4, 4.4), corner(plan.x + 1.6, 4.4)], true);
}

/** Levier du disjoncteur : au repos vers le bas, sauté vers le haut. */
export function leverPath(tripped: number) {
	const pivot: Point3 = [BREAKER.x + BREAKER.w / 2, BREAKER.y + BREAKER.d + 0.4, BREAKER.z + BREAKER.h / 2];
	const angle = ((-120 + tripped * 150) * Math.PI) / 180;
	const ux = Math.cos(angle);
	const uz = Math.sin(angle);
	const p = (along: number, side: number): Flat => iso([pivot[0] + ux * along - uz * side, pivot[1], pivot[2] + uz * along + ux * side], P);
	return { body: pathOf([p(-0.8, -0.7), p(6.4, -0.55), p(6.4, 0.55), p(-0.8, 0.7)], true), tip: p(6.4, 0) };
}

/** Index du sélecteur, sur le dessus du bouton. */
export function knobPointer(angle: number) {
	const top = KNOB.z + KNOB.h;
	return pathOf([iso([KNOB.x, KNOB.y, top], P), iso([KNOB.x + Math.cos(angle) * (KNOB.r - 0.7), KNOB.y + Math.sin(angle) * (KNOB.r - 0.7), top], P)]);
}

/**
 * Fait tourner une pièce plate de `angle` dans son plan (`u`, `v`) autour de `at` : une rotation
 * dans un plan reste affine à l'écran, une matrice suffit (levier, drapeau, index du sélecteur).
 */
export function turnIn(at: Point3, u: Point3, v: Point3, angle: number) {
	const o = iso(at, P);
	const a = iso([at[0] + u[0], at[1] + u[1], at[2] + u[2]], P);
	const b = iso([at[0] + v[0], at[1] + v[1], at[2] + v[2]], P);
	const [u0, u1, v0, v1] = [a[0] - o[0], a[1] - o[1], b[0] - o[0], b[1] - o[1]];
	const c = Math.cos(angle);
	const s = Math.sin(angle);
	const det = u0 * v1 - u1 * v0;
	// T = M·R·M⁻¹, avec M = [u v] à l'écran.
	const [p, q, r, t] = [u0 * c + v0 * s, v0 * c - u0 * s, u1 * c + v1 * s, v1 * c - u1 * s];
	const m = [(p * v1 - q * u1) / det, (r * v1 - t * u1) / det, (q * u0 - p * v0) / det, (t * u0 - r * v0) / det];
	const f = (value: number) => Math.round(value * 1e4) / 1e4;
	return `matrix(${f(m[0])} ${f(m[1])} ${f(m[2])} ${f(m[3])} ${f(o[0] - m[0] * o[0] - m[2] * o[1])} ${f(o[1] - m[1] * o[0] - m[3] * o[1])})`;
}

/** Pivot du levier du disjoncteur, axe du drapeau d'un curseur, centre du sélecteur. */
export const LEVER_PIVOT: Point3 = [BREAKER.x + BREAKER.w / 2, BREAKER.y + BREAKER.d + 0.4, BREAKER.z + BREAKER.h / 2];
export const LEVER_SWING = (150 * Math.PI) / 180;
export const flagHinge = (side: number, z: number): Point3 => {
	const plan = sliderPlan(side);
	return [plan.x + 1.6, side ? plan.y + 1.2 : plan.y + plan.d - 1.2, z + 0.6];
};
export const FLAG_SWING = (Math.PI / 2) * 0.92;

/** Impulsions sur un tronçon de câble : un tiret de 7 unités par impulsion, en longueur d'écran. */
export const PULSE = 3.5;
export function pulseDash(pulses: number[], total: number, s0: number, s1: number, screen: number) {
	const scale = screen / (s1 - s0);
	const spans = pulses
		.map((share) => [Math.max(share * total - PULSE, s0), Math.min(share * total + PULSE, s1)])
		.filter(([a, b]) => b > a)
		.sort((a, b) => a[0] - b[0]);
	if (!spans.length) return '0 100000';
	const out = [0];
	let at = 0;
	for (const [a, b] of spans) {
		const from = Math.max((a - s0) * scale, at);
		out.push(from - at, Math.max(0.01, (b - s0) * scale - from));
		at = (b - s0) * scale;
	}
	out.push(100_000);
	return out.map((value) => Math.round(value * 100) / 100).join(' ');
}

/** Une butée par bras, du côté où il s'ouvre. */
export const stopPoint = (index: number): Plane => [PIVOTS[index][0] + (index % 2 ? 2.2 : -2.2), PIVOTS[index][1] - 4];
export const TOKENS = 4;

/**
 * Ordre de peinture de la niche, qui change quand le jeton passe un bras : la profondeur du centre
 * de chaque pièce suffit, les pièces étant petites et posées sur le même plancher.
 */
export function nicheOrder(arms: number[], tokens: (number | null)[]) {
	const keyed: { name: string; key: number }[] = [];
	const depth = ([x, y]: Plane, z: number) => depthOf([x, y, z], P);
	arms.forEach((opening, index) => {
		const ring = armRing(index, opening);
		const centre: Plane = [(ring[0][0] + ring[2][0]) / 2, (ring[0][1] + ring[2][1]) / 2];
		// Le bras est posé sur son pivot et coiffé de son chapeau : les trois se peignent d'affilée.
		const post = depth(PIVOTS[index], 29);
		const arm = Math.max(depth(centre, 30.5), post + 0.01);
		keyed.push({ name: `post${index}`, key: post }, { name: `arm${index}`, key: arm }, { name: `cap${index}`, key: arm + 0.01 });
		keyed.push({ name: `stop${index}`, key: depth(stopPoint(index), 30) });
	});
	tokens.forEach((at, index) => {
		const [x, y] = railPoint(at ?? 0);
		keyed.push({ name: `token${index}`, key: at === null ? -1e3 : depth([x, y], 30.5) });
	});
	return keyed.sort((a, b) => a.key - b.key).map((entry) => entry.name);
}

/** Le jeton s'efface en entrant dans la paroi B, par le port de sortie. */
export const tokenOpacity = (at: number) => Math.min(1, Math.max(0, (RAIL_ENDS[1] - at) / 0.06));

/** Index du vernier : de 0 à 100 TP le long de la face avant du curseur. */
export function vernierNeedle(side: number, tp: number, z: number) {
	const plan = sliderPlan(side);
	const face = plan.x + plan.w;
	const y = plan.y + 1 + (Math.min(Math.max(tp, 0), 100) / 100) * (plan.d - 2);
	return pathOf([iso([face, y, z], P), iso([face, y, z + 2.6], P)]);
}

/** Ticks du tambour, groupés par opacité pour s'effacer vers les bords. */

/** Le bandeau : lettres tapées encrées, lettres à venir en gris, curseur plein, curseur creux de l'adversaire. */
export function bandeauSvg(chars: string, opponent: number) {
	const { advance, cursor, size } = GLYPH;
	const xs = (from: number, to: number) => Array.from({ length: to - from }, (_, i) => ((from + i) * advance).toFixed(1)).join(' ');
	const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;');
	return (
		`<text class="iso-face-text" data-tone="hi" font-size="${size}" x="${xs(0, cursor)}" y="0" style="letter-spacing:0">${escape(chars.slice(0, cursor))}</text>` +
		`<text class="iso-face-text" data-tone="lo" font-size="${size}" x="${xs(cursor, chars.length)}" y="0" style="letter-spacing:0">${escape(chars.slice(cursor))}</text>` +
		`<rect class="iso-face-text" data-tone="hi" x="${(cursor * advance - 0.5).toFixed(1)}" y="-4" width="0.7" height="4.8"/>` +
		`<rect class="iso-line" data-tone="mid" x="${(opponent * advance - 0.3).toFixed(1)}" y="-4.2" width="${(advance - 0.2).toFixed(1)}" height="5.2"${opponent < 0 ? ' opacity="0"' : ''}/>`
	);
}

/** Contrepoids du MMR dans la fente du mât : de 400 à 2 000 sur la hauteur de la fente. */
export const SLOT = { y: MAST.y + MAST.w / 2, z0: 98, z1: 188 };
export const weightZ = (mmr: number) => SLOT.z0 + 3 + ((Math.min(Math.max(mmr, 400), 2000) - 400) / 1600) * (SLOT.z1 - SLOT.z0 - 9);
