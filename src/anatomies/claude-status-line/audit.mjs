// Audit géométrique de la rampe à cadran avec l'audit du kit, sous Node (TypeScript natif) :
//   node src/anatomies/claude-status-line/audit.mjs --audit
// D'abord la pose au repos (celle du site), puis les poses que prend le mouvement : sonde sortie,
// tampon qui frappe, lames levées ou baissées, aiguilles en butée. Dans chacune, l'ordre de peinture
// du repos doit rester juste, sans qu'aucune clé ait à bouger.
import * as A from '../../vendor/anatomy/audit.mjs';
import { build } from './geometry.ts';
import { projection as P } from './layout.ts';
import { REST } from './model.ts';
import { record, settledAcross } from './order.mjs';

const { R, order } = settledAcross(build, REST, P);
A.auditOrExit(R, P);

/** Instants simulés (minutes) : requête en cours, frappe après réponse, seuil, reset, temporisation. */
const POSES = [0.1, 0.2, 1.06, 15, 26, 35, 76, 135, 136, 145.1, 145.3, 150];

if (process.argv.includes('--audit')) {
	const rank = new Map(order.map((item, index) => [item.name, index]));
	let problems = 0;
	for (const t of POSES) {
		const pose = build(t);
		const items = pose.items.map((item) => ({ ...item, bias: undefined }));
		const RP = record(items, pose.routes, P);
		// Les clés de départ sont l'ordre du repos : si la pose demande d'en bouger une, l'ordre est faux.
		RP.items.forEach((item) => (item.key = rank.get(item.name) ?? 0));
		const before = RP.items.slice().sort((a, b) => a.key - b.key).map((item) => item.name).join();
		A.settle(RP, P);
		const after = RP.items.slice().sort((a, b) => a.key - b.key).map((item) => item.name).join();
		const result = A.audit(RP, P);
		const count = A.failures(result) + (before === after ? 0 : 1);
		problems += count;
		console.log(`pose t = ${t} : ${count ? `${count} problème(s)` : 'propre'}`);
		if (before !== after) console.log('  l’ordre de peinture du repos ne tient pas dans cette pose');
		if (A.failures(result)) console.log(A.report(result).split('\n').filter((line) => /^\s|[1-9]\d* (problem|end|pair|chunk|unsupported|item)/.test(line)).join('\n'));
	}
	console.log(problems ? `poses : ${problems} problème(s)` : 'poses : toutes propres');
	if (problems) process.exitCode = 1;
}
