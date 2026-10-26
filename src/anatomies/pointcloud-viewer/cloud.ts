// Le nuage dessiné : 2 500 points, un sur 40, dans l'ordre du fichier. Chaque couche de peinture
// (derrière le trépied, ou juste devant une jambe) tient six tons d'encre pour le nuage rendu, puis
// les points écrits mais pas encore rendus (`mid`) et la spire courante (`hi`) pendant le bake.
import { iso } from '../../vendor/anatomy/iso-kit.ts';
import { cloudAt, cloudLayers, projection as P } from './layout.ts';
import { DRAWN, drawnIndex, INKS, inksOf, type Mode } from './model.ts';

/** Position à l'écran de chaque point dessiné, et sa couche de peinture. */
export function cloudPoints() {
	const screen = Array.from({ length: DRAWN }, (_, j) => iso(cloudAt(drawnIndex(j)), P));
	return { screen, layers: cloudLayers() };
}

const tenths = (value: number) => Math.round(value * 10);
const decimal = (tenthsOf: number) => {
	const text = String(Math.abs(tenthsOf) / 10).replace(/^0\./, '.');
	return tenthsOf < 0 ? `-${text}` : text;
};
/**
 * Des points comme des traits de longueur nulle à bout rond, en déplacements relatifs (les voisins
 * sur la spirale sont proches) : une dizaine d'octets le point. Les écarts sont pris entre positions
 * déjà arrondies, pour que l'arrondi ne dérive pas.
 */
export const dotsPath = (screen: [number, number][], js: Iterable<number>) => {
	let d = '';
	let [x, y] = [0, 0];
	let first = true;
	for (const j of js) {
		const [nx, ny] = [tenths(screen[j][0]), tenths(screen[j][1])];
		const [dx, dy] = first ? [nx, ny] : [nx - x, ny - y];
		const second = decimal(dy);
		d += `${first ? 'M' : 'm'}${decimal(dx)}${second.startsWith('-') ? '' : ' '}${second}h0`;
		[x, y, first] = [nx, ny, false];
	}
	return d;
};

/** Les attributs d'un chemin de points : encre de la figure (bleue quand le nuage est visé). */
export const DOT_STYLE = {
	ink: 'stroke:var(--anatomy-hi);stroke-width:1.5;stroke-linecap:round;fill:none',
	written: 'stroke:var(--anatomy-mid);stroke-width:2;stroke-linecap:round;fill:none',
	current: 'stroke:var(--anatomy-hi);stroke-width:2;stroke-linecap:round;fill:none',
};

/** Les chemins du nuage rendu dans un mode, par couche puis par ton d'encre. */
export function renderedPaths(screen: [number, number][], layers: number[], mode: Mode, count = DRAWN) {
	const inks = inksOf(mode);
	const buckets = new Map<string, number[]>();
	for (let j = 0; j < count; j++) {
		const key = `${layers[j]}:${inks[j]}`;
		if (!buckets.has(key)) buckets.set(key, []);
		buckets.get(key)!.push(j);
	}
	return (layer: number) => INKS.map((_, ink) => dotsPath(screen, buckets.get(`${layer}:${ink}`) ?? []));
}
