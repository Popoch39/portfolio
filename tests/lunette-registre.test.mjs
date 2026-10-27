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

const names = (context) => list('', context).entries.map((entry) => entry.label);

test('portée : une commande de fiche n’existe pas sur l’accueil, et y répond E492', () => {
	for (const context of [accueil, home]) {
		assert.ok(!names(context).includes('bn'), `${context.locale} : :bn listée sur l’accueil`);
		assert.deepEqual(run('bn', context), { error: 'E492: Not an editor command: bn' });
		assert.deepEqual(run(':bp', context), { error: 'E492: Not an editor command: bp' });
	}
	assert.ok(names(ficheTrekker).includes('bn'));
	assert.ok(names(ficheTrekker).includes('bp'));
	// La boucle de « Autres projets » : après la sixième fiche, la première.
	assert.deepEqual(run('bn', ficheTrekker), { kind: 'go', path: '/projets/ma-parcelle/' });
	assert.deepEqual(run('bn', { page: { kind: 'fiche', slug: 'ma-parcelle' }, locale: 'en' }), { kind: 'go', path: '/en/projects/typomaniac/' });
	assert.deepEqual(run('bp', ficheTrekker), { kind: 'go', path: '/projets/pointcloud-viewer/' });
});

test(':help e montre l’aide de :e dans le Volet, dans la langue de la page', () => {
	assert.deepEqual(run('help e', accueil), {
		kind: 'show',
		pane: { kind: 'help', name: 'e', text: 'Ouvre la fiche d’un projet : :e trekker.' },
	});
	assert.deepEqual(run(':help e', home), {
		kind: 'show',
		pane: { kind: 'help', name: 'e', text: 'Opens a project page: :e trekker.' },
	});
	// Le nom long de Vim, et l'abréviation de :help.
	assert.deepEqual(run('h edit', accueil), run('help e', accueil));
	// Une commande hors de portée n'a pas d'aide, comme un sujet inconnu de Vim.
	assert.deepEqual(run('help bn', accueil), { error: 'E149: Sorry, no help for bn' });
	assert.deepEqual(run('help nimporte', ficheTrekker), { error: 'E149: Sorry, no help for nimporte' });
});

test(':help attend une commande : la liste de la page, avec l’aide de chacune', () => {
	const listing = list('help ', ficheTrekker);
	assert.equal(listing.title, 'Commandes');
	assert.equal(listing.prompt, ':help');
	assert.equal(listing.argument, '');
	assert.deepEqual(
		listing.entries.map((entry) => entry.label),
		names(ficheTrekker),
	);
	const [e] = list('help e', home).entries;
	assert.equal(e.label, 'e');
	assert.equal(e.line, 'help e');
	assert.deepEqual(e.pane, { kind: 'help', name: 'e', text: 'Opens a project page: :e trekker.' });
	assert.deepEqual(e.action, { kind: 'show', pane: e.pane });
	assert.ok(!list('help ', accueil).entries.some((entry) => entry.label === 'bn'));
});

test(':help seul liste dans le Volet les commandes de la page ; Tab passe à son argument', () => {
	for (const context of [accueil, home, ficheTrekker]) {
		const result = run('help', context);
		assert.equal(result.kind, 'show');
		assert.equal(result.pane.name, 'help');
		assert.deepEqual(
			result.pane.commands.map((command) => command.name),
			names(context),
		);
		const e = result.pane.commands.find((command) => command.name === 'e');
		assert.equal(e.text, context.locale === 'fr' ? 'Ouvre la fiche d’un projet : :e trekker.' : 'Opens a project page: :e trekker.');
		// Dans une Lunette vide, Entrée sur help lance la liste, Tab passe à l'argument.
		const help = list('', context).entries.find((entry) => entry.label === 'help');
		assert.deepEqual(help.action, result);
		assert.equal(help.line, 'help ');
	}
});

/**
 * Les trois premières pièces de la claude-status-line, telles que la Lunette les lit dans la page : la
 * nomenclature (ordre et nom), puis la note en clair de chacune.
 */
