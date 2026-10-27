// Le registre des commandes de la Lunette (ADR 0007) : un module pur, sans DOM, importé tel quel
// sous Node. À partir de la ligne tapée et du contexte de la page, il donne la liste filtrée (meilleur
// résultat en tête), les lettres trouvées de chaque résultat et l'action résolue.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contextAt, list, run } from '../src/lunette/registry.ts';

const accueil = { page: { kind: 'home' }, locale: 'fr' };
const home = { page: { kind: 'home' }, locale: 'en' };
const ficheTrekker = { page: { kind: 'fiche', slug: 'trekker' }, locale: 'fr' };

test(':e trek : le cadre des projets, titré « Projets », le prompt titré « :e », trekker en tête', () => {
	const listing = list('e trek', accueil);
	assert.equal(listing.title, 'Projets');
	assert.equal(listing.prompt, ':e');
	// La saisie de l'argument, seule dans le prompt : « trek », sous le titre « :e ».
	assert.equal(listing.argument, 'trek');
	assert.equal(listing.total, 6);
	assert.equal(listing.entries.length, 1);
	const [trekker] = listing.entries;
	assert.equal(trekker.label, 'trekker');
	assert.deepEqual(trekker.hits, [0, 1, 2, 3]);
	assert.equal(trekker.detail, '05');
	assert.deepEqual(trekker.pane, { kind: 'project', slug: 'trekker' });
	assert.deepEqual(trekker.action, { kind: 'go', path: '/projets/trekker/' });
});

test(':e t : cinq projets sur six, dans l’ordre de la maquette A, avec la lettre trouvée de chacun', () => {
	const listing = list('e t', accueil);
	assert.equal(listing.total, 6);
	assert.deepEqual(
		listing.entries.map(({ label, hits, detail }) => [label, hits, detail]),
		[
			// Le début du nom, puis le nom le plus court ; puis un début de mot ; puis la lettre la plus
			// proche du début de son mot.
			['trekker', [0], '05'],
			['typomaniac', [0], '01'],
			['claude-tmux-notify.nvim', [7], '02'],
			['claude-status-line', [8], '03'],
			['pointcloud-viewer', [4], '04'],
		],
	);
});

test('le filtre est flou : lettres dans l’ordre, pas forcément voisines, sans tenir compte de la casse', () => {
	const pv = list('e pv', accueil).entries;
	assert.deepEqual(
		pv.map(({ label, hits }) => [label, hits]),
		[['pointcloud-viewer', [0, 11]]],
	);
	// Le meilleur alignement : quatre lettres voisines en début de mot, pas le premier « n » venu.
	const [nvim] = list('e nvim', accueil).entries;
	assert.equal(nvim.label, 'claude-tmux-notify.nvim');
	assert.deepEqual(nvim.hits, [19, 20, 21, 22]);
	assert.deepEqual(
		list('e TREK', accueil).entries.map((e) => e.label),
		['trekker'],
	);
	assert.deepEqual(list('e zzz', accueil).entries, []);
});

test('la ligne peut commencer par « : », comme dans Vim', () => {
	assert.deepEqual(list(':e t', accueil), list('e t', accueil));
});

test(':e ouvre la fiche dans la version de la page', () => {
	const listing = list('e t', home);
	assert.equal(listing.title, 'Projects');
	assert.equal(listing.prompt, ':e');
	assert.deepEqual(listing.entries[0].action, { kind: 'go', path: '/en/projects/trekker/' });
	// Depuis une fiche, vers une autre.
	assert.deepEqual(list('e typo', ficheTrekker).entries[0].action, { kind: 'go', path: '/projets/typomaniac/' });
});

test('une Lunette vide liste les commandes ; :e y attend son argument', () => {
	for (const context of [accueil, home, ficheTrekker]) {
		const listing = list('', context);
		assert.equal(listing.title, context.locale === 'fr' ? 'Commandes' : 'Commands');
		assert.equal(listing.argument, undefined);
		const e = listing.entries.find((entry) => entry.label === 'e');
		assert.ok(e, ':e absente');
		// Pas d'action : Entrée passe à l'argument, comme Tab.
		assert.equal(e.action, undefined);
		assert.equal(e.line, 'e ');
		assert.equal(e.pane?.kind, 'help');
	}
});

test('run résout une ligne entière, ou répond E492', () => {
	assert.deepEqual(run('e trekker', accueil), { kind: 'go', path: '/projets/trekker/' });
	assert.deepEqual(run(':e ma_parcelle', home), { kind: 'go', path: '/en/projects/ma-parcelle/' });
	assert.deepEqual(run('nimporte', accueil), { error: 'E492: Not an editor command: nimporte' });
});

test('le contexte d’une page se lit dans son adresse', () => {
	assert.deepEqual(contextAt('/'), accueil);
	assert.deepEqual(contextAt('/en/'), home);
	assert.deepEqual(contextAt('/projets/trekker/'), ficheTrekker);
	assert.deepEqual(contextAt('/en/projects/claude-tmux-notify/'), { page: { kind: 'fiche', slug: 'claude-tmux-notify' }, locale: 'en' });
	assert.equal(contextAt('/figures/trekker.svg'), undefined);
});
