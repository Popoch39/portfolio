// Mise en place de la colonne de sondage, partagée par la géométrie (build) et le mouvement
// (navigateur) : caméra, cotes des pièces qui bougent, et la forme fixe des solides que le
// mouvement redessine (accouplements, segments de couronne, manivelle). Léger à dessein : le
// mouvement l'importe, pas la géométrie.
import { extrude, fitProjection, iso, type Flat, type Plane, type Point3, type Projection, type SolidPaths } from '../../vendor/anatomy/iso-kit.ts';
import { BIT_REST, DEPTH } from './model.ts';

export const WIDTH = 400;
export const HEIGHT = 660;
export const ELEVATION = 40;

/** Préfixe des identifiants SVG : plusieurs figures coexistent dans l'aperçu de l'accueil. */
export const ID = 'ma-parcelle';

// Colonne.
export const R_SHELL = 56;
export const R_SOIL = 53.6;
export const R_FLANGE = 63;
export const R_BOTTOM = 70;
export const R_LID = 66;
export const R_PLATEAU = 56;
export const BORE = 10;
export const LID: readonly [number, number] = [204, 210];
export const PLATEAU: readonly [number, number] = [210, 214];
export const TUBAGE_TOP = 224;

// Mât, derrière la colonne (côté -x).
export const MAST_X = -78;
export const POST_Y = 22;
export const POST_R = 3.6;
export const SCREW_R = 3.2;
export const POSTS: readonly [number, number][] = [
	[MAST_X, POST_Y],
	[MAST_X, -POST_Y],
];
/** La vis, du palier de la console à la traverse de tête (au-delà, elle est cachée par la traverse et le moyeu). */
export const SCREW: readonly [number, number, number] = [223, 556.4, SCREW_R];

// Train de forage au repos (z), qui descend de `depth`.
export const CROWN: readonly [number, number] = [BIT_REST, BIT_REST + 3];
export const TEETH = 8;
export const BARREL: readonly [number, number] = [234, 288];
export const WINDOW: readonly [number, number] = [238, 282];
export const COUPLINGS: readonly (readonly [number, number])[] = [
	[342, 349],
	[397, 404],
];
export const COUPLING_R = 5.2;

// Manivelle d'avance, en bout de vis.
export const CRANK_Z: readonly [number, number] = [571, 573.4];
export const CRANK_ARM = 20;

// Tambour du treuil, côté -y, axe selon x.
export const DRUM: readonly [number, number] = [-80, 228];
export const DRUM_R = 7;
export const CHEEK_X = 8.6;

// Log de sondage : plaque tournée vers le lecteur, à gauche de la colonne de mât +y.
export const LOG_Z: readonly [number, number] = [494, 538];
export const LOG_A: readonly [number, number] = [-46, -9];
export const LOG_FACE = 0.9;
export const SLOT_A = -38;
export const NOTCH = 6;
export const rowZ = (index: number) => LOG_Z[1] - 8.6 - index * 6.2;

/** Repère de la face du log : `a` vers la droite de l'écran, `n` vers le lecteur. */
export const RIGHT: Point3 = [Math.SQRT1_2, -Math.SQRT1_2, 0];
export const TOWARD: Point3 = [Math.SQRT1_2, Math.SQRT1_2, 0];
export const onLog = (a: number, n: number, z: number): Point3 => [
	MAST_X + RIGHT[0] * a + TOWARD[0] * n,
	POST_Y + RIGHT[1] * a + TOWARD[1] * n,
	z,
];

