// Plan du meuble à fiches, en unités du monde (environ 1 mm) : x vers la façade à tiroirs, y vers le
// flanc au totalisateur, z vers le haut. La géométrie (build) et le mouvement (navigateur) lisent
// les mêmes cotes ; ce module reste petit pour ne pas alourdir le morceau de mouvement.
import { fitProjection, iso, pathOf, type Plan, type Point3, type Projection } from '../../vendor/anatomy/iso-kit.ts';
import { DRAWERS, FIELDS, notched, pageRequest, REST_PAGE } from './model.ts';

export const WIDTH = 624;
export const HEIGHT = 480;
/** 3/4 bas : le flanc en grande face, la façade en raccourci (décisions de la revue #21). */
export const AZIMUTH = 57;
export const ELEVATION = 20;

/** Caisson : façade à x = DEPTH, flanc à y = SPAN. */
export const DEPTH = 400;
export const SPAN = 340;
export const PLINTH = 34;
export const BODY_BOTTOM = 40;
export const BODY_TOP = 390;
/** Dessus du panneau supérieur, sous le gabarit. */
export const TOP = 410;

/** Montants et traverses de façade, et leur saillie sur le caisson. */
export const STILE = 14;
export const FRAME = 3;
const RAILS = [12, 10, 10, 14];
const ROW = (BODY_TOP - BODY_BOTTOM - RAILS.reduce((sum, rail) => sum + rail, 0)) / 3;

export interface Opening {
	/** Numéro du tiroir, donc de la page. */
	drawer: number;
	y0: number;
	y1: number;
	z0: number;
	z1: number;
}

/** Bas de chaque rangée, du haut vers le bas : rangée 1 (tiroirs 1 et 2), 2, 3. */
const rowBottom = (row: number) => BODY_BOTTOM + RAILS[0] + (2 - row) * (ROW + RAILS[1]);

/**
 * Les six ouvertures, lues comme un texte : à l'écran, la colonne voisine du flanc est à gauche.
 * Tiroir 1 en haut à gauche, 2 en haut à droite, 3 et 4 au milieu, 5 et 6 en bas.
 */
export const openings: Opening[] = Array.from({ length: DRAWERS }, (_, index) => {
	const row = Math.floor(index / 2);
	const nearFlank = index % 2 === 0;
	const y0 = nearFlank ? SPAN / 2 + STILE / 2 : STILE;
	const z0 = rowBottom(row);
	return { drawer: index + 1, y0, y1: y0 + (SPAN - STILE * 3) / 2, z0, z1: z0 + ROW };
});

/** Le tiroir tiré est construit dans l'ouverture 1 et déplacé vers les autres. */
export const HOME = openings[0];
export const offsetTo = (opening: Opening): Point3 => [0, opening.y0 - HOME.y0, opening.z0 - HOME.z0];

/** Course du tiroir tiré, et montée des fiches levées (la plus avancée ; les autres en escalier). */
export const TRAVEL = 260;
export const CARD_LIFT = 26;
export const CARD_STAIR = 1.8;
export const CARDS = 20;
/** Fiches du tiroir : x de la première (au fond) et pas entre deux fiches. */
export const CARD_X0 = 300;
export const CARD_PITCH = 4;

/** Gabarit : la fiche de demande, dans le plan y = CARD_Y, et ses douze broches. */
export const CARD_Y = 200;
export const REQUEST = { x0: 156, x1: 252, z0: 440, z1: 488 };
/** Montée de la fiche au-dessus des lèvres pour entrer, puis course d'entrée le long de x. */
export const REQUEST_RISE = 9;
export const REQUEST_FEED = 110;
/** Chute dans la fente, jusqu'à disparaître. */
export const REQUEST_DROP = 52;
export const HOLE_PITCH = 7;
export const HOLE_DEPTH = 5;
export const holeX = (index: number) => REQUEST.x0 + 9.5 + index * HOLE_PITCH;
export const PIN_COUNT = FIELDS.length;
/** Broche relevée (fiche absente) et broche tombée dans son encoche. */
export const PIN_RAISED = 10;
export const PIN_NOTCH = 6.5;
/** La broche `pageSize` bute sur sa butée avant le fond de l'encoche. */
export const PIN_STOP = 2;

