// Pont vers l'audit du kit, en `.mjs` : son enregistreur est inféré depuis son JS et ses méthodes
// ne se typent pas depuis un `.ts`. La géométrie décrit chaque élément dessiné et ses formes en
// données simples ; ce module les enregistre, laisse l'audit régler l'ordre de peinture d'après la
// vraie profondeur, et sert aussi au contrôle complet (`audit.mjs`).
import * as A from '../../vendor/anatomy/audit.mjs';

const shapeOf = (shape) => {
	const { kind, name, ...meta } = shape;
	const named = { name, ...meta.meta };
	if (kind === 'slab') return A.slab(shape.plan, shape.z, shape.h, named, shape.steps ?? 8);
	if (kind === 'prism') return A.prism(shape.F, shape.poly, shape.s0, shape.s1, named);
	if (kind === 'disc') return A.disc(shape.F, shape.s0, shape.s1, shape.r, named);
	if (kind === 'ring') return A.ring(shape.F, shape.s0, shape.s1, shape.rIn, shape.rOut, named);
	if (kind === 'solid') return A.solid(shape.F, shape.profile, named);
	if (kind === 'ball') return A.ball(shape.at, shape.r, named);
	if (kind === 'tube') return A.tube(shape.points, shape.radii ?? shape.r, named);
	throw new Error(`forme inconnue : ${kind}`);
};

/**
 * Enregistre les éléments (`draws`) et les tracés (`routes`) dans un enregistreur du kit. Une forme
 * posée par son bord sur une rotule (`meta.seatedOn`, le nom de la rotule) y est marquée assise :
 * l'audit l'excuse contre cette rotule seulement.
 */
export function record(P, { draws, routes, fixed = [] }) {
	// L'enregistreur reçoit `solid` et `route` après sa création : son type les déclare.
	/** @type {ReturnType<typeof A.recorder> & { solid: (shape: object) => object, route: (name: string, points: number[][], radius: number, options: object) => void }} */
	const R = A.recorder(P);
	for (const shape of fixed) R.solid(shapeOf(shape));
	for (const route of routes) R.route(route.name, route.points, route.r, route.options);
	const built = draws.map((draw) => draw.shapes.map(shapeOf));
	const byName = new Map(built.flat().map((shape) => [shape.name, shape]));
	for (const shape of built.flat()) {
		if (shape.seatedOn) Object.assign(shape, { seated: true, cut: byName.get(shape.seatedOn) });
	}
	draws.forEach((draw, index) => {
		const shapes = built[index];
		for (const shape of shapes) if (shape.kind !== 'tube') R.solid(shape);
		R.put({ name: draw.name, piece: draw.piece, at: draw.at, bias: draw.bias ?? 0, key: draw.key, svg: draw.svg, shapes, route: draw.route, chunk: draw.chunk, index });
	});
	return R;
}

/** Les clés de peinture réglées par l'audit, dans l'ordre des éléments donnés. */
export function settledKeys(P, scene) {
	const R = record(P, scene);
	A.settle(R, P);
	const keys = new Array(scene.draws.length);
	for (const item of R.items) keys[item.index] = item.key;
	return keys;
}

export { A };