const extent: Point3[] = [
	...[0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2, Math.PI / 4, (5 * Math.PI) / 4].flatMap((t) => [
		[R_BOTTOM * Math.cos(t), R_BOTTOM * Math.sin(t), 0] as Point3,
	]),
	[R_BOTTOM * Math.cos(Math.PI / 4), R_BOTTOM * Math.sin(Math.PI / 4), -2],
	[-78 - 26, 0, 584],
	[-78 + 26, 0, 584],
	[-78, 26, 584],
	[-78, -26, 584],
	onLog(LOG_A[0] - 1, 0, LOG_Z[0]),
	onLog(LOG_A[0] - 1, 0, LOG_Z[1]),
	[0, DRUM[0] - 14, DRUM[1] - 14],
	[0, DRUM[0] - 14, DRUM[1] + 14],
	[78 * Math.cos(-0.87), 78 * Math.sin(-0.87), 0],
	[78 * Math.cos(2.44), 78 * Math.sin(2.44), 0],
];

export const projection: Projection = fitProjection(extent, WIDTH, HEIGHT, { pad: 26, elevation: ELEVATION });

const tenth = (value: number) => Math.round(value * 10) / 10;
export const xy = (point: Point3) => iso(point, projection);
export const pathOf = (points: Flat[], closed = false) =>
	points.length ? points.map(([x, y], index) => `${index ? 'L' : 'M'}${tenth(x)} ${tenth(y)}`).join('') + (closed ? 'Z' : '') : '';

/**
 * Un solide dont le mouvement réécrit les tracés : toujours les mêmes nœuds (fond, quatre ombres,
 * dessus, arête), même vides, pour que le mouvement n'ait qu'à changer leurs `d`.
 */
export function liveSolid(paths: SolidPaths, attrs: string, tone = 'mid') {
	const shades = [0, 1, 2, 3].map((shade) => `<path class="iso-shade" data-shade="${shade}" d="${paths.shades[shade] ?? ''}"/>`).join('');
	return `<g class="iso-solid" ${attrs}><path class="iso-fill" d="${paths.fill}"/>${shades}<path class="iso-top" d="${paths.top}"/><path class="iso-line iso-crease" data-tone="faint" d="${paths.crease}"/><path class="iso-line iso-edge" data-tone="${tone}" d="${paths.outline}"/></g>`;
}

/** Réécrit les tracés d'un `liveSolid`. */
export function setSolid(node: Element, paths: SolidPaths) {
	const [fill, s0, s1, s2, s3, top, crease, edge] = node.children;
	fill.setAttribute('d', paths.fill);
	[s0, s1, s2, s3].forEach((shade, index) => shade.setAttribute('d', paths.shades[index] ?? ''));
	top.setAttribute('d', paths.top);
	crease.setAttribute('d', paths.crease);
	edge.setAttribute('d', paths.outline);
}

const ring = (cx: number, cy: number, points: [number, number][], turn: number): Plane[] =>
	points.map(([r, t]) => [cx + r * Math.cos(t + turn), cy + r * Math.sin(t + turn)]);

/** Accouplement six pans d'un tronçon de tiges, tourné de `turn`. */
export const couplingPaths = (index: number, turn: number) =>
	extrude(
		ring(0, 0, Array.from({ length: 6 }, (_, k) => [COUPLING_R, (k * Math.PI) / 3] as [number, number]), turn),
		COUPLINGS[index][0],
		COUPLINGS[index][1] - COUPLINGS[index][0],
		projection,
	);

/** Les segments diamantés de la couronne, triés du fond vers le lecteur. */
export function teethPaths(turn: number) {
	const width = (2 * Math.PI) / TEETH / 2.4;
	return Array.from({ length: TEETH }, (_, k) => turn + (k * 2 * Math.PI) / TEETH)
		.map((t) => ({ t, depth: Math.cos(t - Math.PI / 4) }))
		.sort((a, b) => a.depth - b.depth)
		.map(({ t }) => {
			const steps = [-1, 0, 1].map((f) => t + (f * width) / 2);
			const outline: Plane[] = [...steps.map((s) => [9.8 * Math.cos(s), 9.8 * Math.sin(s)] as Plane), ...steps.reverse().map((s) => [8.4 * Math.cos(s), 8.4 * Math.sin(s)] as Plane)];
			return extrude(outline, CROWN[0], CROWN[1] - CROWN[0], projection, { convex: true });
		});
}

