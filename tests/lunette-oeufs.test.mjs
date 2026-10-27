// Les easter eggs de la Lunette (#62) : `:smile`, `:q` et `:q!` sur l'accueil, `:Ex`, `:Lazy` et
// `:Mason`. Le registre est importé tel quel sous Node ; les versions de `:Lazy`, injectées au build,
// se vérifient dans le morceau de la Lunette.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bare, list, run } from '../src/lunette/registry.ts';
import { HOME, attr, moduleGraph, readDist, readPage, tags } from './helpers/dist.mjs';

const accueil = { page: { kind: 'home' }, locale: 'fr' };
const home = { page: { kind: 'home' }, locale: 'en' };
const ficheTrekker = { page: { kind: 'fiche', slug: 'trekker' }, locale: 'fr' };
const trekkerPage = { page: { kind: 'fiche', slug: 'trekker' }, locale: 'en' };

const names = (context) => list('', context).entries.map((entry) => entry.label);

const E37 = { error: 'E37: No write since last change (add ! to override)' };

test(':q sur l’accueil répond E37, comme Vim devant un tampon modifié ; sur une fiche, il revient à l’accueil', () => {
	for (const context of [accueil, home]) {
		assert.deepEqual(run('q', context), E37);
		assert.deepEqual(run(':quit', context), E37);
		assert.ok(names(context).includes('q'), `${context.locale} : :q absente de l’accueil`);
		// Choisie dans la liste, elle répond pareil.
		assert.deepEqual(list('q', context).entries.find((entry) => entry.label === 'q')?.action, E37);
	}
	assert.deepEqual(run('q', ficheTrekker), { kind: 'go', path: '/' });
	assert.deepEqual(run('q', trekkerPage), { kind: 'go', path: '/en/' });
});

test(':q! ferme l’accueil sous un aplat ; sur une fiche, il revient à l’accueil comme :q', () => {
	for (const context of [accueil, home]) {
		assert.deepEqual(run('q!', context), { kind: 'quit' });
		assert.deepEqual(run(':quit!', context), { kind: 'quit' });
		assert.ok(names(context).includes('q!'));
	}
	assert.deepEqual(run('q!', ficheTrekker), { kind: 'go', path: '/' });
	assert.deepEqual(run('quit!', trekkerPage), { kind: 'go', path: '/en/' });
	// Tapée, `q!` passe devant `q`, qui ne répond qu'à moitié.
	assert.equal(list('q!', accueil).entries[0].label, 'q!');
});

// La première ligne du `:smile` de Neovim (`verify_command`, src/nvim/ex_docmd.c), recopiée à la main.
const nope = '#xxn`          #xnxx`        ,+x@##@Mz;`        .xxxxxxxxxnz+,      znnnnnnnnnnnnnnnn.';

// L'écran fermé se rouvre par `:e` seul, sous les noms que le registre donne à la commande.
test(':e seul, ou :edit, rouvre l’écran de :q! ; avec un argument ou sous un autre nom, non', () => {
	for (const line of ['e', ':e', 'e ', ' :e', 'edit', ':edit!', 'e!', ': e']) assert.ok(bare(line, 'e'), line);
	for (const line of ['e trekker', 'ex', 'q', 'edi', '']) assert.ok(!bare(line, 'e'), line);
});

test(':smile montre au Volet l’ASCII art de Neovim, partout', () => {
	for (const context of [accueil, home, ficheTrekker]) {
		const result = run('smile', context);
		assert.equal(result.kind, 'show');
		assert.equal(result.pane.kind, 'art');
		assert.equal(result.pane.title, 'smile');
		// Le « NOPE » de Neovim, sans la marge que lui ajoute `msg`.
		assert.equal(result.pane.lines.length, 31);
		assert.equal(result.pane.lines[0], nope);
		assert.ok(names(context).includes('smile'));
	}
});

/** Les adresses du sitemap livré : la source des pages, que `:Ex` doit reprendre toutes. */
const sitemap = () => [...readDist('sitemap.xml').matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, url]) => new URL(url).pathname);

