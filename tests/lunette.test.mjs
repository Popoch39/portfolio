// La Lunette dans la sortie du build (ADR 0007) : ses déclencheurs dans la barre d'état de chaque page,
// et la Lunette elle-même dans un morceau à part, importé à la première ouverture par le module qui
// existe déjà sur la page. Ni son HTML, ni sa CSS, ni son script ne partent avec la page.
import { readdirSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FICHE, HOME, PROJECTS, attr, css, hasAttr, elements, moduleGraph, readDist, readPage, tags, text } from './helpers/dist.mjs';

const versions = [
	{ locale: 'fr', wq: 'Ouvrir les commandes (:wq)', commands: ': commandes' },
	{ locale: 'en', wq: 'Open commands (:wq)', commands: ': commands' },
];

const pagesOf = (locale) => [HOME[locale], ...PROJECTS.map(({ slug }) => FICHE[locale](slug))].map((path) => ({ path, html: readPage(path) }));

/** Les morceaux qu'un code importe à la demande (`import("./y.js")`), en chemins servis. */
const onDemand = (code) => [...code.matchAll(/import\(\s*["'`]\.\/([\w.-]+\.js)["'`]\s*\)/g)].map((m) => `/_astro/${m[1]}`);

/** Le morceau de la Lunette qu'importe le module de la page, par son nom. */
function lunetteOf(html) {
	const [script] = tags(html, 'script').filter((t) => attr(t, 'type') === 'module');
	const graph = moduleGraph(attr(script ?? '', 'src') ?? '');
	return onDemand(graph.code).filter((path) => /\/lunette\.[\w-]+\.js$/.test(path));
}

for (const version of versions) {
	const pages = pagesOf(version.locale);

	test(`${version.locale} : la barre d’état de chaque page a le bouton :wq, nommé dans sa langue, et le bouton « ${version.commands} »`, () => {
		for (const { path, html } of pages) {
			const [footer] = elements(html, 'footer');
			const buttons = elements(footer ?? '', 'button');
			const wq = buttons.find((b) => text(b) === ':wq');
			assert.ok(wq, `${path} : :wq n’est pas un bouton`);
			assert.equal(attr(tags(wq, 'button')[0], 'type'), 'button', path);
			assert.equal(attr(tags(wq, 'button')[0], 'aria-label'), version.wq, path);
			assert.equal(attr(tags(wq, 'button')[0], 'aria-haspopup'), 'dialog', path);
			const commands = buttons.find((b) => text(b) === version.commands);
			assert.ok(commands, `${path} : « ${version.commands} » n’est pas un bouton`);
			assert.equal(attr(tags(commands, 'button')[0], 'type'), 'button', path);
			assert.equal(attr(tags(commands, 'button')[0], 'aria-haspopup'), 'dialog', path);
		}
	});

	// Les échos (erreur E492, copie de l'adresse) s'écrivent dans une région live présente dès le
	// premier rendu, vide : une région ajoutée en même temps que son message ne serait pas annoncée.
	test(`${version.locale} : la barre d’état de chaque page a la région d’écho, live polie et vide`, () => {
		for (const { path, html } of pages) {
			const [footer] = elements(html, 'footer');
			const regions = tags(footer ?? '', 'span').filter((t) => attr(t, 'aria-live') !== undefined);
			assert.equal(regions.length, 1, `${path} : une région d’écho`);
			const [region] = regions;
			assert.equal(attr(region, 'aria-live'), 'polite', path);
			assert.equal(attr(region, 'role'), 'status', path);
			assert.equal(attr(region, 'aria-hidden'), undefined, path);
			assert.ok(footer.includes(`${region}</span>`), `${path} : région d’écho non vide`);
		}
	});

	// Le showcmd de Neovim : les touches en attente, à gauche de « : commandes » (planche « Barre d'état »).
	// Un écho visuel de ce qu'on vient de taper : rien à lire pour un lecteur d'écran.
	test(`${version.locale} : la barre d’état de chaque page a le showcmd, vide, à gauche de « ${version.commands} », masqué aux lecteurs d’écran`, () => {
		for (const { path, html } of pages) {
			const [footer] = elements(html, 'footer');
			const [showcmd] = tags(footer ?? '', 'span').filter((t) => hasAttr(t, 'data-showcmd'));
			assert.ok(showcmd, `${path} : pas de showcmd`);
			assert.equal(attr(showcmd, 'aria-hidden'), 'true', path);
			const [segment] = elements(footer.slice(footer.indexOf(showcmd)), 'span');
			assert.equal(text(segment), '', `${path} : showcmd non vide`);
			const commands = elements(footer, 'button').find((b) => text(b) === version.commands);
			assert.ok(footer.indexOf(showcmd) < footer.indexOf(commands), `${path} : showcmd après « ${version.commands} »`);
		}
	});

	test(`${version.locale} : chaque page importe la Lunette à la demande, sans la référencer ni la précharger`, () => {
		for (const { path, html } of pages) {
			const chunks = lunetteOf(html);
			assert.equal(chunks.length, 1, `${path} : la Lunette n’est pas importée à la demande par le module de la page`);
			const [chunk] = chunks;
			assert.ok(readDist(chunk.slice(1)).length > 0, `${path} : ${chunk} vide`);
			assert.ok(!html.includes(chunk.slice('/_astro/'.length)), `${path} : ${chunk} référencé par la page`);
			const preloads = tags(html, 'link').filter((t) => /preload/.test(attr(t, 'rel') ?? '') && /lunette/.test(attr(t, 'href') ?? ''));
			assert.deepEqual(preloads, [], path);
		}
	});

	test(`${version.locale} : aucune CSS ni aucun HTML de la Lunette dans les pages`, () => {
		for (const { path, html } of pages) {
			assert.doesNotMatch(css(html), /\.lunette\b/, `${path} : CSS de la Lunette dans la page`);
			assert.equal(elements(html, 'dialog').length, 0, `${path} : <dialog> dans la page`);
		}
	});
}

// La Lunette lit la figure dans la page (spec #47, « Données ») : les pièces dans l'ordre de la
// nomenclature, la note et le lien de code de chacune, et la règle de temps qui ouvre `:play`.
test('chaque fiche donne à la Lunette ses pièces, leur note et leur code, et sa règle de temps s’il y en a une', () => {
	for (const locale of ['fr', 'en']) {
		for (const { slug } of PROJECTS) {
			const html = readPage(FICHE[locale](slug));
			const items = tags(html, 'li').filter((t) => /\bclass="item"/.test(t));
			const notes = tags(html, 'li').filter((t) => /\bclass="note\b/.test(t));
			assert.ok(items.length > 0, `${slug} : nomenclature vide`);
			assert.deepEqual(
				notes.map((t) => attr(t, 'data-piece')),
				items.map((t) => attr(t, 'data-piece')),
				`${slug} : notes et nomenclature`,
			);
			const refs = tags(html, 'a').filter((t) => /\bclass="ref"/.test(t));
			assert.equal(refs.length, notes.length, `${slug} : une note sans lien de code`);
			for (const ref of refs) assert.match(attr(ref, 'href') ?? '', /^https:\/\/github\.com\/Popoch39\/[\w.-]+\/blob\/[0-9a-f]{40}\//, slug);
			const tours = tags(html, 'button').filter((t) => hasAttr(t, 'data-tour'));
			assert.equal(tours.length, slug === 'claude-status-line' ? 1 : 0, `${slug} : bouton du tour`);
		}
	}
});

// Viser une pièce passe par le module de mise en avant (ADR 0003), la Lunette comprise : aucun autre
// code livré n'écrit l'état de visée.
test('seul le module de mise en avant écrit data-on et data-aiming', () => {
	const writes = /(?:set|toggle|remove)Attribute\(\s*["'`]data-(?:on|aiming)["'`]|\.dataset\.(?:on|aiming)\b/;
	const writers = readdirSync(new URL('../dist/_astro/', import.meta.url)).filter((name) => name.endsWith('.js') && writes.test(readDist(`_astro/${name}`)));
	assert.deepEqual(
		writers.map((name) => name.split('.')[0]),
		['highlight'],
	);
});

// La Lunette porte sa CSS, injectée à l'ouverture : les règles de l'ADR 0001 valent pour elle aussi.
test('la CSS de la Lunette, dans son morceau : ni :hover, ni transition, ni animation', () => {
	const [chunk] = lunetteOf(readPage(HOME.fr));
	const code = readDist(chunk.slice(1));
	assert.match(code, /\.lunette\b/, 'CSS de la Lunette absente de son morceau');
	assert.doesNotMatch(code, /(?<!\(\s*hover\s*):hover\b/);
	assert.doesNotMatch(code, /\btransition\s*:/);
	assert.doesNotMatch(code, /@keyframes|\banimation(?:-[a-z-]+)?\s*:/);
});
