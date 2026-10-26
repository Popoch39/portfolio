// Ordre de peinture réglé par la vraie profondeur, avec l'audit du kit : chaque paire d'items qui se
// recouvrent à l'écran est lancée en rayons, et la pièce la plus proche passe après. En `.mjs` :
// l'enregistreur du kit est inféré depuis son JS, ses méthodes ne se typent pas.
import * as A from '../../vendor/anatomy/audit.mjs';

/** Traduit une forme de `geometry.ts` en forme du kit. */
export function shapeOf(spec) {
	const meta = { name: spec.name, ...(spec.owner ? { owner: spec.owner } : {}) };
	switch (spec.kind) {
		case 'slab':
			return A.slab(spec.plan, spec.z, spec.h, { ...meta, ...(spec.cut ? { cut: shapeOf(spec.cut) } : {}) }, spec.steps);
		case 'extruded':
			return A.extruded(spec.ring, spec.z, spec.h, meta);
		case 'solid':
			return A.solid(spec.F, spec.profile, meta);
		case 'ball':
			return A.ball(spec.at, spec.r, meta);
		case 'box':
			return A.box(spec.min, spec.max, meta);
		case 'tube':
			return A.tube(spec.points, spec.radii, meta);
	}
	throw new Error(`forme inconnue : ${spec.kind}`);
}

/** Enregistre les items, dans l'ordre donné, avec leurs formes vraies. */
export function record(items, P) {
	// L'enregistreur reçoit `solid` et `route` après sa création : son type les déclare.
	/** @type {ReturnType<typeof A.recorder> & { solid: (shape: object) => object, route: (name: string, points: number[][], radius: number, options: object) => object[] }} */
	const R = A.recorder(P);
	items.forEach((item, index) => {
		const shapes = item.shapes.map(shapeOf);
		for (const shape of shapes) if (shape.kind !== 'tube') R.solid(shape);
		R.put({ name: item.name, piece: item.piece, key: index, svg: item.svg, shapes, route: item.route, chunk: item.chunk });
	});
	return R;
}

/** Les rangs de peinture que la profondeur impose, en partant de l'ordre donné. */
export function settledRanks(items, P) {
	const R = record(items, P);
	A.settle(R, P);
	return R.items.map((item) => item.key);
}
