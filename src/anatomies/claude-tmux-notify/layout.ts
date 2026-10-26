// Plan du tableau d'annonciateur, en unités du monde (≈ 1 px) : x sort du mur, y court le long du
// mur (vers la gauche à l'écran), z monte. Ce module ne garde que ce que le mouvement relit : la
// caméra, les cotes, l'extrudeur de plaques de façade et les pièces dont la forme change (volets,
// boucle tampon, ressorts, cordon). Le reste du dessin vit dans `geometry.ts`, au build seulement.
// Le cœur du kit est pris dans sa version `.mjs`, celle qu'importent `lathe.mjs` et `tube.mjs` :
// le module de mouvement n'en embarque ainsi qu'un exemplaire.
import type { Flat, Point3, Projection, SolidPaths } from '../../vendor/anatomy/iso-kit.ts';
import { depthOf, iso, pathOf } from '../../vendor/anatomy/iso-kit.mjs';
import { bandOf, lightOf, viewOf } from '../../vendor/anatomy/lathe.mjs';
import { filletOn } from './kit.mjs';

export const WIDTH = 480;
export const HEIGHT = 600;
/** Presque de face (revue R14) : la façade, plan y–z tourné vers +x, garde 96 % de sa hauteur. */
const AZIMUTH = 18;
const ELEVATION = 16;

export interface Frame {
	o: Point3;
	a: Point3;
	u: Point3;
	v: Point3;
}
export type UV = [number, number];

/** Repère d'une plaque de façade : épaisseur le long de x, (u, v) = (y, z). */
export const facing = (x: number): Frame => ({ o: [x, 0, 0], a: [1, 0, 0], u: [0, 1, 0], v: [0, 0, 1] });

// --- Cotes -----------------------------------------------------------------------------------

/** Planche murale (236 × 420 × 8). */
export const BOARD = { x: 0, y: 0, w: 8, d: 236, r: 2 };
export const BOARD_TOP = 420;
/** Caisse : façade des montants à x = 44, panneau des volets à 40, platine de la colonne à 24. */
export const FRONT = 44;
export const PANEL = 40;
export const PLATINE = 24;
export const BODY = { z0: 64, z1: 344 };

/** Colonne des volets : enjoliveurs, jacks à leur gauche, couloir du cordon contre le montant. */
export const WIN = { y0: 116, y1: 168, open0: 118, open1: 166, pitch: 52, height: 44 };
export const JACK_Y = 178;
export const LANE_Y = 200;
export const windowTop = (index: number) => 334 - WIN.pitch * index;
export const windowBottom = (index: number) => windowTop(index) - WIN.height;
export const jackZ = (index: number) => windowTop(index) - 6;

/** Volet : 46 × 34 × 2, charnière en bas ; il tombe vers le lecteur autour de l'axe y. */
export const FLAP = { y0: 119, y1: 165, axisX: 41.4, rise: 5, height: 34, half: 1, tab: [139, 145] as const };
export const flapAxisZ = (index: number) => windowBottom(index) + FLAP.rise;

/** Colonne de bande : c = 104 − y (0 contre le meneau, 74 contre le montant droit). */
export const col = (c: number) => 104 - c;
/** La bande, vue sur la tranche : 10 de large le long de x, 0,6 d'épaisseur. */
export const TAPE = { x0: 27, x1: 37, t: 0.6 };
/** Poulie lestée du bras danseur : sa hauteur suit les octets non lus. */
export const DANCER = { c: 60, r: 7, top: 268, bottom: 200, rod: 70, rodX: 31, perByte: 0.26 };
/** Galets de renvoi : la bande passe par-dessus le premier, puis s'enroule à droite du second. */
export const R1 = { c: 62, z: 301.9, r: 5 };
export const R2 = { c: 46.4, z: 286, r: 6 };

/** Fiche : turnée le long de x, de la pointe (dans le jack) au chapeau arrière. */
export const PLUG = { tip: 41.6, face: 45, rear: 75, out: 11 };
/** Passe-cordon sur la plinthe, et sommet de son ressort de garde. */
export const EYELET = { x: 44, y: LANE_Y, z: 64, top: 65.6, guard: 80 };

