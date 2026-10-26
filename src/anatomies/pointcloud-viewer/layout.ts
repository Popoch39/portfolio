// Disposition du monde et caméra de l'anatomie de pointcloud-viewer, partagées par la géométrie
// (build, audit) et le mouvement : seuls de petits calculs, pour que le module de mouvement reste léger.
//
// Repère du kit : x vers le nord, y vers l'est, z vers le haut. La caméra du kit regarde un monde
// gaucher ; échanger nord et est rend la spirale dans son vrai sens (anti-horaire vue d'en haut).
import { cameraOf, depthOf, fitProjection, iso, type Point3, type Projection } from '../../vendor/anatomy/iso-kit.ts';
import { altitudeOf, angleOf, DRAWN, drawnIndex, radiusOf } from './model.ts';

export const WIDTH = 600;
export const HEIGHT = 600;
/** Vraie plongée : on lit le disque de la spirale presque rond et le dessus de la tête. */
export const AZIMUTH = 40;
export const ELEVATION = 59;

/** Le terrain et le nuage sont à l'échelle : 2 unités par mètre. L'instrument ne l'est pas. */
export const METRE = 2;
/** Quatre dalles d'orthophoto de 52 m (une tuile de zoom 19 couvre 50,3 m) : la borne y tient. */
export const TILE = 104;
export const GROUND = 1.2;

/** Direction au sol de l'angle `t` de la spirale (x = cos t vers l'est, y = sin t vers le nord). */
export const dirOf = (angle: number): [number, number] => [Math.sin(angle), Math.cos(angle)];
/** Direction de la tangente quand l'angle croît. */
export const tangentOf = (angle: number): [number, number] => [Math.cos(angle), -Math.sin(angle)];

/** Le point `index` du fichier, posé sur le terrain (altitude locale au-dessus des dalles). */
export function cloudAt(index: number): Point3 {
	const radius = radiusOf(index) * METRE;
	const [x, y] = dirOf(angleOf(index));
	return [x * radius, y * radius, GROUND + (altitudeOf(index) - 50) * METRE];
}

// --- Le trépied ------------------------------------------------------------------------------

export const HINGE = { r: 13, z: 88 };
export const FOOT_R = 58;
/**
 * Les trois jambes, du fond vers le lecteur (angles du kit, en degrés). Aucune n'est dans l'axe de
 * la vue : une jambe qui fuit droit vers l'arrière se réduirait à un moignon vue de si haut.
 */
export const LEG_ANGLES = [-110, 130, 10] as const;
export const legOf = (degrees: number) => {
	const a = (degrees * Math.PI) / 180;
	const [c, s] = [Math.cos(a), Math.sin(a)];
	return { hinge: [HINGE.r * c, HINGE.r * s, HINGE.z] as Point3, foot: [FOOT_R * c, FOOT_R * s, GROUND] as Point3 };
};
/** Le fil à plomb : de la vis de fixation jusqu'à la pointe du plomb, au-dessus du clou de station. */
export const PLUMB = { top: 84, bob: 11, tip: 4 };

export const projection: Projection = fitProjection(
	[
		[TILE, TILE, 0],
		[-TILE, -TILE, 0],
		[TILE, -TILE, 0],
		[-TILE, TILE, 0],
		[0, 0, 143],
		[TILE - 4, TILE - 4, 44],
	],
	WIDTH,
	HEIGHT,
	{ pad: 30, azimuth: AZIMUTH, elevation: ELEVATION },
);

const P = projection;
const lerp = (a: Point3, b: Point3, t: number): Point3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/**
 * Ce qui peut cacher un point du nuage ou passer devant lui : les jambes et le fil à plomb, du fond
 * vers le lecteur, avec leur demi-largeur à l'écran (en unités du monde).
 */
const OCCLUDERS: { from: Point3; to: Point3; half: number }[] = [
	{ ...pair(LEG_ANGLES[0]), half: 2.6 },
	{ from: [0, 0, PLUMB.top], to: [0, 0, PLUMB.tip], half: 2.4 },
	{ ...pair(LEG_ANGLES[1]), half: 2.6 },
	{ ...pair(LEG_ANGLES[2]), half: 2.6 },
];
function pair(degrees: number) {
	const { hinge, foot } = legOf(degrees);
	return { from: hinge, to: foot };
}

/**
 * La couche de peinture de chaque point dessiné : 0 derrière le trépied, `k` juste après le `k`-ième
 * occultant quand le point passe devant lui à l'écran (le point est plus près du lecteur).
 */
export function cloudLayers() {
	const { k } = cameraOf(P);
	const segments = OCCLUDERS.map(({ from, to, half }) => ({ from, to, a: iso(from, P), b: iso(to, P), reach: half * k + 1.2 }));
	return Array.from({ length: DRAWN }, (_, j) => {
		const point = cloudAt(drawnIndex(j));
		const [px, py] = iso(point, P);
		let layer = 0;
		segments.forEach(({ from, to, a, b, reach }, rank) => {
			const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
			const t = Math.min(1, Math.max(0, ((px - a[0]) * dx + (py - a[1]) * dy) / (dx * dx + dy * dy)));
			if (Math.hypot(a[0] + dx * t - px, a[1] + dy * t - py) > reach) return;
			if (depthOf(point, P) > depthOf(lerp(from, to, t), P)) layer = rank + 1;
		});
		return layer;
	});
}
export const LAYERS = OCCLUDERS.length + 1;

/** Le point sur la spire courante dans la direction de la tête : là où frappe le faisceau. */
export function impactAt(angle: number, read: number): Point3 {
	const index = Math.max(0, read);
	const radius = radiusOf(index) * METRE;
	const [x, y] = dirOf(angle);
	return [x * radius, y * radius, GROUND + (altitudeOf(index) - 50) * METRE];
}

/**
 * Où peindre le faisceau : 2 après la tête quand la fente regarde le lecteur, sinon avant la tête,
 * 1 après les jambes s'il passe devant l'une d'elles, 0 avant le trépied.
 */
export function beamSlot(from: Point3, to: Point3, facing: boolean) {
	if (facing) return 2;
	const [a, b] = [iso(from, P), iso(to, P)];
	for (const leg of LEG_ANGLES) {
		const { hinge, foot } = legOf(leg);
		const [c, d] = [iso(hinge, P), iso(foot, P)];
		const cross = (u: number[], v: number[]) => u[0] * v[1] - u[1] * v[0];
		const r = [b[0] - a[0], b[1] - a[1]];
		const s = [d[0] - c[0], d[1] - c[1]];
		const denominator = cross(r, s);
		if (Math.abs(denominator) < 1e-9) continue;
		const q = [c[0] - a[0], c[1] - a[1]];
		const t = cross(q, s) / denominator;
		const u = cross(q, r) / denominator;
		if (t < 0 || t > 1 || u < 0 || u > 1) continue;
		if (depthOf(lerp(from, to, t), P) > depthOf(lerp(hinge, foot, u), P)) return 1;
	}
	return 0;
}
