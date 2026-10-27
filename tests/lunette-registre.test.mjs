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
		// Hors de sa portée, l'option n'existe pas plus que la commande : E492, pas E474.
		for (const line of ['set lecture=code', ':set view=plain', 'set lecture']) {
			assert.deepEqual(run(line, context), { error: `E492: Not an editor command: ${line.replace(/^:/, '')}` }, `${context.locale} : ${line}`);
		}
	}
	// Sur une figure, une valeur inconnue reste un argument invalide.
	assert.deepEqual(run('set view=gras', ficheFigure), { error: 'E474: Invalid argument: view=gras' });
	assert.ok(names(ficheFigure).includes('pieces'));
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

test(':set lecture=code règle la lecture des notes ; :set view=plain aussi, en anglais comme en français', () => {
	assert.deepEqual(run(':set lecture=code', ficheFigure), { kind: 'lecture', value: 'code' });
	assert.deepEqual(run('set lecture=clair', ficheFigure), { kind: 'lecture', value: 'clair' });
	assert.deepEqual(run('set view=plain', ficheEn), { kind: 'lecture', value: 'clair' });
	assert.deepEqual(run('set view=code', ficheEn), { kind: 'lecture', value: 'code' });
	// Le nom de l'autre langue est accepté.
	assert.deepEqual(run('set view=plain', ficheFigure), { kind: 'lecture', value: 'clair' });
	assert.deepEqual(run('set lecture=code', ficheEn), { kind: 'lecture', value: 'code' });
	assert.deepEqual(run('set lecture=gras', ficheFigure), { error: 'E474: Invalid argument: lecture=gras' });
	// Proposées dans la langue de la page, après la version.
	const labels = (context) => list('set ', context).entries.map((entry) => entry.label);
	assert.deepEqual(labels(ficheFigure).slice(-2), ['lecture=clair', 'lecture=code']);
	assert.deepEqual(labels(ficheEn).slice(-2), ['view=plain', 'view=code']);
	// Le filtre montre le nom trouvé.
	assert.deepEqual(
		list('set view=p', ficheFigure).entries.map((entry) => entry.label),
		['view=plain'],
	);
});

test(':help set cite la lecture des notes là où elle existe, dans la langue de la page', () => {
	const setHelp = (context) => run('help set', context).pane.text;
	assert.match(setHelp(ficheFigure), /:set lecture=clair\|code\b/);
	assert.match(setHelp(ficheEn), /:set view=plain\|code\b/);
	// L'index de :help seul dit la même chose.
	assert.equal(run('help', ficheEn).pane.commands.find((command) => command.name === 'set').text, setHelp(ficheEn));
	for (const context of [accueil, home, ficheTrekker]) {
		assert.match(setHelp(context), /:set lang=/, context.locale);
		assert.doesNotMatch(setHelp(context), /lecture|view/, `${context.locale} : lecture citée sans figure`);
	}
});

test(':play lance le tour de la règle de temps, :pause l’arrête', () => {
	assert.deepEqual(run(':play', ficheTemps), { kind: 'tour', play: true });
	assert.deepEqual(run('pause', ficheTemps), { kind: 'tour', play: false });
	assert.deepEqual(list('', ficheTemps).entries.find((entry) => entry.label === 'play').action, { kind: 'tour', play: true });
});

test(':set lang=en ouvre la même page dans l’autre version, et l’inverse', () => {
	assert.deepEqual(run(':set lang=en', ficheTrekker), { kind: 'go', path: '/en/projects/trekker/' });
	assert.deepEqual(run('set lang=fr', { page: { kind: 'fiche', slug: 'trekker' }, locale: 'en' }), { kind: 'go', path: '/projets/trekker/' });
	assert.deepEqual(run('set lang=en', accueil), { kind: 'go', path: '/en/' });
	assert.deepEqual(run('set lang=fr', home), { kind: 'go', path: '/' });
	// La commande Vim est la même dans les deux versions ; l'autre version est proposée d'abord.
	for (const context of [accueil, home]) {
		const listing = list('set ', context);
		assert.equal(listing.prompt, ':set');
		assert.deepEqual(
			listing.entries.map((entry) => entry.label),
			context.locale === 'fr' ? ['lang=en', 'lang=fr'] : ['lang=fr', 'lang=en'],
		);
	}
	assert.deepEqual(run('set lang=de', accueil), { error: 'E474: Invalid argument: lang=de' });
});