// --- Caméra ----------------------------------------------------------------------------------

/** Les points extrêmes de la figure, volets tombés et fiche en course comprise. */
export const EXTREMES: Point3[] = [
	[0, -50, 386],
	[0, -50, 426],
	[0, 0, 0],
	[0, 236, 0],
	[8, 236, 420],
	[0, 236, 420],
	[52, 12, 40],
	[52, 224, 40],
	[70, 158, 402],
	[40, 158, 410],
	[80, 119, 86],
	[90, JACK_Y, 334],
];
export const FIT = { width: WIDTH, height: HEIGHT, pad: 30, azimuth: AZIMUTH, elevation: ELEVATION };

/**
 * La caméra, écrite en clair pour que le module de mouvement n'embarque pas `fitProjection` :
 * c'est celle qui inscrit `EXTREMES` dans le viewBox, ce que le build vérifie (`geometry.ts`).
 */
export const projection: Projection = { origin: [350.0868451985199, 544.9805018507457], scale: 0.9839797496654055, azimuth: AZIMUTH, elevation: ELEVATION };
const P = projection;
/** Point du monde → point écran (viewBox). */
export const toScreen = (point: Point3): Flat => {
	const [x, y] = iso(point, P);
	return [x, y];
};

// --- Plaques de façade -------------------------------------------------------------------------

