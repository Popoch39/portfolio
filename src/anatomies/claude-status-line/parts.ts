// Les pièces qui changent de forme en bougeant (lames qui basculent, levier, marteau, rayons du
// volant, bielle de l'amortisseur, graduations de la bague, ressort de la sonde) : construites ici
// une seule fois pour la figure au repos et pour le mouvement, qui les reconstruit à chaque image.
import { coil, iso, lineSvg, pathOf, solidSvg, type Point3, type Tone } from '../../vendor/anatomy/iso-kit.ts';
import { prismOf } from '../../vendor/anatomy/lathe.mjs';
import {
	CAPSULE,
	CAPSULE_BODY,
	CAPSULE_NECK,
	CAPSULE_R,
	CRANK_R,
	DRUMS,
	PINION_R,
	PORTHOLE,
	SWEEP,
	TRAVEL,
	BLADE_LEN,
	BLADE_T,
	BLADE_Y,
	HAMMER_PIVOT,
	HAMMER_Y,
	LEVER_LEN,
	LEVER_PIVOT,
	LEVER_Y,
	PLUG,
	PROBE,
	PROBE_AXIS,
	projection as P,
	WHEEL,
	WHEEL_R,
	WHEEL_S,
	FRONT,
	DAMPER,
} from './layout.ts';

const RAD = Math.PI / 180;

/**
 * Repère d'un plan vertical parallèle à la face avant, extrudé selon +y : un point local (u, w)
 * est le point du monde (x + u, ·, z − w). Il est direct, comme le veut `prismOf`.
 */
const alongY = (x: number, z: number) => ({ o: [x, 0, z] as Point3, a: [0, 1, 0] as Point3, u: [1, 0, 0] as Point3, v: [0, 0, -1] as Point3 });

/** Rectangle (u, w) tourné de `angle` degrés autour de l'origine, dans le sens horaire vu de face. */
function turned(points: [number, number][], angle: number): [number, number][] {
	const c = Math.cos(angle * RAD);
	const s = Math.sin(angle * RAD);
	// Sens horaire vu de face : le haut (w < 0) part vers +x.
	return points.map(([u, w]) => [u * c - w * s, u * s + w * c]);
}

const prismSvg = (x: number, z: number, polygon: [number, number][], y: [number, number], tone: Tone, lit = false) =>
	solidSvg(prismOf(alongY(x, z), polygon, y[0], y[1], P), { tone, crease: tone === 'hi' ? 'lo' : 'faint', lit });

/** Lame du peigne, pivot à son coin gauche : 0° couchée vers +x, 90° dressée. */
export function bladeSvg(pivotX: number, pivotZ: number, raise: number) {
	const h = BLADE_T / 2;
	const rect: [number, number][] = [
		[-h, -h],
		[BLADE_LEN - h, -h],
		[BLADE_LEN - h, h],
		[-h, h],
	];
	// Une lame couchée pointe vers +x ; dressée, elle tourne de −90° (sens trigonométrique vu de face).
	return prismSvg(pivotX, pivotZ, turned(rect, -raise * 90), BLADE_Y, 'hi');
}

/** Levier d'aiguillage, de son moyeu à sa boule, à `angle` degrés depuis le haut. */
export function leverSvg(angle: number) {
	const arm: [number, number][] = [
		[-1.6, 2.2],
		[1.6, 2.2],
		[1.1, -LEVER_LEN],
		[-1.1, -LEVER_LEN],
	];
	return prismSvg(PLUG[0], PLUG[1], turned(arm, angle), LEVER_Y, 'hi');
}

/** Centre de la boule du levier. */
export const leverTip = (angle: number): Point3 => [
	PLUG[0] + Math.sin(angle * RAD) * (LEVER_LEN + 2),
	(LEVER_Y[0] + LEVER_Y[1]) / 2,
	PLUG[1] + Math.cos(angle * RAD) * (LEVER_LEN + 2),
];

/** Marteau du tampon d'écriture : bras et tête, tournés de `angle` degrés vers la capsule. */
export function hammerSvg(angle: number) {
	const arm: [number, number][] = [
		[-0.9, -0.9],
		[0.9, -0.9],
		[0.6, 7.4],
		[-0.6, 7.4],
	];
	const head: [number, number][] = [
		[-3.4, 6.2],
		[-0.2, 6.2],
		[-0.2, 9.8],
		[-3.4, 9.8],
	];
	// Sens horaire vu de face : le bas du marteau part vers −x, vers la capsule.
	return prismSvg(HAMMER_PIVOT[0], HAMMER_PIVOT[1], turned(arm, angle), HAMMER_Y, 'mid') + prismSvg(HAMMER_PIVOT[0], HAMMER_PIVOT[1], turned(head, angle), HAMMER_Y, 'hi');
}

