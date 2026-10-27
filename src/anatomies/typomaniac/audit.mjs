// Audit géométrique du banc de duel avec l'audit du kit, sous Node (TypeScript natif) :
//   node src/anatomies/typomaniac/audit.mjs --audit
// Il vérifie la pose au repos : câbles, pièces de révolution, appuis, et que l'ordre de peinture
// de la figure est bien celui que la vraie profondeur impose.
import { defaultLocale } from '../../lib/i18n.ts';
import * as A from '../../vendor/anatomy/audit.mjs';
import { build, layers } from './geometry.ts';
import { P } from './layout.ts';
import { restDuel } from './model.ts';
import { record } from './settle.mjs';
import { TEXTS } from './texts.ts';

const { items, routes } = build(restDuel(TEXTS, defaultLocale));
// Un jeton qui n'est pas sur le rail dans la pose au repos est en attente, invisible (opacité 0).
const all = layers(items).all.filter((item) => item.shapes.length || !item.name.startsWith('guichet.token'));
const R = record(all, P);
for (const route of routes) R.route(route.name, route.points, route.r, { piece: route.piece, limp: true });

// La niche est découpée par l'embrasure (`clipPath`) : hors de l'ouverture, la caisse la cache, ce
// que le lancer de rayons ne voit pas. Ces paires-là ne règlent pas l'ordre.
const niche = new Set(all.filter((item) => item.niche).map((item) => item.name));
const clipped = (a, b) => (a.name === 'tour.case' && niche.has(b.name)) || (b.name === 'tour.case' && niche.has(a.name));
A.settle(R, P, { skip: (a, b) => A.sameRun(a, b) || clipped(a, b) });

const drawn = all.map((item) => item.name);
const moved = R.items.filter((item, index) => Math.abs(item.key - index) > 1e-9);
if (moved.length && process.argv.includes('--audit')) {
	console.log(`ordre de peinture : ${moved.length} items que l'audit peindrait ailleurs`);
	const { pairs, least } = R.settled.overlaps;
	for (const { a, b, front } of pairs) {
		const [aFront, bFront] = front.map((side) => side.area >= least);
		if (aFront && !bFront && a < b) console.log(`  ${drawn[a]} (${a}) devant ${drawn[b]} (${b})  ${front[0].area.toFixed(1)} px²`);
		if (bFront && !aFront && b < a) console.log(`  ${drawn[b]} (${b}) devant ${drawn[a]} (${a})  ${front[1].area.toFixed(1)} px²`);
	}
	process.exitCode = 1;
}

// Le bord du dos est compté comme une tige (long et mince) ; l'arête que le câble croise est le pied
// de sa paroi de goulotte, caché sous le fond de la goulotte : vu à 8×, rien ne se touche à l'écran.
const CROSSED = [['cables.0', 'stand.back'], ['cables.1', 'stand.back']];
A.auditOrExit(R, P, { allow: [['tour.case', 'guichet.*'], ['tour.case', 'tour.niche']], crowd: CROSSED });
