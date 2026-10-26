// Audit géométrique de l'anatomie de pointcloud-viewer avec l'audit du kit, sous Node :
//   node src/anatomies/pointcloud-viewer/audit.mjs --audit
// Il passe deux poses : le disque au support (le repos) et au dock (`--home`). L'ordre vérifié est
// celui que peint la figure : les clés sont l'ordre de peinture, pas celles que règlerait l'audit.
// En `.mjs` : l'enregistreur du kit est inféré depuis son JS, ses méthodes ne se typent pas.
import * as A from '../../vendor/anatomy/audit.mjs';
import { scene } from './geometry.ts';
import { PIECES } from './index.ts';
import { projection as P } from './layout.ts';

const shapeOf = (shape) => {
	const meta = { name: shape.name };
	switch (shape.kind) {
		case 'slab':
			return A.slab(shape.plan, shape.z, shape.h, meta, shape.steps);
		case 'extruded':
			return A.extruded(shape.ring, shape.z, shape.h, meta);
		case 'cylinder':
			return A.cylinder(shape.c[0], shape.c[1], shape.r, shape.z, shape.h, meta);
		case 'solid':
			return A.solid(shape.F, shape.profile, meta);
		case 'disc':
			return A.disc(shape.F, shape.s0, shape.s1, shape.r, meta);
		case 'prism':
			return A.prism(shape.F, shape.polygon, shape.s0, shape.s1, meta);
		case 'ball':
			return A.ball(shape.at, shape.r, meta);
		case 'tube':
			return A.tube(shape.points, shape.r, meta);
		default:
			throw new Error(`forme inconnue : ${shape.kind}`);
	}
};

function run(home) {
	const { list, route } = scene(PIECES, { home });
	const R = A.recorder(P);
	let key = 0;
	for (const entry of list) {
		key += 1;
		if (typeof entry === 'string') continue;
		// Un morceau du câble se range comme un tube ; le tracé entier est enregistré par `route`.
		if (entry.chunk) {
			R.put({ name: entry.name, key, svg: entry.svg, route: route.name, chunk: entry.chunk.index, shapes: [A.tube(entry.chunk.points, route.r, { name: route.name })] });
			continue;
		}
		const shapes = entry.shapes.map(shapeOf);
		R.solids.push(...shapes);
		if (shapes.length) R.put({ name: entry.name, piece: entry.piece ?? '', key, svg: entry.svg, shapes });
	}
	// `route` est ajouté à l'enregistreur après sa création : lu par crochets, il n'est pas pris par
	// l'inférence du kit pour une faute de frappe sur `routes` (indice TS2568).
	R['route'](route.name, route.points, route.r, { gaps: route.gaps, limp: true, rims: [0.95, 0.95] });
	const overlaps = A.overlapsOf(R.items, P, { states: [0], skip: A.sameRun });
	R.settled = { items: R.items, overlaps, solved: { keys: R.items.map((item) => item.key), rules: 0, dropped: [] }, states: [0] };
	console.log(`— disque ${home ? 'au dock' : 'au support'}`);
	return A.auditOrExit(R, P);
}

run(false);
run(true);