test('une section mène à son ancre de l’accueil, depuis l’accueil comme depuis une fiche', () => {
	assert.deepEqual(run(':parcours', accueil), { kind: 'go', path: '/#parcours' });
	assert.deepEqual(run('parcours', ficheTrekker), { kind: 'go', path: '/#parcours' });
	assert.deepEqual(run('activity', { page: { kind: 'fiche', slug: 'trekker' }, locale: 'en' }), { kind: 'go', path: '/en/#activity' });
	// Les noms suivent la langue de la page.
	assert.deepEqual(
		['projets', 'parcours', 'activite', 'stack', 'contact'].filter((name) => names(accueil).includes(name)),
		['projets', 'parcours', 'activite', 'stack', 'contact'],
	);
	assert.deepEqual(
		['projects', 'career', 'activity', 'stack', 'contact'].filter((name) => names(home).includes(name)),
		['projects', 'career', 'activity', 'stack', 'contact'],
	);
	assert.ok(!names(accueil).includes('career'));
	assert.ok(!names(home).includes('parcours'));
});

test('les alias de l’autre langue sont acceptés : :career sur une page française', () => {
	// L'ancre reste celle de la page.
	assert.deepEqual(run('career', accueil), { kind: 'go', path: '/#parcours' });
	assert.deepEqual(run(':projets', home), { kind: 'go', path: '/en/#projects' });
	// Le filtre les trouve aussi, et montre le nom tapé.
	const [career] = list('career', accueil).entries;
	assert.equal(career.label, 'career');
	assert.deepEqual(career.hits, [0, 1, 2, 3, 4, 5]);
	assert.deepEqual(career.action, { kind: 'go', path: '/#parcours' });
	// Et en argument de :help.
	assert.deepEqual(
		list('help career', accueil).entries.map((entry) => entry.label),
		['career'],
	);
	// Sans saisie, chaque commande une seule fois, dans la langue de la page.
	assert.equal(names(accueil).filter((name) => name === 'contact').length, 1);
});

test(':marks liste les cinq sections avec leur nom localisé, et l’aide de chacune au Volet', () => {
	for (const [context, labels, title] of [
		[accueil, ['Projets', 'Parcours', 'Activité', 'Stack', 'Contact'], 'Sections'],
		[home, ['Projects', 'Career', 'Activity', 'Stack', 'Contact'], 'Sections'],
		[ficheTrekker, ['Projets', 'Parcours', 'Activité', 'Stack', 'Contact'], 'Sections'],
	]) {
		const listing = list('marks ', context);
		assert.equal(listing.title, title);
		assert.equal(listing.prompt, ':marks');
		assert.equal(listing.total, 5);
		assert.deepEqual(
			listing.entries.map((entry) => entry.label),
			labels,
		);
	}
	const [parcours] = list('marks parc', accueil).entries;
	assert.equal(parcours.label, 'Parcours');
	assert.deepEqual(parcours.pane, run('help parcours', accueil).pane);
	assert.deepEqual(parcours.action, { kind: 'go', path: '/#parcours' });
	// Depuis une fiche, et avec le nom de l'autre langue.
	assert.deepEqual(run('marks career', ficheTrekker), { kind: 'go', path: '/#parcours' });
	assert.deepEqual(list('marks care', accueil).entries[0].action, { kind: 'go', path: '/#parcours' });
	// Une Lunette vide : Entrée sur :marks ouvre la liste.
	const marks = list('', accueil).entries.find((entry) => entry.label === 'marks');
	assert.equal(marks.action, undefined);
	assert.equal(marks.line, 'marks ');
});

// Sur l'accueil, `:q` répond E37 : c'est un easter egg, testé avec les autres (lunette-oeufs).
test(':q revient d’une fiche à l’accueil de sa langue', () => {
	assert.deepEqual(run(':q', ficheTrekker), { kind: 'go', path: '/' });
	assert.deepEqual(run('quit', { page: { kind: 'fiche', slug: 'trekker' }, locale: 'en' }), { kind: 'go', path: '/en/' });
	assert.ok(names(ficheTrekker).includes('q'));
});

test('le contexte d’une page se lit dans son adresse', () => {
	assert.deepEqual(contextAt('/'), accueil);
	assert.deepEqual(contextAt('/en/'), home);
	assert.deepEqual(contextAt('/projets/trekker/'), ficheTrekker);
	assert.deepEqual(contextAt('/en/projects/claude-tmux-notify/'), { page: { kind: 'fiche', slug: 'claude-tmux-notify' }, locale: 'en' });
	assert.equal(contextAt('/figures/trekker.svg'), undefined);
});
