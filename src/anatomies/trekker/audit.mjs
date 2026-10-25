// Audit géométrique du meuble à fiches avec l'audit du kit, sous Node (TypeScript natif) :
//   node src/anatomies/trekker/audit.mjs --audit
// En `.mjs` : l'enregistreur du kit est inféré depuis son JS, ses méthodes ne se typent pas.
//
// Il enregistre la forme vraie de chaque pièce dessinée, dans la pose du repos ; les fiches levées
// sont la partie éclatée (posées dans le tiroir à l'état 0, levées à l'état 1). L'ordre de peinture
// vérifié est celui de la figure : chaque paire qui se recouvre doit être peinte du fond vers le lecteur.
import * as A from '../../vendor/anatomy/audit.mjs';
import * as G from '../../vendor/anatomy/lathe.mjs';
import { translateAlong } from '../../vendor/anatomy/iso-kit.mjs';
import { figure } from './geometry.ts';
import { DEPTH, FRAME, projection as P } from './layout.ts';

const LIFT = 'levee';
/** Le nu du cadre de façade : ce qui est derrière, dans l'ouverture, ne compte que par elle. */
const FACE = DEPTH + FRAME;
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

/**
 * La forme du kit, à sa place au repos ; rognée à la façade pour ce qui sort du caisson (`cut`), et
 * au plan `floor` pour ce qui plonge dans une fente ou un guide.
 */
function shapeOf(spec, offset, meta, cut, floor) {
	const [dx, dy, dz] = offset;
	if (spec.kind === 'slab' || spec.kind === 'ring') {
		const ring = spec.kind === 'slab' ? null : spec.ring.map(([x, y]) => [x + dx, y + dy]);
		const plan = spec.kind === 'slab' ? { ...spec.plan, x: spec.plan.x + dx, y: spec.plan.y + dy } : null;
		if (cut && plan) {
			if (plan.x + plan.w <= cut + 1e-6) return null;
			if (plan.x < cut) Object.assign(plan, { w: plan.x + plan.w - cut, x: cut, r: 0 });
		}
		let [z0, z1] = [spec.z + dz, spec.z + dz + spec.h];
		if (floor !== undefined) z0 = Math.max(z0, floor);
		if (z1 <= z0 + 1e-6) return null;
		const holes = spec.cut ? { cut: spec.cut.map((hole) => shapeOf(hole, [0, 0, 0], { name: `${meta.name}.creux` })) } : {};
		return plan ? A.slab(plan, z0, z1 - z0, { ...meta, ...holes }, spec.steps) : A.extruded(ring, z0, z1 - z0, meta);
	}
	if (spec.kind === 'disc') {
		const o = add(spec.o, offset);
		let [s0, s1] = [spec.s0, spec.s1];
		// Un axe le long de x : seule compte la part devant la façade.
		if (cut && spec.a[0] === 1) {
			s0 = Math.max(s0, cut - o[0]);
			if (s1 <= s0) return null;
		}
		return A.disc(G.frameAlong(o, spec.a), s0, s1, spec.r, meta);
	}
	return A.prism({ o: add(spec.o, offset), a: spec.a, u: spec.u, v: spec.v }, spec.poly, spec.s0, spec.s1, meta);
}

const R = A.recorder(P, { order: [LIFT] });
const items = [];
const clipped = [];

function walk(node, ctx) {
	if (node.kind === 'group') {
		if (node.attrs.visibility === 'hidden') return;
		const lifted = ctx.lifted || Boolean(node.lift);
		const offset = node.offset ?? [0, 0, 0];
		const next = {
			home: lifted && node.offset ? ctx.home : add(ctx.home, offset),
			move: lifted && node.offset ? add(ctx.move, offset) : ctx.move,
			lifted,
			cut: ctx.cut || 'data-drawer' in node.attrs,
		};
		node.children.forEach((child) => walk(child, next));
		return;
	}
	const meta = { name: node.name, ...(node.owner ? { owner: node.owner } : {}), ...(node.name.startsWith('stand.') ? { ground: true } : {}) };
	const shapes = node.shapes.map((spec) => shapeOf(spec, ctx.home, meta, ctx.cut ? FACE : null, node.floor)).filter(Boolean);
	if (!shapes.length) return;
	// Le dessin du tiroir tiré est rogné à la façade, celui d'une broche à son guide, celui de la
	// fiche à sa fente, chacun par son `clip-path` ; la forme l'est ici.
	if (ctx.cut || node.floor !== undefined) clipped.push(node.name);
	const svg = ctx.home.some(Boolean) ? `<g transform="${translateAlong(P, ctx.home)}">${node.svg}</g>` : node.svg;
	const lifted = ctx.lifted;
	items.push(
		R.put({
			name: node.name,
			piece: node.piece ?? 'fiche',
			// Des clés espacées : la montée des fiches (que l'audit ajoute à leur clé) ne change pas leur rang.
			key: items.length * 1000,
			svg,
			move: lifted ? ctx.move : [0, 0, 0],
			ride: lifted ? LIFT : node.piece ?? 'fiche',
			// `R.solids` directement : l'enregistreur ajoute `solid` après coup, TypeScript ne le voit pas.
			shapes: shapes.map((shape) => {
				R.solids.push(shape);
				return shape;
			}),
		}),
	);
}

const { nodes } = figure();
nodes.forEach((node) => walk(node, { home: [0, 0, 0], move: [0, 0, 0], lifted: false, cut: false }));

// L'ordre vérifié est celui de la figure : les clés restent l'ordre de peinture, sans réglage.
const states = A.explodeStates(R.order, R.spring).depth;
const overlaps = A.overlapsOf(R.items, P, { states, skip: A.sameRun });
R.settled = { items: R.items, overlaps, solved: { keys: R.items.map((item) => item.key), dropped: [], rules: 0 }, states };
// Les glissières fixes sont au fond des ouvertures, rognées à elles : hors de l'ouverture, le caisson
// creusé les cache, dans l'ouverture elles sont devant lui. Le `clip-path` règle ce que l'ordre ne peut pas.
A.auditOrExit(R, P, { cover: clipped, allow: [['corps.caisson', 'glissieres.fixe*']] });
