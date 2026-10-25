// Audit géométrique de la figure témoin avec l'audit du kit, sous Node (TypeScript natif) :
//   node src/anatomies/_temoin/audit.mjs --audit
// En `.mjs` : l'enregistreur du kit est inféré depuis son JS, ses méthodes ne se typent pas.
import * as A from '../../vendor/anatomy/audit.mjs';
import { BASE_HEIGHT, basePlan, baseSvg, blockSvg, paintOrder, projection as P } from './geometry.ts';

const blocks = paintOrder(P);

const R = A.recorder(P);
R.put({
	name: 'stand.base',
	key: -1,
	svg: baseSvg(P),
	shapes: [R.solid(A.slab(basePlan, 0, BASE_HEIGHT, { name: 'stand.base' }, 6))],
});
blocks.forEach((block, index) => {
	R.put({
		name: block.piece.id,
		piece: block.piece.id,
		key: index,
		svg: blockSvg(block, P),
		shapes: [R.solid(A.slab(block.plan, block.z, block.height, { name: block.piece.id }, 3))],
	});
});

// L'audit règle l'ordre de peinture d'après la vraie profondeur : il doit retrouver celui de la figure.
A.settle(R, P);
const drawn = ['stand.base', ...blocks.map((block) => block.piece.id)];
const settled = R.items.slice().sort((a, b) => a.key - b.key).map((item) => item.name);
if (settled.join() !== drawn.join()) {
	console.log(`ordre de peinture : la figure peint ${drawn.join(' → ')}, l'audit attend ${settled.join(' → ')}`);
	process.exitCode = 1;
}

A.auditOrExit(R, P);
