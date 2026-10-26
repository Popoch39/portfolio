// Le dock, le rail et le disque PCBK, partagés par la géométrie et le mouvement : le disque se
// grave secteur par secteur au dock, puis glisse sur le rail jusqu'au support de carnet.
import { iso, pathOf, type Point3 } from '../../vendor/anatomy/iso-kit.ts';
import { projection as P } from './layout.ts';
import { SECTORS } from './model.ts';

const TAU = Math.PI * 2;

/** Le rail part du socle fixe vers la jambe gauche (angle du kit). */
export const RAIL_ANGLE = (112 * Math.PI) / 180;
export const RAIL_DIR: Point3 = [Math.cos(RAIL_ANGLE), Math.sin(RAIL_ANGLE), 0];
export const SIDE_DIR: Point3 = [-Math.sin(RAIL_ANGLE), Math.cos(RAIL_ANGLE), 0];
/** Un point du plan du rail : `along` depuis l'axe de la tête, `across` sur le côté. */
export const railPoint = (along: number, across: number, z: number): Point3 => [
	RAIL_DIR[0] * along + SIDE_DIR[0] * across,
	RAIL_DIR[1] * along + SIDE_DIR[1] * across,
	z,
];

/** Le dock part du flanc du socle fixe (rayon 18,8). */
export const DOCK = { from: 18.8, to: 29.2, half: 7, z0: 102.6, z1: 104.2 };
/** Deux rails de part et d'autre du plateau tournant du dock. */
export const RAILS = { from: 19.6, to: 40.8, gauge: 11, half: 0.5, z1: 105 };
export const CHARIOT = { at: 24.6, half: 4.6, z0: 105, z1: 105.6 };
export const DISC = { r: 5.4, z0: 105.6, z1: 106.4 };
/** Course du chariot, du dock au support de carnet. */
export const TRAVEL = 12;

const at = (p: Point3) => iso(p, P);

/** Un cercle du plan horizontal autour du centre du disque, au dock. */
const arc = (r: number, from: number, to: number, z = DISC.z1) => {
	const steps = Math.max(2, Math.ceil(((to - from) / TAU) * 64));
	return Array.from({ length: steps + 1 }, (_, k) => {
		const a = from + ((to - from) * k) / steps;
		return at(railPoint(CHARIOT.at + Math.cos(a) * r, Math.sin(a) * r, z));
	});
};

/** Le secteur gravé commence face au socle : le premier bloc écrit est le plus proche de la tête. */
const START = Math.PI;
const HUB = 1.3;
const GROOVES = [2.1, 2.7, 3.3, 3.9, 4.5];
/** Part du temps de gravure passée sur l'en-tête de 72 octets, au moyeu. */
export const HUB_SHARE = 0.12;

/**
 * Les marques gravées du disque à l'avancement `progress` (0 vierge, 1 gravé) : le moyeu (l'en-tête),
 * puis les sillons de chaque secteur, qui finissent sur ses deux rayons.
 */
export function discMarks(progress: number) {
	const hub = progress > 0 ? pathOf(arc(HUB, 0, TAU), true) : '';
	const swept = Math.max(0, Math.min(1, (progress - HUB_SHARE) / (1 - HUB_SHARE))) * TAU;
	let radii = '';
	let grooves = '';
	for (const sector of SECTORS) {
		if (swept <= sector.from) break;
		const to = Math.min(sector.to, swept);
		const [a0, a1] = [START + sector.from, START + to];
		radii += pathOf([arc(HUB, a0, a0)[0], arc(DISC.r - 0.5, a0, a0)[0]]);
		// Le rayon de fin suit la pointe pendant la gravure : un sillon finit toujours sur un rayon.
		radii += pathOf([arc(HUB, a1, a1)[0], arc(DISC.r - 0.5, a1, a1)[0]]);
		for (const r of GROOVES) grooves += pathOf(arc(r, a0, a1));
	}
	return { hub, radii, grooves };
}