/** Bras de la manivelle, tourné de `turn` autour de la vis. */
export function crankPaths(turn: number) {
	const c = Math.cos(turn);
	const s = Math.sin(turn);
	const local: Plane[] = [
		[-1.6, -2.2],
		[CRANK_ARM + 2.2, -1.8],
		[CRANK_ARM + 2.2, 1.8],
		[-1.6, 2.2],
	];
	return extrude(
		local.map(([u, v]) => [MAST_X + u * c - v * s, u * s + v * c]),
		CRANK_Z[0],
		CRANK_Z[1] - CRANK_Z[0],
		projection,
	);
}

/** Bout du bras de la manivelle, où se visse la poignée. */
export const crankEnd = (turn: number): Point3 => [MAST_X + CRANK_ARM * Math.cos(turn), CRANK_ARM * Math.sin(turn), CRANK_Z[1]];

/** Points des repères sur la joue du tambour, tournés de `turn`. */
export const drumMarks = (turn: number) =>
	Array.from({ length: 4 }, (_, k) => turn + (k * Math.PI) / 2).map((t) =>
		xy([CHEEK_X + 0.1, DRUM[0] + 7.6 * Math.cos(t), DRUM[1] + 7.6 * Math.sin(t)]),
	);

/** Fond du forage : le tiers de disque au bas du trou, vu dans l'écorché. */
export const boreFloorAt = (z: number) => {
	const arc = Array.from({ length: 19 }, (_, k) => Math.PI / 2 + (k * (3 * Math.PI)) / 2 / 18);
	return pathOf([[0, 0, z] as Point3, ...arc.map((t) => [BORE * Math.cos(t), BORE * Math.sin(t), z] as Point3)].map(xy), true);
};

/** Ce que l'écorché laisse voir du forage : la bande entre les arêtes de coupe, du dessus de la croûte au fond du trou. */
export function boreClipAt(z: number, top: number) {
	const arc = Array.from({ length: 13 }, (_, k) => Math.PI + (k * Math.PI) / 2 / 12).map((t) => xy([BORE * Math.cos(t), BORE * Math.sin(t), top]));
	return pathOf([...arc, xy([BORE, 0, z]), xy([0, 0, z]), xy([0, BORE, z])], true);
}

/** La carotte dans la fenêtre du carottier : 32 requêtes sur la hauteur de la fenêtre, moins la course du treuil. */
export const CORE_SCALE = (WINDOW[1] - WINDOW[0] - 4) / 32;

/**
 * Le point d'écran `(x, y)` tombe-t-il sur le cylindre vertical d'axe z, de rayon `r`, entre `z0` et
 * `z1` ? Sert à savoir si l'on appuie sur le fût de la colonne ou sur le plateau.
 */
export function onCylinder([x, y]: Flat, r: number, z0: number, z1: number) {
	const [ax, top] = xy([0, 0, z1]);
	const [, bottom] = xy([0, 0, z0]);
	const k = (bottom - top) / ((z1 - z0) * Math.cos((ELEVATION * Math.PI) / 180));
	const u = (x - ax) / (r * k);
	if (Math.abs(u) > 1) return false;
	const half = r * k * Math.sin((ELEVATION * Math.PI) / 180) * Math.sqrt(1 - u * u);
	return y >= top - half && y <= bottom + half;
}

export const SWIVEL_TOP = 520;
/** Le câble de repêchage, coupé où il entre dans l'émerillon. */
export function cableClipAt(depth: number) {
	const [x] = xy([0, 0, 0]);
	const [, y] = xy([0, 0, SWIVEL_TOP - depth - 0.6]);
	const box = `M-50 -50H${WIDTH + 50}V${HEIGHT + 50}H-50Z`;
	return `${box}M${tenth(x - 3)} ${tenth(y)}V${HEIGHT + 50}H${tenth(x + 3)}V${tenth(y)}Z`;
}

export { DEPTH };