test(':Ex liste toutes les pages des deux versions, celles du sitemap, et Entrée ouvre celle choisie', () => {
	for (const context of [accueil, home, ficheTrekker]) {
		const listing = list('Ex ', context);
		assert.equal(listing.title, 'Pages');
		assert.equal(listing.prompt, ':Ex');
		assert.equal(listing.total, 14);
		assert.deepEqual(listing.entries.map((entry) => entry.action?.path).sort(), sitemap().sort());
	}
	// L'arborescence de netrw : le français à la racine, l'anglais sous `en/`.
	assert.deepEqual(
		list('Ex ', accueil).entries.map((entry) => entry.label),
		[
			'./',
			'projets/typomaniac/',
			'projets/claude-tmux-notify/',
			'projets/claude-status-line/',
			'projets/pointcloud-viewer/',
			'projets/trekker/',
			'projets/ma-parcelle/',
			'en/',
			'en/projects/typomaniac/',
			'en/projects/claude-tmux-notify/',
			'en/projects/claude-status-line/',
			'en/projects/pointcloud-viewer/',
			'en/projects/trekker/',
			'en/projects/ma-parcelle/',
		],
	);
	assert.deepEqual(run('Ex en/projects/trekker/', accueil), { kind: 'go', path: '/en/projects/trekker/' });
	assert.deepEqual(run(':Explore entrek', ficheTrekker), { kind: 'go', path: '/en/projects/trekker/' });
	// Une Lunette vide : Entrée sur :Ex ouvre la liste, comme Tab.
	const ex = list('', accueil).entries.find((entry) => entry.label === 'Ex');
	assert.equal(ex.action, undefined);
	assert.equal(ex.line, 'Ex ');
});

test(':Ex montre au Volet l’arbre de netrw, la page sélectionnée marquée', () => {
	const entries = list('Ex ', home).entries;
	const [root] = entries;
	assert.deepEqual(root.pane, {
		kind: 'tree',
		title: 'netrw',
		lines: [
			'./',
			'| projets/',
			'| | typomaniac/',
			'| | claude-tmux-notify/',
			'| | claude-status-line/',
			'| | pointcloud-viewer/',
			'| | trekker/',
			'| | ma-parcelle/',
			'| en/',
			'| | projects/',
			'| | | typomaniac/',
			'| | | claude-tmux-notify/',
			'| | | claude-status-line/',
			'| | | pointcloud-viewer/',
			'| | | trekker/',
			'| | | ma-parcelle/',
		],
		at: 0,
	});
	const at = (label) => entries.find((entry) => entry.label === label).pane.at;
	assert.equal(at('projets/typomaniac/'), 2);
	assert.equal(at('en/'), 8);
	assert.equal(at('en/projects/ma-parcelle/'), 15);
});

test(':Lazy présente la stack en gestionnaire de plugins : la Lunette et les figures en « lazy »', () => {
	for (const [context, lunette] of [
		[accueil, 'Lunette'],
		[home, 'Telescope'],
		[ficheTrekker, 'Lunette'],
	]) {
		const result = run('Lazy', context);
		assert.equal(result.kind, 'show');
		assert.equal(result.pane.kind, 'plugins');
		assert.equal(result.pane.title, 'lazy.nvim');
		const plugin = (name) => result.pane.plugins.find((p) => p.name === name);
		for (const name of ['astro', 'typescript']) {
			assert.equal(plugin(name)?.state, 'loaded', name);
			// Sa version est celle du paquet installé, que le build injecte dans la Lunette.
			assert.equal(plugin(name)?.package, name);
		}
		for (const name of [lunette, 'figures']) assert.equal(plugin(name)?.state, 'lazy', name);
		for (const { name, role } of result.pane.plugins) assert.ok(role, `${name} : pas de rôle`);
		assert.ok(names(context).includes('Lazy'));
	}
	// Les rôles suivent la langue de la page.
	assert.notEqual(run('Lazy', accueil).pane.plugins[0].role, run('Lazy', home).pane.plugins[0].role);
});

test(':Mason répond comme :Lazy', () => {
	for (const context of [accueil, home]) assert.deepEqual(run('Mason', context), run('Lazy', context));
});

test('les commandes de Neovim gardent leur casse : :lazy et :ex n’existent pas', () => {
	assert.deepEqual(run('lazy', accueil), { error: 'E492: Not an editor command: lazy' });
	assert.deepEqual(run('ex', accueil), { error: 'E492: Not an editor command: ex' });
	// Le filtre, lui, ne tient pas compte de la casse.
	assert.equal(list('lazy', accueil).entries[0].label, 'Lazy');
});

test('le morceau de la Lunette porte les versions installées d’Astro et de TypeScript', () => {
	const installed = (name) => JSON.parse(readFileSync(new URL(`../node_modules/${name}/package.json`, import.meta.url), 'utf8')).version;
	const [script] = tags(readPage(HOME.fr), 'script').filter((t) => attr(t, 'type') === 'module');
	const { code } = moduleGraph(attr(script, 'src'));
	const [chunk] = [...code.matchAll(/import\(\s*["'`]\.\/(lunette\.[\w-]+\.js)["'`]\s*\)/g)].map((m) => m[1]);
	assert.ok(chunk, 'la Lunette n’est pas importée à la demande');
	const lunette = moduleGraph(`/_astro/${chunk}`).code;
	// Une chaîne littérale du code minifié, quel que soit son guillemet.
	const literal = (value) => new RegExp(`(["'\`])${value.replace(/\./g, '\\.')}\\1`);
	for (const name of ['astro', 'typescript']) assert.match(lunette, literal(installed(name)), `${name} ${installed(name)} absent de la Lunette`);
});