const pieces = [
	{ id: 'aiguillage', name: 'Tête d’aiguillage', note: { title: 'Choisir la source', text: 'Prend les limites de Claude Code, sinon de l’API, sinon du cache.' } },
	{ id: 'sonde-api', name: 'Sonde API', note: { title: 'Demander à l’API', text: 'Interroge l’API Anthropic avec votre jeton, en 2,5 s au plus.' } },
	{ id: 'capsule-cache', name: 'Capsule de cache', note: { title: 'Garder une copie', text: 'Range les dernières limites dans un fichier JSON de secours.' } },
];
/** Une fiche dont la figure a une règle de temps, et la même figure sans. */
const ficheTemps = { page: { kind: 'fiche', slug: 'claude-status-line' }, locale: 'fr', figure: { pieces, timeline: true } };
const ficheFigure = { ...ficheTemps, figure: { pieces, timeline: false } };
const ficheEn = { ...ficheTemps, locale: 'en' };

test('portée : :pieces n’existe que sur une fiche à figure, :play et :pause que sur une figure à temps', () => {
	for (const context of [accueil, home]) {
		for (const name of ['pieces', 'play', 'pause']) {
			assert.ok(!names(context).includes(name), `${context.locale} : :${name} listée sur l’accueil`);
			assert.deepEqual(run(name, context), { error: `E492: Not an editor command: ${name}` });
		}
		assert.ok(!list('set ', context).entries.some((entry) => /^(lecture|view)=/.test(entry.label)), `${context.locale} : lecture réglable sur l’accueil`);
	}
	assert.ok(names(ficheFigure).includes('pieces'));
	assert.ok(names(ficheFigure).includes('set'));
	for (const name of ['play', 'pause']) {
		assert.ok(!names(ficheFigure).includes(name), `:${name} listée sur une figure sans temps`);
		assert.deepEqual(run(name, ficheFigure), { error: `E492: Not an editor command: ${name}` });
		assert.ok(names(ficheTemps).includes(name), `:${name} absente d’une figure à temps`);
	}
});

test(':pieces liste les pièces de la figure, numérotées comme la nomenclature, avec leur note dans le Volet', () => {
	const listing = list('pieces ', ficheFigure);
	assert.equal(listing.title, 'Pièces');
	assert.equal(listing.prompt, ':pieces');
	assert.equal(listing.total, 3);
	assert.deepEqual(
		listing.entries.map(({ label, detail }) => [label, detail]),
		[
			['Tête d’aiguillage', '01'],
			['Sonde API', '02'],
			['Capsule de cache', '03'],
		],
	);
	const [, sonde] = listing.entries;
	assert.deepEqual(sonde.pane, { kind: 'note', name: 'Sonde API', title: 'Demander à l’API', text: 'Interroge l’API Anthropic avec votre jeton, en 2,5 s au plus.' });
	// Entrée vise la pièce.
	assert.deepEqual(sonde.action, { kind: 'aim', piece: 'sonde-api' });
	assert.equal(list('pieces ', ficheEn).title, 'Parts');
	// Dans une Lunette vide, :pieces attend son argument, comme :e.
	const command = list('', ficheFigure).entries.find((entry) => entry.label === 'pieces');
	assert.equal(command.action, undefined);
	assert.equal(command.line, 'pieces ');
});

test(':pieces filtre les pièces par leur nom, et vise une pièce tapée par son nom ou son numéro', () => {
	assert.deepEqual(
		list('pieces cache', ficheFigure).entries.map((entry) => entry.label),
		['Capsule de cache'],
	);
	assert.deepEqual(run('pieces sonde', ficheFigure), { kind: 'aim', piece: 'sonde-api' });
	assert.deepEqual(run(':pieces 03', ficheFigure), { kind: 'aim', piece: 'capsule-cache' });
	// Comme une étiquette introuvable de Vim.
	assert.deepEqual(run('pieces zzz', ficheFigure), { error: 'E426: Tag not found: zzz' });
});

test('le contexte d’une page se lit dans son adresse', () => {
	assert.deepEqual(contextAt('/'), accueil);
	assert.deepEqual(contextAt('/en/'), home);
	assert.deepEqual(contextAt('/projets/trekker/'), ficheTrekker);
	assert.deepEqual(contextAt('/en/projects/claude-tmux-notify/'), { page: { kind: 'fiche', slug: 'claude-tmux-notify' }, locale: 'en' });
	assert.equal(contextAt('/figures/trekker.svg'), undefined);
});