const at = (F: Frame, s: number, [u, v]: UV): Point3 => [
	F.o[0] + F.a[0] * s + F.u[0] * u + F.v[0] * v,
	F.o[1] + F.a[1] * s + F.u[1] * u + F.v[1] * v,
	F.o[2] + F.a[2] * s + F.u[2] * u + F.v[2] * v,
];
const dot = (a: Point3, b: Point3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const areaOf = (ring: Array<UV | Flat>) => ring.reduce((sum, [x, y], index) => {
	const [nx, ny] = ring[(index + 1) % ring.length];
	return sum + x * ny - nx * y;
}, 0);
const turned = (ring: Flat[], sign: number) => (Math.sign(areaOf(ring)) === sign ? ring : ring.slice().reverse());

function runsOf(flags: boolean[], want: boolean) {
	const count = flags.length;
	const start = flags.findIndex((flag, index) => flag !== flags[(index + count - 1) % count]);
	if (start < 0) return flags[0] === want ? [Array.from({ length: count + 1 }, (_, index) => index % count)] : [];
	const runs: number[][] = [];
	let run: number[] | null = null;
	for (let step = 0; step < count; step++) {
		const index = (start + step) % count;
		if (flags[index] === want) {
			if (!run) run = [index];
			run.push((index + 1) % count);
		} else if (run) {
			runs.push(run);
			run = null;
		}
	}
	if (run) runs.push(run);
	return runs;
}

/**
 * Plaque extrudée le long de `F.a`, de `s0` à `s1` : un contour (u, v) quelconque, concave ou
 * non, et des trous. C'est l'`extrude` du kit, couché sur un repère : la face vue tient le rôle du
 * dessus, les flancs prennent leur ton selon la lumière du kit, et la silhouette suit les flancs.
 */
export function plateOf(F: Frame, rings: UV[][], s0: number, s1: number): SolidPaths {
	const V = viewOf(P) as Point3;
	const L = lightOf(P) as Point3;
	const near = dot(F.a, V) >= 0;
	const sTop = near ? s1 : s0;
	const sBottom = near ? s0 : s1;
	const capNormal: Point3 = near ? F.a : [-F.a[0], -F.a[1], -F.a[2]];
	const buckets: string[][] = [[], [], [], [], []];
	const fill: string[] = [];
	const outline: string[] = [];
	const crease: string[] = [];
	const caps: [string[], string[]] = [[], []];
	let sign = 0;
	rings.forEach((given, ringIndex) => {
		// Le contour extérieur tourne dans le sens direct de (u, v), les trous dans l'autre.
		const ring = (areaOf(given) > 0) === (ringIndex === 0) ? given : given.slice().reverse();
		const count = ring.length;
		const top = ring.map((point) => toScreen(at(F, sTop, point)));
		const bottom = ring.map((point) => toScreen(at(F, sBottom, point)));
		if (!ringIndex) sign = Math.sign(areaOf(top)) || 1;
		const facingEdges = ring.map(([u0, v0], index) => {
			const [u1, v1] = ring[(index + 1) % count];
			const du = u1 - u0;
			const dv = v1 - v0;
			const length = Math.hypot(du, dv) || 1;
			const normal: Point3 = [
				(F.u[0] * dv - F.v[0] * du) / length,
				(F.u[1] * dv - F.v[1] * du) / length,
				(F.u[2] * dv - F.v[2] * du) / length,
			];
			const seen = dot(normal, V) > 1e-9;
			if (seen) {
				const next = (index + 1) % count;
				const quad = pathOf(turned([top[index], top[next], bottom[next], bottom[index]], sign), true);
				buckets[bandOf(dot(normal, L))].push(quad);
				fill.push(quad);
			}
			return seen;
		});
		for (const run of runsOf(facingEdges, false)) outline.push(pathOf(run.map((index) => top[index])));
		for (const run of runsOf(facingEdges, true)) {
			crease.push(pathOf(run.map((index) => top[index])));
			outline.push(pathOf(run.map((index) => bottom[index])));
		}
		for (let index = 0; index < count; index++) {
			if (facingEdges[(index + count - 1) % count] !== facingEdges[index]) outline.push(pathOf([top[index], bottom[index]]));
		}
		const hole = ringIndex ? -sign : sign;
		caps[0].push(pathOf(turned(top, hole), true));
		caps[1].push(pathOf(turned(bottom, hole), true));
	});
	buckets[bandOf(dot(capNormal, L))].push(caps[0].join(''));
	// Sur une plaque mince, les flancs ne débordent des faces que d'un trait : leurs propres tons,
	// opaques, suffisent à cacher ce qui est derrière.
	const thin = Math.abs(s1 - s0) <= 1.6;
	return {
		fill: [...caps[0], ...caps[1], ...(thin ? [] : fill)].join(''),
		outline: outline.join(''),
		crease: crease.join(''),
		top: buckets[4].join(''),
		shades: buckets.slice(0, 4).map((list) => list.join('')),
	};
}

export const rect = (u0: number, v0: number, u1: number, v1: number): UV[] => [
	[u0, v0],
	[u1, v0],
	[u1, v1],
	[u0, v1],
];

// --- Pièces dont la forme change -----------------------------------------------------------------

/** Volet tombé : à plat sur sa butée. */
export const FLAP_DOWN = Math.PI / 2;
/** Crochet d'armature tiré par l'électro-aimant : son bec se lève et libère la languette. */
export const HOOK_LIFT = -0.32;
export const hookRingOf = (index: number): UV[] => {
	const top = windowTop(index);
	return [[156, top - 0.8], [156, top - 3.2], [146.5, top - 3.2], [146.5, top - 6], [139.5, top - 6], [139.5, top - 0.8]];
};
/** Tourne un contour (y, z) d'`angle` autour de `pivot`, dans le sens de `spin`. */
export const turnUV = (ring: UV[], pivot: Point3, angle: number): UV[] => {
	const c = Math.cos(angle);
	const s = Math.sin(angle);
	return ring.map(([y, z]) => [pivot[1] + (y - pivot[1]) * c - (z - pivot[2]) * s, pivot[2] + (y - pivot[1]) * s + (z - pivot[2]) * c]);
};

/** Repère du volet `index` tombé de `angle` (0 levé, π/2 à plat sur sa butée). */
export function flapFrame(index: number, angle: number): Frame {
	const c = Math.cos(angle);
	const s = Math.sin(angle);
	return { o: [FLAP.axisX, 0, flapAxisZ(index)], a: [c, 0, -s], u: [0, 1, 0], v: [s, 0, c] };
}
/** Le volet, puis sa languette de relevage collée en haut de sa face avant. */
// Le volet part à 1 de l'axe : son bord bas reste tangent au charnon quel que soit l'angle.
export const FLAP_BODY = { ring: rect(FLAP.y0, 1, FLAP.y1, FLAP.height + 1), s0: -FLAP.half, s1: FLAP.half };
export const FLAP_TAB = { ring: rect(FLAP.tab[0], FLAP.height - 3, FLAP.tab[1], FLAP.height + 5), s0: FLAP.half, s1: FLAP.half + 1 };
export const flapPaths = (index: number, angle: number) => {
	const F = flapFrame(index, angle);
	return [plateOf(F, [FLAP_BODY.ring], FLAP_BODY.s0, FLAP_BODY.s1), plateOf(F, [FLAP_TAB.ring], FLAP_TAB.s0, FLAP_TAB.s1)];
};

/**
 * Trous du brin perforé, entre le perforateur et le premier galet : une rangée par octet, huit
 * pistes et la piste d'entraînement (la quatrième). `rows` compte les rangées déjà perforées ; la
 * rangée g avance avec la bande, son motif ne dépend que de g.
 */
export const HOLES = { c0: 44.6, c1: 54.6, pitch: 1.2, top: 307.5 };
export function tapeHoles(rows: number): Flat[] {
	const dots: Flat[] = [];
	const newest = Math.floor(rows);
	for (let g = newest; ; g--) {
		const c = HOLES.c0 + (rows - g) * HOLES.pitch;
		if (c > HOLES.c1) break;
		const byte = ((g * 73 + 41) % 251) | 1;
		for (let track = 0; track < 9; track++) {
			const on = track === 3 || (byte >> (track > 3 ? track - 1 : track)) & 1;
			if (on) dots.push(toScreen([TAPE.x0 + 1 + track, col(c), HOLES.top]));
		}
	}
	return dots;
}

/** Hauteur de la poulie lestée pour `bytes` octets non lus. */
export const dancerZ = (bytes: number) => Math.max(DANCER.bottom, DANCER.top - bytes * DANCER.perByte);

/** Barre de guidage carrée du bras danseur, entre ses deux consoles ; le chariot y coulisse. */
export const GUIDE = { plan: { x: DANCER.rodX - 0.8, y: col(DANCER.rod) - 0.8, w: 1.6, d: 1.6, r: 0 }, z0: 196, z1: 292, carriage: 3 };
/** Les deux tronçons visibles de la barre, sous et sur le chariot. */
export const guideSpans = (zp: number): [number, number][] => [
	[GUIDE.z0, zp - GUIDE.carriage],
	[zp + GUIDE.carriage, GUIDE.z1],
];
const UPRIGHT: Frame = { o: [0, 0, 0], a: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] };
const guideRing = rect(GUIDE.plan.x, GUIDE.plan.y, GUIDE.plan.x + GUIDE.plan.w, GUIDE.plan.y + GUIDE.plan.d);
export const guidePaths = (zp: number) => guideSpans(zp).map(([z0, z1]) => plateOf(UPRIGHT, [guideRing], z0, z1));

