// Ordre de peinture de la rampe à cadran, mesuré par l'audit du kit : chaque élément porte sa forme
// vraie, `settle` ray-trace chaque paire qui se recouvre à l'écran et règle les clés au plus juste.
// En `.mjs` : l'enregistreur du kit est inféré depuis son JS, ses méthodes ne se typent pas.
import * as A from '../../vendor/anatomy/audit.mjs';

/**
 * Poses du mouvement où des pièces mobiles se croisent autrement qu'au repos (minutes simulées) :
 * levier sur API et sonde sortie, toutes les lames levées, tige de l'amortisseur rentrée.
 */
export const MOVING_POSES = [0.2, 35, 136, 145.3];

/** Enregistre éléments et tubes dans un enregistreur d'audit, avec leurs clés de départ. */
export function record(items, routes, P) {
	const R = A.recorder(P);
	const { route: trace } = R;
	for (const route of routes) trace(route.name, route.points, route.r, { gaps: route.gaps, owner: route.owner ?? route.name, piece: route.piece?.id ?? '' });
	for (const item of items) {
		// Les morceaux de tube sont déjà enregistrés par leur tracé ; les autres formes sont des solides.
		if (!item.route) R.solids.push(...item.shapes);
		R.put({ name: item.name, piece: item.piece?.id ?? '', at: item.at, bias: item.bias ?? 0, svg: item.svg, shapes: item.shapes, route: item.route, chunk: item.chunk, source: item });
	}
	return R;
}

const orderOf = (R) => R.items.slice().sort((a, b) => a.key - b.key);

/** Les éléments dans l'ordre de peinture réglé par la profondeur mesurée, au repos seulement. */
export function settled(items, routes, P) {
	const R = record(items, routes, P);
	A.settle(R, P);
	return { R, order: orderOf(R).map((entry) => entry.source) };
}

/**
 * Un seul ordre qui tient au repos et dans chaque pose du mouvement : chaque pose relève les clés
 * qu'elle exige (elles ne font que monter), jusqu'à ce qu'aucune ne bouge plus.
 * `build(t)` rend les éléments à l'instant t ; les noms d'éléments sont les mêmes dans toutes les poses.
 */
export function settledAcross(build, rest, P, poses = MOVING_POSES) {
	const scenes = [{ t: rest, ...build(rest) }, ...poses.map((t) => ({ t, ...build(t) }))];
	const keys = new Map();
	for (let round = 0; round < 6; round++) {
		let changed = false;
		for (const scene of scenes) {
			const R = record(scene.items, scene.routes, P);
			if (keys.size) R.items.forEach((item) => (item.key = keys.get(item.name) ?? item.key));
			A.settle(R, P);
			for (const item of R.items) {
				if (Math.abs((keys.get(item.name) ?? -Infinity) - item.key) > 1e-9) changed = true;
				keys.set(item.name, item.key);
			}
			scene.R = R;
		}
		if (!changed) break;
	}
	// Le repos, réglé une dernière fois à partir des clés communes (point fixe : rien ne bouge).
	const R = record(scenes[0].items, scenes[0].routes, P);
	R.items.forEach((item) => (item.key = keys.get(item.name)));
	A.settle(R, P);
	return { R, keys, order: orderOf(R).map((entry) => entry.source) };
}
