// Les pièces qui tournent avec la tête du scanner, reprojetées à chaque angle. La géométrie s'en
// sert pour la pose au repos et le mouvement à chaque image : la tête est de révolution, donc
// seuls bougent la fente, le tambour, les fentes d'aération, les dents, les traits du cercle et la
// roue de filtres. Un petit projeteur plutôt que des poses précalculées : une pose de ces pièces
// pèse environ 6 Ko, et viser à n'importe quel angle en demanderait des dizaines.
import { cameraOf, iso, pathOf, type Flat, type Point3 } from '../../vendor/anatomy/iso-kit.ts';
import { AZIMUTH, dirOf, ELEVATION, projection as P, tangentOf } from './layout.ts';

const TAU = Math.PI * 2;
const A = (AZIMUTH * Math.PI) / 180;
const E = (ELEVATION * Math.PI) / 180;
/** Vers le lecteur, et la lumière du kit (`lathe.mjs` : de gauche, relevée de 1,2). */
const VIEW: Point3 = [Math.cos(A) * Math.cos(E), Math.sin(A) * Math.cos(E), Math.sin(E)];
const LIGHT: Point3 = (() => {
	const [x, y, z] = [-Math.sin(A), Math.cos(A), 1.2];
	const length = Math.hypot(x, y, z);
	return [x / length, y / length, z / length];
})();
const BANDS = [0, 0.2, 0.42, 0.62];

export const HEAD = {
	// Couronne et cercle au même rayon : leurs flancs se lisent l'un sous l'autre, sans surplomb.
	crown: { r: 17.2, z0: 110, z1: 112, teeth: 48 },
	circle: { r: 17.2, z0: 112, z1: 114, ticks: 60, every: 5 },
	body: { r: 16, z0: 114, z1: 138 },
	slit: { half: 4.4, z0: 117, z1: 135, back: 8.2 },
	drum: { r: 3.5, half: 3.7, at: 12.2, z: 126 },
	vents: { rows: [[119, 121.4], [130.6, 133]], count: 12, from: 0.75, step: (Math.PI * 2 - 1.5) / 11, half: 0.055 },
	cap: { r: 15, z0: 138, z1: 139.4 },
	wheel: { r: 10, z0: 139.4, z1: 141.4, at: 6, window: 2.1 },
	ball: { at: 12.2, r: 1 },
} as const;

const dot = (a: Point3, b: Point3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const at = (p: Point3): Flat => iso(p, P);
/** Combien la surface du cylindre à l'angle `angle` regarde le lecteur (au sol). */
export const facingOf = (angle: number) => Math.sin(angle + A);
const onRing = (angle: number, r: number, z: number): Point3 => {
	const [x, y] = dirOf(angle);
	return [x * r, y * r, z];
};
const smooth = (lo: number, hi: number, x: number) => {
	const t = Math.min(1, Math.max(0, (x - lo) / (hi - lo)));
	return t * t * (3 - 2 * t);
};
/** Écart signé à la direction la plus tournée vers le lecteur, dans ]−π, π]. */
const offFront = (angle: number) => {
	const wrapped = (((angle - (Math.PI / 2 - A)) % TAU) + TAU) % TAU;
	return wrapped > Math.PI ? wrapped - TAU : wrapped;
};

function hull(points: Flat[]) {
	const sorted = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
	const cross = (o: Flat, a: Flat, b: Flat) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
	const half = (list: Flat[]) => {
		const out: Flat[] = [];
		for (const p of list) {
			while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], p) <= 0) out.pop();
			out.push(p);
		}
		out.pop();
		return out;
	};
	return [...half(sorted), ...half(sorted.reverse())];
}

export interface Drum {
	fill: string;
	shades: string[];
	mirror: string;
	/** Génératrices qui tournent avec lui : vu de face, son contour est un rectangle, elles disent le cylindre. */
	ribs: string;
	outline: string;
}

