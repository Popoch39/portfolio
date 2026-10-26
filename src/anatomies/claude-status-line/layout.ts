// Plan de la rampe à cadran, en unités du monde (x le long de la rampe, de gauche à droite dans
// l'ordre où `render()` pousse ses segments ; y vers le lecteur ; z vers le haut), et la caméra
// rasante. Partagé par la géométrie au repos (build, Node) et par le mouvement (navigateur) : rien
// de lourd ici, seulement des nombres et la projection.
import { fitProjection, type Plan, type Point3 } from '../../vendor/anatomy/iso-kit.ts';

export const WIDTH = 880;
export const HEIGHT = 250;
/** Vue rasante depuis le bout du cadran : azimut 70°, élévation 12° (décision R14 de la revue). */
export const AZIMUTH = 70;
export const ELEVATION = 12;

// --- Tablette (la zone de saisie de Claude Code) et ses brides -------------------------------------
export const TABLET: Plan = { x: -96, y: -60, w: 796, d: 60, r: 3 };
export const TABLET_Z = -8;
/** Chant avant, en bande rapportée. */
export const CHANT: Plan = { x: -96, y: 0, w: 796, d: 1, r: 0.4 };
export const CLAMPS = [110, 400];
export const CLAMP_W = 12;
export const SPINE_Y: [number, number] = [1, 3];
export const JAW_Y: [number, number] = [-16, 1];
export const JAW_LOW: [number, number] = [-22, -16];
export const SCREW_Y = -8;
export const HANDLE_Z = -35;

// --- Rampe ----------------------------------------------------------------------------------------
export const RAIL: Plan = { x: 0, y: 3, w: 640, d: 18, r: 1.2 };
export const RAIL_H = 24;
export const FRONT = RAIL.y + RAIL.d;
/** Fond de la fenêtre vitrée : la face avant est creusée de 4. */
export const RECESS = FRONT - 4;
export const WINDOW = { x0: 162, x1: 506, z0: 4, z1: 20 };
export const FRAME = 2;
/** Goujons « · » sur le dessus, entre modèle, dossier, 5h et sem. */
export const STUDS = [69, 151, 330];

// --- Tête d'aiguillage, sonde et capsule ------------------------------------------------------------
export const HEAD: Plan = { x: -48, y: 3, w: 44, d: 26, r: 3 };
export const HEAD_Z: [number, number] = [-6, 44];
export const HEAD_FRONT = HEAD.y + HEAD.d;
export const CAP_LEFT: Plan = { x: -4, y: 3, w: 4, d: 20, r: 0.8 };
export const CAP_LEFT_Z: [number, number] = [-2, 26];
/** Boisseau sur la face avant de la tête : centre (x, z). */
export const PLUG: [number, number] = [-26, 22];
export const PLUG_R = 8.5;
export const COLLAR_R = 11;
/** Levier : crans stdin, API, cache, en degrés depuis le haut, dans le sens horaire vu de face. */
export const DETENTS = [-40, 0, 40];
export const LEVER_LEN = 13;
export const LEVER_Y: [number, number] = [HEAD_FRONT + 6, HEAD_FRONT + 7.6];
export const BALL_R = 2.4;
/** Sonde : axe vers −x sortant de la face gauche de la tête. */
export const PROBE_AXIS: Point3 = [HEAD.x, 16, 30];
export const PROBE = { housing: 6, ring: [6, 10] as [number, number], gland: [10, 11.5] as [number, number], tip: 22, head: 3, rod: 1, ringR: 6.2, coilR: 2.5, stroke: 9 };
/** Capsule de cache vissée sous la tête, axe vers le bas. */
export const CAPSULE: Point3 = [-26, 16, HEAD_Z[0]];
export const CAPSULE_R = 9;
export const CAPSULE_NECK = 3;
export const CAPSULE_BODY = 13;
/** Tampon d'écriture : pivot sous la tête, frappe la capsule par la droite. */
export const HAMMER_PIVOT: [number, number] = [-12, -9];
export const HAMMER_Y: [number, number] = [14, 18];
/** Course du marteau (degrés) : sa tête vient au contact de la capsule, à 0,05 près. */
export const HAMMER_SWING = 9.6;
/**
 * Raccord stdin : de derrière la tablette jusqu'au-dessus de la tête. Il monte derrière la tête et
 * tourne dans deux coudes à boule : un virage dans le plan y–z, vu de biais, se pincerait à l'écran.
 */
export const STDIN_R = 2;
export const ELBOW_R = 3.2;
export const STDIN_X = -30;
export const STDIN_TOP = 56;
/** Le tronçon du haut part de biais (vers −x) pour quitter le premier coude de côté à l'écran. */
export const ELBOWS: Point3[] = [
	[STDIN_X, -10, STDIN_TOP],
	[STDIN_X - 8, 14, STDIN_TOP],
];
export const STDIN_START: Point3 = [STDIN_X, -50, 3.5];
export const STDIN_PORT: Point3 = [STDIN_X - 8, 14, HEAD_Z[1]];

// --- Plaques ----------------------------------------------------------------------------------------
export const MODEL_PLATE = { x0: 10, x1: 62, z0: 5, z1: 19 };
export const FOLDER_PLATE = { x0: 76, x1: 140, z0: 5, z1: 19 };
export const TAG = { x0: 122, x1: 134, z0: -11, z1: -2 };