/**
 * Les deux brins de la boucle tampon, des galets jusqu'à la poulie lestée. Ils s'arrêtent sous son
 * flasque avant, qui cache l'enroulement : un brin qui frôlerait le tambour s'y emmêlerait à l'écran.
 */
export function loopRuns(zp: number) {
	// La bande passe à l'extérieur de la poulie : à sa droite en descendant, à sa gauche en remontant.
	const hidden = zp + 4.5;
	const down = { c0: DANCER.c + DANCER.r, c1: DANCER.c + DANCER.r + TAPE.t, z0: hidden, z1: R1.z };
	const up = { c0: DANCER.c - DANCER.r - TAPE.t, c1: DANCER.c - DANCER.r, z0: hidden, z1: R2.z };
	return [down, up].map(({ c0, c1, z0, z1 }) => ({
		ring: rect(col(c1), z0, col(c0), z1),
		frame: { o: [TAPE.x0, 0, 0] as Point3, a: [1, 0, 0] as Point3, u: [0, 1, 0] as Point3, v: [0, 0, 1] as Point3 },
	}));
}
export const loopPaths = (zp: number) => loopRuns(zp).map(({ ring, frame }) => plateOf(frame, [ring], 0, TAPE.x1 - TAPE.x0));

/** Ressort hélicoïdal d'axe z, coupé en moitiés arrière et avant pour l'ordre de peinture. */
export function coilZ(cx: number, cy: number, z0: number, z1: number, radius: number, turns: number, perTurn = 14, r1 = radius) {
	const count = Math.max(2, Math.round(turns * perTurn));
	const back: string[] = [];
	const front: string[] = [];
	let run: Flat[] = [];
	let near: boolean | null = null;
	for (let index = 0; index <= count; index++) {
		const angle = (index / count) * turns * Math.PI * 2;
		const c = Math.cos(angle);
		const s = Math.sin(angle);
		const r = radius + ((r1 - radius) * index) / count;
		const flat = toScreen([cx + r * c, cy + r * s, z0 + ((z1 - z0) * index) / count]);
		const seen = depthOf([c, s, 0], P) > 0;
		if (near !== null && seen !== near) {
			run.push(flat);
			(near ? front : back).push(pathOf(run));
			run = [];
		}
		near = seen;
		run.push(flat);
	}
	if (run.length > 1) (near ? front : back).push(pathOf(run));
	return { back: back.join(''), front: front.join('') };
}