/** Le tambour du miroir : un cylindre couché dans la fente, d'axe tangent, qui tourne sur lui-même. */
function drumAt(angle: number, spin: number): Drum {
	const { r, half, at: reach, z } = HEAD.drum;
	const [dx, dy] = dirOf(angle);
	const [tx, ty] = tangentOf(angle);
	const radial: Point3 = [dx, dy, 0];
	const centre: Point3 = [dx * reach, dy * reach, z];
	const steps = 20;
	const ring = (side: number, a: number): Point3 => [
		centre[0] + tx * half * side + r * (Math.cos(a) * radial[0]),
		centre[1] + ty * half * side + r * (Math.cos(a) * radial[1]),
		centre[2] + r * Math.sin(a),
	];
	const ends = [-1, 1].flatMap((side) => Array.from({ length: 32 }, (_, k) => at(ring(side, (k / 32) * TAU))));
	const outline = pathOf(hull(ends), true);
	const shades = ['', '', '', ''];
	let mirror = '';
	for (let k = 0; k < steps; k++) {
		const [a0, a1] = [(k / steps) * TAU, ((k + 1) / steps) * TAU];
		const middle = (a0 + a1) / 2;
		const normal: Point3 = [Math.cos(middle) * radial[0], Math.cos(middle) * radial[1], Math.sin(middle)];
		if (dot(normal, VIEW) <= 0) continue;
		const quad = pathOf([at(ring(-1, a0)), at(ring(1, a0)), at(ring(1, a1)), at(ring(-1, a1))], true);
		const score = dot(normal, LIGHT);
		let tone = 0;
		while (tone < 3 && score >= BANDS[tone + 1]) tone++;
		shades[tone] += quad;
		// La face oblique du miroir passe devant le lecteur une fois par tour du tambour.
		const off = Math.abs(((((middle - spin) % TAU) + TAU + Math.PI) % TAU) - Math.PI);
		if (off < 0.5) mirror += quad;
	}
	let ribs = '';
	for (let k = 0; k < 12; k++) {
		const a = spin + (k / 12) * TAU;
		if (dot([Math.cos(a) * dx, Math.cos(a) * dy, Math.sin(a)], VIEW) > 0) ribs += pathOf([at(ring(-1, a)), at(ring(1, a))]);
	}
	return { fill: outline, shades, mirror, ribs, outline };
}

export interface Slit {
	/** Contour de l'ouverture : il découpe le dedans de la fente. */
	opening: string;
	back: string;
	side: string;
	floor: string;
	bearing: string;
	drum: Drum;
	ghost: Drum | null;
}

/**
 * La fente du miroir à l'angle `angle`, avec ses parois et le tambour. `smear` (rad) l'allonge vers
 * l'arrière du mouvement : le flou de bougé quand la tête file plus vite que l'œil.
 */
export function slitAt(angle: number, spin: number, smear = 0): Slit | null {
	const { r: R } = HEAD.body;
	const { half, z0, z1, back } = HEAD.slit;
	const beta = Math.asin(half / R);
	const centre = offFront(angle);
	const lo = Math.max(centre - beta - smear, -Math.PI / 2 + 0.02);
	const hi = Math.min(centre + beta, Math.PI / 2 - 0.02);
	if (hi - lo < 0.02) return null;
	const base = angle - centre;
	const arc = (z: number, from: number, to: number) =>
		Array.from({ length: 9 }, (_, k) => at(onRing(base + from + ((to - from) * k) / 8, R, z)));
	const opening = pathOf([...arc(z0, lo, hi), ...arc(z1, hi, lo)], true);
	const [dx, dy] = dirOf(angle);
	const [tx, ty] = tangentOf(angle);
	const inner = (reach: number, side: number, z: number): Point3 => [dx * reach + tx * half * side, dy * reach + ty * half * side, z];
	const edge = Math.sqrt(R * R - half * half);
	const backWall = pathOf([inner(back, -1, z0), inner(back, 1, z0), inner(back, 1, z1), inner(back, -1, z1)].map(at), true);
	// La paroi tournée vers le lecteur est celle dont la normale intérieure le regarde.
	const side = Math.cos(angle + A) > 0 ? -1 : 1;
	const sideWall = pathOf([inner(back, side, z0), inner(edge, side, z0), inner(edge, side, z1), inner(back, side, z1)].map(at), true);
	const floor = pathOf([...arc(z0, centre - beta, centre + beta), at(inner(back, 1, z0)), at(inner(back, -1, z0))], true);
	const hub = inner(HEAD.drum.at, side, HEAD.drum.z);
	const bearing = pathOf(
		Array.from({ length: 24 }, (_, k) => {
			const a = (k / 24) * TAU;
			return at([hub[0] + 1.8 * Math.cos(a) * dx, hub[1] + 1.8 * Math.cos(a) * dy, hub[2] + 1.8 * Math.sin(a)]);
		}),
		true,
	);
	return {
		opening,
		back: backWall,
		side: sideWall,
		floor,
		bearing,
		drum: drumAt(angle, spin),
		ghost: smear > 0.05 ? drumAt(angle - smear * 0.6, spin + 1.3) : null,
	};
}