/** Bielle qui relie la chape de l'amortisseur à l'axe des aiguilles. */
export function linkSvg(angle: number) {
	const bar: [number, number][] = [
		[-1.1, -0.8],
		[1.1, -0.8],
		[0.9, 13.4],
		[-0.9, 13.4],
	];
	return prismSvg(LEVER_PIVOT[0], LEVER_PIVOT[2], turned(bar, angle), [LEVER_PIVOT[1] - 1, LEVER_PIVOT[1] + 1], 'mid');
}

/** Rayons du volant : quatre bras dans le plan de la jante, tournés de `turns` tours (u, w autour du moyeu). */
export const SPOKES_Y: [number, number] = [FRONT + WHEEL_S[0], FRONT + WHEEL_S[0] + 2.6];
export function spokePolygons(turns: number) {
	// Chaque bras va du flanc du moyeu (r 3,6) à l'intérieur de la jante, sans y entrer.
	const bar: [number, number][] = [
		[-1.2, -3.62],
		[1.2, -3.62],
		[0.9, -WHEEL_R[0] + 0.05],
		[-0.9, -WHEEL_R[0] + 0.05],
	];
	return [0, 90, 180, 270].map((a) => turned(bar, a + turns * 360));
}
export const spokesSvg = (turns: number) => spokePolygons(turns).map((polygon) => prismSvg(WHEEL[0], WHEEL[1], polygon, SPOKES_Y, 'mid')).join('');

/** Angle de l'index fixe sur le corps de la sonde, en tours depuis le haut vers le lecteur. */
export const RING_INDEX = 0.2;

/** Graduations de la bague de temporisation (une toutes les 0,5 s), estompées vers les flancs. */
export function ringTicksSvg(turns: number) {
	const [s0, s1] = PROBE.ring;
	const r = PROBE.ringR;
	const out: string[] = [];
	for (let index = 0; index < 5; index++) {
		// La graduation 0 part sous l'index fixe, sur le flanc tourné vers le lecteur.
		const a = (index / 5 + turns + RING_INDEX) * 2 * Math.PI;
		const ny = Math.sin(a);
		const nz = Math.cos(a);
		const alpha = fade(ny * VIEW[1] + nz * VIEW[2], 0.1, 0.55);
		if (alpha < 0.03) continue;
		const at = (s: number): Point3 => [PROBE_AXIS[0] - s, PROBE_AXIS[1] + r * ny, PROBE_AXIS[2] + r * nz];
		out.push(faded(pathOf([iso(at(s0), P), iso(at(s1), P)]), alpha, index ? 'lo' : 'hi'));
	}
	return out.join('');
}

const VIEW = (() => {
	const a = (P.azimuth ?? 45) * RAD;
	const e = (P.elevation ?? 30) * RAD;
	return [Math.cos(a) * Math.cos(e), Math.sin(a) * Math.cos(e), Math.sin(e)];
})();
const fade = (value: number, lo: number, hi: number) => {
	const t = Math.max(0, Math.min(1, (value - lo) / (hi - lo)));
	return t * t * (3 - 2 * t);
};
const faded = (d: string, alpha: number, tone: Tone) => (alpha >= 0.97 ? lineSvg(d, { tone }) : `<g opacity="${alpha.toFixed(2)}">${lineSvg(d, { tone })}</g>`);

/** Moletage de la jante du volant (stries selon y), tourné de `turns` tours, estompé vers les flancs. */
export function knurlSvg(turns: number) {
	const r = WHEEL_R[1];
	const out: string[] = [];
	for (let index = 0; index < KNURLS; index++) {
		const a = (index / KNURLS + turns) * 2 * Math.PI;
		const nx = Math.sin(a);
		const nz = Math.cos(a);
		const alpha = fade(nx * VIEW[0] + nz * VIEW[2], 0.05, 0.35);
		if (alpha < 0.03) continue;
		const x = WHEEL[0] + r * nx;
		const z = WHEEL[1] + r * nz;
		out.push(faded(pathOf([iso([x, FRONT + WHEEL_S[0] + 0.4, z], P), iso([x, FRONT + WHEEL_S[1] - 0.4, z], P)]), alpha, 'lo'));
	}
	return out.join('');
}
const KNURLS = 72;

