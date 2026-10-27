// Le contact par la Lunette (#60) : les commandes du registre qui copient l'adresse de Louis, ouvrent ses
// liens et ramènent au contact, importées telles quelles sous Node.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { list, run } from '../src/lunette/registry.ts';
import { modified } from '../src/lunette/normal.ts';
import { attr, moduleGraph, readDist, readPage, tags, HOME, FICHE } from './helpers/dist.mjs';

const accueil = { page: { kind: 'home' }, locale: 'fr' };
const home = { page: { kind: 'home' }, locale: 'en' };
const ficheTrekker = { page: { kind: 'fiche', slug: 'trekker' }, locale: 'fr' };
const trekkerPage = { page: { kind: 'fiche', slug: 'trekker' }, locale: 'en' };

const names = (context) => list('', context).entries.map((entry) => entry.label);

test(':wq et :x descendent au contact de l’accueil, ou y ramènent depuis une fiche, dans la version de la page', () => {
	for (const line of ['wq', ':x', 'xit']) {
		assert.deepEqual(run(line, accueil), { kind: 'go', path: '/#contact' }, line);
		assert.deepEqual(run(line, ficheTrekker), { kind: 'go', path: '/#contact' }, line);
		assert.deepEqual(run(line, home), { kind: 'go', path: '/en/#contact' }, line);
		assert.deepEqual(run(line, trekkerPage), { kind: 'go', path: '/en/#contact' }, line);
	}
	// Listée sous son nom, l'alias accepté tapé en entier : Entrée sur wq y va tout de suite.
	for (const context of [accueil, ficheTrekker]) {
		const wq = list('', context).entries.find((entry) => entry.label === 'wq');
		assert.deepEqual(wq?.action, { kind: 'go', path: '/#contact' });
		assert.ok(!names(context).includes('x'));
	}
});

const mail = 'pocheron.louis@gmail.com';

/** La copie de l'adresse, avec l'écho de sa réussite et celui de son échec, dans la langue de la page. */
const yank = {
	fr: { kind: 'yank', text: mail, copied: `"${mail}" copiée dans le presse-papiers`, failed: `Copie impossible, l’adresse à la main : ${mail}` },
	en: { kind: 'yank', text: mail, copied: `"${mail}" copied to the clipboard`, failed: `Couldn’t copy, the address by hand: ${mail}` },
};

test(':yank mail copie l’adresse, avec l’écho traduit de la copie, et celui de l’échec qui la donne en clair', () => {
	assert.deepEqual(run('yank mail', accueil), yank.fr);
	assert.deepEqual(run(':yank mail', home), yank.en);
	assert.deepEqual(run('yank mail', trekkerPage), yank.en);
	// L'abréviation de Vim, l'autre nom de l'adresse, et :yank seul : il n'y a qu'elle à copier.
	for (const line of ['y mail', 'yank email', 'yank'])
		assert.deepEqual(run(line, ficheTrekker), yank.fr, line);
	assert.deepEqual(run('yank nimporte', accueil), { error: 'E492: Not an editor command: yank nimporte' });
});

test(':yank attend ce qu’il copie : l’adresse, à droite de son nom', () => {
	const listing = list('yank ', home);
	assert.equal(listing.prompt, ':yank');
	assert.equal(listing.title, 'To copy');
	assert.equal(listing.enter, 'copy');
	assert.deepEqual(
		listing.entries.map(({ label, detail, line, action }) => ({ label, detail, line, action })),
		[{ label: 'mail', detail: mail, line: 'yank mail', action: yank.en }],
	);
	// Dans une Lunette vide, Entrée sur yank copie, Tab passe à l'argument.
	const entry = list('', accueil).entries.find((entry) => entry.label === 'yank');
	assert.deepEqual(entry?.action, yank.fr);
	assert.equal(entry?.line, 'yank ');
});

const github = { kind: 'open', url: 'https://github.com/Popoch39' };
const nvim = { kind: 'open', url: 'https://github.com/Popoch39/nvim' };