/** Ressort de rappel du bras danseur, du chariot à la console haute. */
export const DANCER_SPRING = { top: 292, turns: 11, r: 1.85 };
export const dancerCoil = (zp: number) => coilZ(DANCER.rodX, col(DANCER.rod), zp + 3, DANCER_SPRING.top, DANCER_SPRING.r, DANCER_SPRING.turns);

/**
 * Le cordon, de l'arrière de la fiche au passe-cordon : il sort dans l'axe de la fiche, rejoint
 * le couloir contre le montant gauche et descend le long des jacks, sans croiser une fenêtre.
 * `out` et `z` sont la position de la fiche (sortie du jack, hauteur de son axe).
 */
export function cordRoute(z: number, out: number): Point3[] {
	const rear = PLUG.rear + out;
	const drop = Math.max(z - 16, 100);
	return filletOn(
		[
			[rear, JACK_Y, z],
			[rear + 7, JACK_Y, z],
			[60, LANE_Y, drop],
			[EYELET.x + 3, LANE_Y, Math.min(drop - 10, 96)],
			[EYELET.x, LANE_Y, EYELET.guard + 4],
			[EYELET.x, LANE_Y, EYELET.top],
		],
		6,
		P,
		CORD_R,
	);
}
export const CORD_R = 1.1;
export const CORD_RINGS = { pitch: 3.6, steps: 8, fade: [0.1, 0.55] as [number, number] };
/** Échantillonnage du cordon : assez fin pour ses courbes, sans alourdir le tracé. */
export const CORD_SPACING = 3.2;

/** Lumière des bandes d'un tube, celle de `tube.mjs`, dans le plan de l'écran. */
const SHINE = [-0.55 / Math.hypot(0.55, 0.835), -0.835 / Math.hypot(0.55, 0.835)];
const smooth = (value: number, [lo, hi]: [number, number]) => {
	const t = Math.min(1, Math.max(0, (value - lo) / (hi - lo)));
	return t * t * (3 - 2 * t);
};

/**
 * Le cordon tressé, dessiné d'un seul tenant : corps, bande claire et bande d'ombre, anneaux de
 * tresse qui suivent la section (leur moitié visible, estompée vers les bords) et arêtes. Mêmes
 * classes et mêmes décalages que les tubes de `tube.mjs`, en quelques lignes : il est redessiné
 * à chaque image du trajet de la fiche, dans un module de mouvement léger. Ses deux bouts sont
 * cachés (dans la fiche, sur l'œillet) : pas de capuchon.
 */