/** Où le faisceau quitte le miroir. */
export const mirrorAt = (angle: number): Point3 => {
	const [dx, dy] = dirOf(angle);
	return [dx * HEAD.drum.at, dy * HEAD.drum.at, HEAD.drum.z];
};

/** Fentes d'aération fermées sur le boîtier : un contour par fente, qui s'estompe vers le bord. */
export function ventsAt(angle: number, blur = 0) {
	const { r } = HEAD.body;
	const { rows, count, from, step, half } = HEAD.vents;
	return Array.from({ length: count }, (_, k) => {
		const centre = angle + from + k * step;
		const alpha = smooth(0.1, 0.45, facingOf(centre)) * (1 - 0.85 * blur);
		if (alpha < 0.03) return { d: '', alpha: 0 };
		const d = rows
			.map(([z0, z1]) => {
				const arc = (z: number, a: number, b: number) => [0, 1, 2].map((s) => at(onRing(centre + a + ((b - a) * s) / 2, r, z)));
				return pathOf([...arc(z0, -half, half), ...arc(z1, half, -half)], true);
			})
			.join('');
		return { d, alpha };
	});
}

/** Les dents de la couronne à rochet, en quatre opacités qui s'estompent vers le bord. */
export function teethAt(angle: number, blur = 0) {
	const { r, z0, z1, teeth } = HEAD.crown;
	const levels = ['', '', '', ''];
	for (let k = 0; k < teeth; k++) {
		const a = angle + (k / teeth) * TAU;
		const alpha = smooth(0.06, 0.5, facingOf(a)) * (1 - 0.85 * blur);
		if (alpha < 0.125) continue;
		levels[Math.min(3, Math.round(alpha * 4) - 1)] += pathOf([at(onRing(a, r, z0)), at(onRing(a, r, z1))]);
	}
	return levels;
}

/** Les traits du cercle gradué, pendus à son bord ; le cran (trait 0) est dans l'axe de la fente. */
export function ticksAt(angle: number) {
	const { r, z1, ticks, every } = HEAD.circle;
	let minor = '';
	let major = '';
	let zero = '';
	for (let k = 0; k < ticks; k++) {
		const a = angle + (k / ticks) * TAU;
		const big = k % every === 0;
		const d = pathOf([at(onRing(a, r, z1)), at(onRing(a, r - (big ? 1 : 0.55), z1))]);
		if (k === 0) zero = d;
		else if (big) major += d;
		else minor += d;
	}
	return { minor, major, zero };
}

/** Les quatre fenêtres de la roue de filtres ; la fenêtre du mode courant est côté fente. */
export function windowsAt(angle: number, mode: number) {
	const { z1, at: reach, window } = HEAD.wheel;
	return [0, 1, 2, 3].map((k) => {
		const centre = onRing(angle + (k - mode) * (TAU / 4), reach, z1);
		return pathOf(
			Array.from({ length: 18 }, (_, s) => at([centre[0] + window * Math.cos((s / 18) * TAU), centre[1] + window * Math.sin((s / 18) * TAU), z1])),
			true,
		);
	});
}

/** La bille d'indexage de la roue, dans son logement sur le chapeau. */
export function ballAt(angle: number) {
	const { at: reach, r } = HEAD.ball;
	const centre = at(onRing(angle, reach, HEAD.cap.z1 + r * 0.5));
	const { k } = cameraOf(P);
	return pathOf(
		Array.from({ length: 16 }, (_, s): Flat => [centre[0] + r * k * Math.cos((s / 16) * TAU), centre[1] + r * k * Math.sin((s / 16) * TAU)]),
		true,
	);
}