/**
 * Ressort de la sonde, dessiné dans le groupe du plongeur qui sort de `out` unités vers −x : sa
 * base reste sur le presse-étoupe, son bout suit la tête du plongeur.
 */
export function probeCoil(out: number) {
	const gland = PROBE_AXIS[0] - PROBE.gland[1];
	const head = PROBE_AXIS[0] - PROBE.tip;
	return coil(gland + out, head, [PROBE_AXIS[1], PROBE_AXIS[2]], PROBE.coilR, 6, 'x', P);
}

const clampPct = (pct: number | null) => Math.max(0, Math.min(100, pct ?? 0));

/** Course d'une tige de pourcentage (borné comme `bar`, L65) ; une fenêtre sans pourcentage reste à 0. */
export const rodTravel = (pct: number | null) => (clampPct(pct) / 100) * TRAVEL;
/** Angle d'une aiguille, en degrés depuis le haut, sens horaire : 0 % à −135°, 100 % à +135°. */
export const needleAngle = (pct: number | null) => -SWEEP / 2 + (SWEEP * clampPct(pct)) / 100;

/** Pignon de l'axe des aiguilles : il roule sur la crémaillère de sa tige (5h dessus, sem dessous). */
export const pinionAngle = (index: number, travel: number) => ((index === 0 ? -1 : 1) * travel * 180) / (Math.PI * PINION_R);

/** Centre de la poignée de manivelle, sur le rayon du haut, pour un nombre de tours. */
export function crankAt(turns: number): Point3 {
	const a = turns * 2 * Math.PI;
	return [WHEEL[0] + Math.sin(a) * CRANK_R, 0, WHEEL[1] + Math.cos(a) * CRANK_R];
}

/** Chaîne des tambours, alignée à droite sur leurs cinq rouleaux. */
export const drumChars = (text: string) => {
	const chars = [...text];
	return [...Array.from({ length: Math.max(0, DRUMS - chars.length) }, () => ''), ...chars];
};

/** Croix de Malte (dans le plan du fond du hublot, coordonnées locales x, −z) et son doigt, en bas à droite. */
export const CROSS_R = 9;
export const CENTRES = CROSS_R / Math.cos(Math.PI / 6);
export const CROSS_AT: [number, number] = [PORTHOLE[0] - 3, -PORTHOLE[1] - 2.5];
export const DRIVER_AT: [number, number] = [CROSS_AT[0] + CENTRES * Math.SQRT1_2, CROSS_AT[1] + CENTRES * Math.SQRT1_2];
/** Angle du doigt (degrés, sens horaire depuis le haut) pour la fraction de minute écoulée. */
export const driverAngle = (fraction: number) => 255 - 360 * fraction;

/** Fenêtre témoin de la capsule : lumière bordée sur la face vue, remplie du niveau écrit (0 à 1). */
export function witnessSvg(level: number) {
	const [cx, cy, cz] = CAPSULE;
	const r = CAPSULE_R;
	const top = cz - CAPSULE_NECK - 3;
	const low = cz - CAPSULE_NECK - CAPSULE_BODY + 2.4;
	const facing = Math.atan2(VIEW[1], VIEW[0]);
	const span = 0.42;
	const on = (a: number, z: number) => iso([cx + r * Math.cos(a), cy + r * Math.sin(a), z], P);
	const arc = (z: number, from: number, to: number) => Array.from({ length: 9 }, (_, i) => on(from + ((to - from) * i) / 8, z));
	const fill = low + (top - low) * level;
	const slot = pathOf([...arc(top, facing - span, facing + span), ...arc(low, facing + span, facing - span)], true);
	const content = level > 0.01 ? `<path class="iso-shade" data-shade="0" d="${pathOf([...arc(fill, facing - span, facing + span), ...arc(low, facing + span, facing - span)], true)}"/>` : '';
	return `${content}${lineSvg(pathOf(arc(fill, facing - span, facing + span)), { tone: 'lo' })}${lineSvg(slot, { tone: 'mid' })}`;
}

/** Course de la tige de l'amortisseur pour un pourcentage amorti, et angle de la bielle. */
export const damperOut = (pct: number) => (Math.max(0, Math.min(100, pct)) / 100) * DAMPER.stroke;
export const linkAngle = (pct: number) => (Math.asin(damperOut(pct) / 13) * 180) / Math.PI;
