// Ordre de peinture de la rampe à cadran, mesuré par l'audit du kit : chaque élément porte sa forme
// vraie, `settle` ray-trace chaque paire qui se recouvre à l'écran et règle les clés au plus juste.
// En `.mjs` : l'enregistreur du kit est inféré depuis son JS, ses méthodes ne se typent pas.
import * as A from '../../vendor/anatomy/audit.mjs';

/** Enregistre éléments et tubes dans un enregistreur d'audit, avec leurs clés de départ. */
export function record(items, routes, P) {
	const R = A.recorder(P);
	const { route: trace } = R;
	for (const route of routes) trace(route.name, route.points, route.r, { gaps: route.gaps, owner: route.owner ?? route.name, piece: route.piece?.id ?? '' });
	for (const item of items) {
		// Les morceaux de tube sont déjà enregistrés par leur tracé ; les autres formes sont des solides.
		if (!item.route) R.solids.push(...item.shapes);
		const shapes = item.shapes;
		R.put({ name: item.name, piece: item.piece?.id ?? '', at: item.at, bias: item.bias ?? 0, svg: item.svg, shapes, route: item.route, chunk: item.chunk, source: item });
	}
	return R;
}

/** Les éléments dans l'ordre de peinture réglé par la profondeur mesurée. */
export function settled(items, routes, P) {
	const R = record(items, routes, P);
	A.settle(R, P);
	return { R, order: R.items.slice().sort((a, b) => a.key - b.key).map((entry) => entry.source) };
}