// --- Modules 5h et semaine ----------------------------------------------------------------------------
export const MODULES = [168, 348];
export const MODULE_W = 144;
export const MODULE_Y: [number, number] = [RAIL.y, FRONT + 3];
export const MODULE_Z: [number, number] = [RAIL_H, 40];
export const MODULE_FRONT = MODULE_Y[1];
export const BLADE_PITCH = 12;
export const BLADE_FIRST = 9;
export const BLADE_LEN = 10;
export const BLADE_T = 1.4;
export const BLADE_Y: [number, number] = [8.4, 18.6];
export const GUIDE_BACK: [number, number] = [5.6, 8.2];
export const GUIDE_FRONT: [number, number] = [18.8, 21.4];
/** Assez hauts pour cacher entièrement une lame couchée, même vue de 12° au-dessus. */
export const GUIDE_H = 4;
/** Pivot d'une lame : son coin, posé sur le dessus du carter. */
export const PIVOT_Z = MODULE_Z[1] + BLADE_T / 2;
export const LABEL_SLOT = { dx0: 8, dx1: 34, z0: 29, z1: 35 };
/** Fenêtre des tambours : cinq tambours, pour « 23h59 », la chaîne la plus large. */
export const DRUMS = 5;
export const DRUM_PITCH = 9.4;
export const DRUM_WINDOW = { dx0: 82, z0: 27, z1: 37 };
export const DRUM_FONT = 7.2;

// --- Tiges de pourcentage, derrière la vitre ----------------------------------------------------------
export const ROD_Y = RECESS + 1.6;
export const ROD_R = 1.1;
export const RODS_Z = [13.4, 9.6];
/** Course d'une tige pour 100 % (unités) : la came k atteint la lame k à 10k − 5 %. */
export const TRAVEL = 60;
export const ROD_X: [number, number] = [6, 580];
export const PINION_R = 2;
export const PINIONS = [
	{ x: 492, z: 13.4 + 1.1 + PINION_R },
	{ x: 478, z: 9.6 - 1.1 - PINION_R },
];

// --- Arbre du temps et paliers ------------------------------------------------------------------------
export const SHAFT_Y = 6.4;
export const SHAFT_Z = -4.2;
export const SHAFT_R = 1.3;
export const SHAFT_X: [number, number] = [160, 640];
export const BEARINGS = [166, 330, 500, 606];
export const BEARING = { w: 8, y0: 3.4, y1: 9.4, z0: -9 };
export const DRUM_GEARS = [276, 456];

// --- Cadran, amortisseur ------------------------------------------------------------------------------
export const DIAL: [number, number] = [548, 36];
export const DIAL_R = 40;
export const DIAL_DEPTH = 10;
export const DIAL_FACE_Y = FRONT + DIAL_DEPTH;
export const BEZEL_R: [number, number] = [34, 39];
export const BEZEL_DEPTH = 2.5;
/** Échelle de 0 à 100 % sur 270°, de −135° à +135° depuis le haut. */
export const SWEEP = 270;
export const SCALE_R = BEZEL_R[0] - 2.4;
export const NEEDLES = { long: SCALE_R - 2, short: SCALE_R - 11, tail: 7 };
export const DAMPER = { o: [562, 15, -15] as Point3, body: 30, r: 4.5, gland: 2, rod: 0.9, rest: 8, stroke: 6 };
export const DAMPER_BRACKET: Plan = { x: 536, y: 11, w: 22, d: 8, r: 0.8 };
export const LEVER_PIVOT: Point3 = [516, 15, -2];

// --- Volant, croix de Malte et embout droit -----------------------------------------------------------
export const WHEEL: [number, number] = [617, 12];
export const WHEEL_R: [number, number] = [15, 18];
/** Jante, rayons et moyeu partent tous du même plan, FRONT + 5 : rien ne passe derrière un rayon. */
export const WHEEL_S: [number, number] = [5, 9];
export const CRANK_R = 12.6;
export const BOX: Plan = { x: 640, y: 3, w: 44, d: 26, r: 2 };
export const BOX_Z: [number, number] = [-6, 46];
export const BOX_FRONT = BOX.y + BOX.d;
export const PORTHOLE: [number, number] = [662, 28];
export const PORTHOLE_R = 13;
export const PORTHOLE_DEPTH = 4;

const extremes: Point3[] = [
	[TABLET.x, TABLET.y, TABLET_Z],
	[TABLET.x, 1, TABLET_Z],
	[TABLET.x + TABLET.w, TABLET.y, 0],
	[TABLET.x + TABLET.w, 1, TABLET_Z],
	[PROBE_AXIS[0] - PROBE.tip - PROBE.head - PROBE.stroke, PROBE_AXIS[1], PROBE_AXIS[2] + 3.5],
	[CLAMPS[0], SCREW_Y, HANDLE_Z - 2],
	[CLAMPS[1], SCREW_Y, HANDLE_Z - 2],
	[DIAL[0], FRONT, DIAL[1] + DIAL_R],
	[-30, -12, 58],
	[WHEEL[0], FRONT + 17, WHEEL[1] - WHEEL_R[1]],
	[CAPSULE[0], CAPSULE[1] + CAPSULE_R, CAPSULE[2] - CAPSULE_NECK - CAPSULE_BODY - CAPSULE_R],
];

export const projection = fitProjection(extremes, WIDTH, HEIGHT, { pad: 22, azimuth: AZIMUTH, elevation: ELEVATION });
