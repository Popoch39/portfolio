// :checkhealth et :version (#61), deux commandes pour les développeurs curieux, qui montrent leur sortie
// dans le Volet. Le registre les offre sur toutes les pages ; le build injecte le commit et sa date dans
// le morceau de la Lunette, le seul à les lire, et jamais dans le HTML.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { list, run, contextAt } from '../src/lunette/registry.ts';
import { HOME, FICHE, PROJECTS, attr, moduleGraph, readDist, readPage, tags } from './helpers/dist.mjs';

const paths = ['fr', 'en'].flatMap((locale) => [HOME[locale], ...PROJECTS.map(({ slug }) => FICHE[locale](slug))]);

test(':checkhealth et :version existent sur toutes les pages, et montrent leur sortie dans le Volet', () => {
	for (const path of paths) {
		const context = contextAt(path);
		assert.ok(context, `${path} : pas de contexte`);
		const names = list('', context).entries.map((entry) => entry.label);
		for (const [name, kind] of [
			['checkhealth', 'health'],
			['version', 'version'],
		]) {
			assert.ok(names.includes(name), `${path} : :${name} absente`);
			assert.deepEqual(run(name, context), { kind: 'show', pane: { kind } }, `${path} : :${name}`);
			// Entrée sur la commande la lance ; avant, le Volet montre son aide.
			const [entry] = list(name, context).entries;
			assert.equal(entry.label, name, path);
			assert.deepEqual(entry.action, { kind: 'show', pane: { kind } }, path);
			assert.equal(entry.pane?.kind, 'help', path);
		}
	}
});

test(':checkhealth et :version ont leur aide dans la langue de la page', () => {
	const accueil = contextAt('/');
	const home = contextAt('/en/');
	for (const name of ['checkhealth', 'version']) {
		const fr = run(`help ${name}`, accueil);
		const en = run(`help ${name}`, home);
		assert.equal(fr.pane.name, name);
		assert.equal(en.pane.name, name);
		assert.ok(fr.pane.text && en.pane.text, `:help ${name} vide`);
		assert.notEqual(fr.pane.text, en.pane.text, `:help ${name} non traduite`);
	}
});

/** Le morceau de la Lunette, importé à la demande par le module de la page. */
function lunetteChunk(html) {
	const [script] = tags(html, 'script').filter((t) => attr(t, 'type') === 'module');
	const { code } = moduleGraph(attr(script ?? '', 'src') ?? '');
	const [, name] = /import\(\s*["'`]\.\/(lunette\.[\w-]+\.js)["'`]\s*\)/.exec(code) ?? [];
	assert.ok(name, 'la page n’importe pas la Lunette');
	return readDist(`_astro/${name}`);
}

// Le build en cours a été fait depuis ce dépôt : son commit court est celui de HEAD.
const commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
const astro = JSON.parse(readFileSync(new URL('../node_modules/astro/package.json', import.meta.url), 'utf8')).version;

/** Une chaîne littérale du code minifié, quel que soit son guillemet. */
const literal = (value) => new RegExp(`(["'\`])${value.replace(/\./g, '\\.')}\\1`);

test(':version : le commit et la version d’Astro sont injectés dans le morceau de la Lunette, jamais dans le HTML', () => {
	const chunk = lunetteChunk(readPage(HOME.fr));
	assert.match(chunk, literal(commit), `commit ${commit} absent du morceau de la Lunette`);
	assert.match(chunk, literal(astro), `Astro ${astro} absent du morceau de la Lunette`);
	// La date du build : un instant ISO, passé, que la Lunette formate dans la langue de la page.
	const [, date] = chunk.match(/["'`](\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z)["'`]/) ?? [];
	assert.ok(date, 'date du build absente du morceau de la Lunette');
	assert.ok(Date.parse(date) <= Date.now(), `date du build ${date} dans le futur`);
	for (const path of paths) assert.ok(!readPage(path).includes(commit), `${path} : commit ${commit} dans le HTML`);
});