test(':!github et :!nvim ouvrent le profil GitHub et la config Neovim de Louis, partout', () => {
	for (const context of [accueil, home, ficheTrekker, trekkerPage]) {
		assert.deepEqual(run(':!github', context), github);
		assert.deepEqual(run('!nvim', context), nvim);
	}
	// Comme le shell de Vim, une espace après le `!` ne change rien ; le début du nom suffit.
	assert.deepEqual(run('! github', accueil), github);
	assert.deepEqual(run('!nv', accueil), nvim);
	assert.deepEqual(run('!rm', accueil), { error: 'E492: Not an editor command: !rm' });
});

test(':! attend un lien : les deux, avec leur adresse à droite, collés au ! comme dans Vim', () => {
	const listing = list('!', accueil);
	assert.equal(listing.prompt, ':!');
	assert.equal(listing.title, 'Liens');
	assert.equal(listing.enter, 'ouvrir dans un onglet');
	assert.deepEqual(
		listing.entries.map(({ label, detail, line, action }) => ({ label, detail, line, action })),
		[
			{ label: 'github', detail: 'github.com/Popoch39', line: '!github', action: github },
			{ label: 'nvim', detail: 'github.com/Popoch39/nvim', line: '!nvim', action: nvim },
		],
	);
	assert.equal(list('!gi', home).title, 'Links');
	assert.deepEqual(
		list('!gi', home).entries.map((entry) => entry.label),
		['github'],
	);
	assert.ok(names(home).includes('!'));
});

const press = (key, modifiers = {}) => ({ key, ctrlKey: false, metaKey: false, altKey: false, ...modifiers });

// Sur un clavier AZERTY, `]` et `[` se tapent avec AltGr (Ctrl+Alt sous Windows) ou Option (Alt sur Mac) :
// le garde-fou les laisse passer au mode normal. Cmd reste au navigateur (Cmd+[ y recule), comme Ctrl et
// Alt sur une lettre.
test('AZERTY : Alt et AltGr tapent ]] et [[ ; Cmd, et Ctrl ou Alt sur une lettre, restent au navigateur', () => {
	for (const key of [']', '[']) {
		assert.equal(modified(press(key)), false, key);
		assert.equal(modified(press(key, { altKey: true })), false, `Alt+${key}`);
		assert.equal(modified(press(key, { ctrlKey: true, altKey: true })), false, `AltGr+${key}`);
		assert.equal(modified(press(key, { metaKey: true })), true, `Cmd+${key}`);
		assert.equal(modified(press(key, { metaKey: true, altKey: true })), true, `Cmd+Alt+${key}`);
	}
	for (const key of ['g', 'y', 'G']) {
		assert.equal(modified(press(key)), false, key);
		for (const modifiers of [{ altKey: true }, { ctrlKey: true }, { metaKey: true }, { ctrlKey: true, altKey: true }]) {
			assert.equal(modified(press(key, modifiers)), true, `${JSON.stringify(modifiers)}+${key}`);
		}
	}
});

/** Le code que la page charge avec elle : son module et ses imports statiques. */
function pageCode(path) {
	const [script] = tags(readPage(path), 'script').filter((t) => attr(t, 'type') === 'module');
	return moduleGraph(attr(script ?? '', 'src') ?? '');
}

// `yy` est une séquence de l'écouteur, mais la copie et son écho vivent dans la Lunette : la page ne
// charge ni l'un ni l'autre avant le premier `yy`.
test('yy est joué par l’écouteur de chaque page, sans que l’écho ni l’adresse arrivent avec la page', () => {
	for (const path of [HOME.fr, HOME.en, FICHE.fr('trekker'), FICHE.en('trekker')]) {
		const { code } = pageCode(path);
		assert.match(code, /\byy\b/, `${path} : yy absente de l’écouteur`);
		assert.ok(!code.includes('data-echo'), `${path} : l’écho arrive avec la page`);
		assert.ok(!code.includes(mail), `${path} : l’adresse arrive avec la page`);
	}
	const lunette = [...pageCode(HOME.fr).code.matchAll(/import\(\s*["'`]\.\/(lunette\.[\w-]+\.js)["'`]\s*\)/g)].map((m) => m[1]);
	assert.equal(lunette.length, 1);
	assert.ok(readDist(`_astro/${lunette[0]}`).includes('data-echo'), 'l’écho absent de la Lunette');
});
