// Audit géométrique de la colonne de sondage avec l'audit du kit, sous Node (TypeScript natif) :
//   node src/anatomies/ma-parcelle/audit.mjs --audit
// Le train de forage est audité au repos, à mi-course et au fond : à chaque pose, les pièces qui
// le suivent descendent, le sol est percé jusqu'à la couronne et le câble de repêchage est
// retracé jusqu'à l'émerillon. L'ordre de peinture de la figure doit être celui que l'audit
// déduit de la vraie profondeur.
// En `.mjs` : l'enregistreur du kit est inféré depuis son JS, ses méthodes ne se typent pas.
import * as A from '../../vendor/anatomy/audit.mjs';
import { translateAlong } from '../../vendor/anatomy/iso-kit.mjs';
import { cableRoute, items } from './geometry.ts';
import { BORE, projection as P, TUBAGE_TOP } from './layout.ts';
import { bitAt, DEPTH, SOIL_TOP } from './model.ts';

const AXIS = { o: [0, 0, 0], a: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] };

/** Construit une forme du kit depuis sa description (`{ fn, args }`), découpes comprises. */
function build({ fn, args }, owner) {
	const isMeta = (arg) => arg && typeof arg === 'object' && !Array.isArray(arg) && 'name' in arg;
	return A[fn](...args.map((arg) => (isMeta(arg) ? { ...arg, owner, ...(arg.cut ? { cut: arg.cut.map((one) => build(one)) } : {}) } : arg)));
}
const withCut = (shape, cuts) => ({ ...shape, cut: [...(shape.cut ?? []), ...cuts] });

/**
 * Sous le tubage, l'écorché ne laisse voir du train de forage que la bande entre les deux arêtes de
 * coupe (le découpage de la figure) : ce qui tombe derrière une face de coupe, |x - y| > rayon du
 * forage, est retiré de ses formes comme il l'est du dessin.
 */
const behindCuts = [1, -1].map((side) => {
	// Le long de (1, -1)/√2, |x - y| > r revient à une distance au plan médian de plus de r/√2.
	const reach = BORE * Math.SQRT1_2 + 60;
	return A.orientedBox([side * reach * Math.SQRT1_2, -side * reach * Math.SQRT1_2, TUBAGE_TOP / 2 - 20], [[Math.SQRT1_2, -Math.SQRT1_2, 0], [Math.SQRT1_2, Math.SQRT1_2, 0], [0, 0, 1]], [60, 120, TUBAGE_TOP / 2 + 20], { name: 'behind' });
});

const POSES = [0, DEPTH / 2, DEPTH];
let failed = false;

for (const depth of POSES) {
	// L'enregistreur reçoit `solid` et `route` après sa création : son type les déclare.
	/** @type {ReturnType<typeof A.recorder> & { solid: (shape: object) => object, route: (name: string, points: number[][], radius: number, options: object) => object[] }} */
	const R = A.recorder(P);
	const list = items();
	const floor = Math.min(bitAt(depth), SOIL_TOP + 0.01);
	list.forEach((item, key) => {
		const offset = item.ride ? [0, 0, -depth] : [0, 0, 0];
		const shapes = item.shapes.map((description) => {
			let shape = build(description, item.name);
			if (item.ride && depth) shape = A.moved(shape, offset);
			if (item.name === 'drill') shape = withCut(shape, behindCuts);
			if (item.bored && floor < SOIL_TOP) shape = withCut(shape, [A.disc(AXIS, floor, SOIL_TOP + 1, BORE, { name: 'bore' })]);
			return R.solid(shape);
		});
		const svg = item.ride && depth ? `<g transform="${translateAlong(P, offset)}">${item.svg}</g>` : item.svg;
		// Le câble naît dans l'enroulement du tambour : ce bout-là se fond dans le corps (`ends`).
		if (item.route) shapes.push(...R.route(item.name, cableRoute(depth), item.route.radius, { touch: item.route.touch, limp: true, ends: [false, true] }));
		// Le forage : une peau sur sa paroi et son fond, à la profondeur atteinte.
		if (item.name === 'bore') {
			const notch = A.box([0, 0, floor - 2], [200, 200, SOIL_TOP + 2]);
			// Découpée comme le dessin : seule la bande entre les arêtes de coupe en est visible.
			if (floor < SOIL_TOP) shapes.push(R.solid(A.ring(AXIS, floor, SOIL_TOP, BORE, BORE + 0.4, { name: 'bore.wall', owner: 'bore', cut: [notch, ...behindCuts] })));
			shapes.push(R.solid(A.disc(AXIS, floor - 0.4, floor, BORE, { name: 'bore.floor', owner: 'bore', cut: [notch, ...behindCuts] })));
		}
		R.put({ name: item.name, key, svg, shapes });
	});
	A.settle(R, P);
	const drawn = list.map((item) => item.name);
	const settled = R.items.slice().sort((a, b) => a.key - b.key).map((item) => item.name);
	console.log(`— pose : carottier descendu de ${depth}`);
	if (settled.join() !== drawn.join()) {
		const moved = settled.filter((name, index) => name !== drawn[index]);
		console.log(`ordre de peinture : l'audit déplace ${moved.slice(0, 8).join(', ')}\n  audit : ${settled.join(' ')}`);
		failed = true;
	}
	// Les bagues du chariot glissent le long des colonnes et de la vis : on ne peut pas couper
	// celles-ci en tronçons fixes autour d'elles. Un manchon mobile dessiné au-dessus de chaque bague
	// montre la colonne qui en sort (vérifié à 8×).
	A.auditOrExit(R, P, { allow: [['mast.post*', 'carriage'], ['mast.screw', 'carriage']] });
	if (process.exitCode) failed = true;
}
if (failed) process.exitCode = 1;