export function ropeSvg(route: Point3[], radius: number) {
	// Rééchantillonnage régulier le long du tracé 3D.
	const lengths = [0];
	for (let index = 1; index < route.length; index++) lengths.push(lengths[index - 1] + Math.hypot(...route[index].map((value, axis) => value - route[index - 1][axis])));
	const total = lengths[lengths.length - 1];
	const count = Math.max(2, Math.round(total / CORD_SPACING));
	const pointAt = (at: number): Point3 => {
		let index = 1;
		while (index < route.length - 1 && lengths[index] < at) index++;
		const t = Math.min(1, Math.max(0, (at - lengths[index - 1]) / (lengths[index] - lengths[index - 1] || 1)));
		return route[index - 1].map((value, axis) => value + (route[index][axis] - value) * t) as Point3;
	};
	const k = P.scale * Math.sqrt(1.6);
	const w = radius * k;
	const flat = Array.from({ length: count + 1 }, (_, index) => toScreen(pointAt((total * index) / count)));
	const normals = flat.map((_, index) => {
		const [ax, ay] = flat[Math.max(0, index - 1)];
		const [bx, by] = flat[Math.min(count, index + 1)];
		const length = Math.hypot(bx - ax, by - ay) || 1;
		return [-(by - ay) / length, (bx - ax) / length];
	});
	const offset = (by: (toward: number) => number) => flat.map(([x, y], index): Flat => {
		const [nx, ny] = normals[index];
		const d = by(nx * SHINE[0] + ny * SHINE[1]);
		return [x + nx * d, y + ny * d];
	});
	const band = (a: (toward: number) => number, b: (toward: number) => number) => pathOf([...offset(a), ...offset(b).reverse()], true);
	const left = offset(() => w);
	const right = offset(() => -w);
	// Anneaux : la moitié avant de chaque section, par paliers d'opacité.
	const V = viewOf(P) as Point3;
	const levels = new Map<number, string>();
	for (let at = CORD_RINGS.pitch / 2; at < total - CORD_RINGS.pitch / 3; at += CORD_RINGS.pitch) {
		const [p0, p1] = [pointAt(at - 0.5), pointAt(at + 0.5)];
		const t = p1.map((value, axis) => value - p0[axis]) as Point3;
		const tl = Math.hypot(...t) || 1;
		const a = t.map((value) => value / tl) as Point3;
		const helper: Point3 = Math.abs(a[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1];
		const u0: Point3 = [a[1] * helper[2] - a[2] * helper[1], a[2] * helper[0] - a[0] * helper[2], a[0] * helper[1] - a[1] * helper[0]];
		const ul = Math.hypot(...u0) || 1;
		const u = u0.map((value) => value / ul) as Point3;
		const v: Point3 = [a[1] * u[2] - a[2] * u[1], a[2] * u[0] - a[0] * u[2], a[0] * u[1] - a[1] * u[0]];
		const centre = pointAt(at);
		for (let step = 0; step < CORD_RINGS.steps * 2; step++) {
			const angles = [step, step + 1].map((s) => (s / (CORD_RINGS.steps * 2)) * Math.PI * 2);
			const mid = (angles[0] + angles[1]) / 2;
			const facing = dot([Math.cos(mid) * u[0] + Math.sin(mid) * v[0], Math.cos(mid) * u[1] + Math.sin(mid) * v[1], Math.cos(mid) * u[2] + Math.sin(mid) * v[2]], V);
			const alpha = Math.round(smooth(facing, CORD_RINGS.fade) * 4) / 4;
			if (!alpha) continue;
			const ends = angles.map((angle) => toScreen(centre.map((value, axis) => value + radius * (Math.cos(angle) * u[axis] + Math.sin(angle) * v[axis])) as Point3));
			levels.set(alpha, (levels.get(alpha) ?? '') + pathOf(ends));
		}
	}
	const rings = [...levels].map(([alpha, d]) => `<path class="tb-ring" data-tone="lo" d="${d}"${alpha < 1 ? ` opacity="${alpha}"` : ''}/>`).join('');
	return `<g class="tb"><path class="tb-body" d="${pathOf([...left, ...right.slice().reverse()], true)}"/><path class="tb-shine" d="${band((s) => w * (0.44 * s + 0.24), (s) => w * (0.44 * s - 0.24))}"/><path class="tb-shade" d="${band((s) => w * (-0.62 * s + 0.2), (s) => w * (-0.62 * s - 0.2))}"/>${rings}<path class="iso-line tb-edge" data-tone="mid" d="${pathOf(left) + pathOf(right)}"/></g>`;
}

// --- Zones de la façade sous le pointeur -------------------------------------------------------------

/** Rectangle écran (viewBox) qui couvre des points du monde. */
const boxOf = (points: Point3[]) => {
	const flat = points.map(toScreen);
	const xs = flat.map(([x]) => x);
	const ys = flat.map(([, y]) => y);
	return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
};
const corners = ([x0, x1]: number[], [y0, y1]: number[], [z0, z1]: number[]): Point3[] =>
	[x0, x1].flatMap((x) => [y0, y1].flatMap((y) => [z0, z1].map((z) => [x, y, z] as Point3)));
/** La fenêtre `index` : son enjoliveur et la place de son volet tombé. */
export const windowBox = (index: number) => boxOf(corners([PANEL, PANEL + 2 + FLAP.height + 2], [WIN.y0, WIN.y1], [windowBottom(index), windowTop(index)]));
/** Son jack, et la fiche quand elle y est branchée. */
export const jackBox = (index: number) => boxOf(corners([PANEL, PLUG.rear], [JACK_Y - 6, JACK_Y + 6], [jackZ(index) - 6, jackZ(index) + 6]));

// --- Pivots des pièces qui tournent dans le plan de la façade ---------------------------------------

/** Matrice SVG d'une rotation d'`angle` (rad) dans le plan y–z, autour de `pivot`. */
export function spin(pivot: Point3, angle: number) {
	const o = toScreen(pivot);
	const ey = toScreen([pivot[0], pivot[1] + 1, pivot[2]]);
	const ez = toScreen([pivot[0], pivot[1], pivot[2] + 1]);
	const [a, b, c, d] = [ey[0] - o[0], ey[1] - o[1], ez[0] - o[0], ez[1] - o[1]];
	const det = a * d - b * c;
	const cs = Math.cos(angle);
	const sn = Math.sin(angle);
	// E · R · E⁻¹, E = [ey ez] en colonnes.
	const r = [cs * d - sn * -b, cs * -c - sn * a, sn * d + cs * -b, sn * -c + cs * a].map((value) => value / det);
	const m = [a * r[0] + c * r[2], b * r[0] + d * r[2], a * r[1] + c * r[3], b * r[1] + d * r[3]];
	const e = o[0] - m[0] * o[0] - m[2] * o[1];
	const f = o[1] - m[1] * o[0] - m[3] * o[1];
	return `matrix(${[...m, e, f].map((value) => Math.round(value * 1e4) / 1e4).join(' ')})`;
}

/** Pivots (x du plan de la pièce, y, z). */
export const PIVOTS = {
	hook: (index: number): Point3 => [43.4, 153, windowTop(index) - 2],
	debit: [37.5, col(18.5), 318] as Point3,
	takeup: [37.5, col(29.8), 120] as Point3,
	escape: [33, col(18.8), 238] as Point3,
	sprocket: [33, col(33.8), 238] as Point3,
	anchor: [32.9, col(18.8), 252.5] as Point3,
	balance: [33.9, col(18.8), 270] as Point3,
	hammer: [36, 97, 388.8] as Point3,
	selector: [48.5, 104, 376] as Point3,
};