/** Boîtier de la fente, et sortie vers la goulotte sur sa face +y. */
export const SLOT_BOX: Plan = { x: 126, y: 178, w: 156, d: 46, r: 2.5 };
export const SLOT_TOP = 444;
export const OUTLET = { x0: 152, x1: 250, z0: 428, z1: 436 };

/** Goulotte : un plan incliné de la sortie jusqu'au-dessus du bac, qui passe juste le bord du dessus. */
export const CHUTE = { x0: 146, x1: 254, start: [SLOT_BOX.y + SLOT_BOX.d, OUTLET.z0] as const, end: [352, 411.5] as const };

/** Bac de rejet, accroché au flanc sous la corniche. */
export const BIN: Plan = { x: 144, y: SPAN + 2.5, w: 112, d: 62, r: 1.5 };
export const BIN_Z = [340, 386] as const;

/** Fiche refusée posée à plat dans la goulotte : 96 de large (le long de x), 48 de long (le long de y). */
export const REJECT = { x0: 152, x1: 248, length: 48, thickness: 1.2 };

/** Totalisateur sur le flanc : boîtier, et ses deux fenêtres (trois roues pour le total, une pour les pages). */
export const TOTALIZER: Plan = { x: 266, y: SPAN + 4.5, w: 96, d: 18, r: 2.5 };
export const TOTALIZER_Z = [290, 348] as const;
export const WINDOW_Z = [309, 329] as const;
export const WHEEL_PITCH = WINDOW_Z[1] - WINDOW_Z[0];
export const WINDOWS = [
	{ x0: 276, x1: 310, wheels: 3 },
	{ x0: 322, x1: 336, wheels: 1 },
];

/** Tout ce qui bouge reste dans le cadre : chaque tiroir sorti, fiches levées, et le gabarit. */
const extremes: Point3[] = [
	[-8, -8, 0],
	[-8, SPAN + 8, 0],
	[DEPTH + 8, -8, 0],
	[DEPTH + 8, SPAN + 8, 0],
	[-8, -8, TOP],
	[-8, SPAN + 8, TOP],
	[DEPTH + 8, -8, TOP],
	[DEPTH + 8, SPAN + 8, TOP],
	[BIN.x, BIN.y + BIN.d, BIN_Z[0]],
	[104, 160, 546],
	[304, 244, 546],
	...openings.flatMap(({ y0, y1, z0, z1 }): Point3[] => [
		[DEPTH + TRAVEL + 14, y0, z0],
		[DEPTH + TRAVEL + 14, y1, z0],
		[DEPTH + TRAVEL + 14, y0, z1 + CARD_LIFT + CARD_STAIR * CARDS],
	]),
];

export const projection: Projection = fitProjection(extremes, WIDTH, HEIGHT, { pad: 20, azimuth: AZIMUTH, elevation: ELEVATION });

/** La broche tombée au repos : seule la broche `page` trouve son encoche. */
export const restDrop = (index: number) => (notched(pageRequest(REST_PAGE), FIELDS[index]) ? -PIN_NOTCH : 0);

/** La surface de la goulotte, à l'ordonnée y : une pente droite de la sortie au bac. */
export const chuteZ = (y: number) => CHUTE.start[1] + ((y - CHUTE.start[0]) * (CHUTE.end[1] - CHUTE.start[1])) / (CHUTE.end[0] - CHUTE.start[0]);
/** Bord arrière de la fiche refusée au départ, encore dans le boîtier. */
export const REJECT_START = SLOT_BOX.y + 4;

/** Le clapet de sortie, pendu à sa charnière ; `angle` le fait basculer vers la goulotte. */
export const FLAP_HINGE = OUTLET.z1 + 1;
const FLAP_LENGTH = OUTLET.z1 - OUTLET.z0 + 3;
export function flapPath(angle: number) {
	const face = SLOT_BOX.y + SLOT_BOX.d + 1;
	const dy = FLAP_LENGTH * Math.sin(angle);
	const dz = FLAP_LENGTH * Math.cos(angle);
	const [x0, x1] = [OUTLET.x0 - 2, OUTLET.x1 + 2];
	const corners: Point3[] = [
		[x0, face, FLAP_HINGE],
		[x1, face, FLAP_HINGE],
		[x1, face + dy, FLAP_HINGE - dz],
		[x0, face + dy, FLAP_HINGE - dz],
	];
	return pathOf(
		corners.map((point) => iso(point, projection)),
		true,
	);
}
