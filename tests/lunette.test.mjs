// La Lunette dans la sortie du build (ADR 0007) : ses déclencheurs dans la barre d'état de chaque page,
// et la Lunette elle-même dans un morceau à part, importé à la première ouverture par le module qui
// existe déjà sur la page. Ni son HTML, ni sa CSS, ni son script ne partent avec la page.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FICHE, HOME, PROJECTS, attr, css, elements, moduleGraph, readDist, readPage, tags, text } from './helpers/dist.mjs';

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

// La Lunette porte sa CSS, injectée à l'ouverture : les règles de l'ADR 0001 valent pour elle aussi.
test('la CSS de la Lunette, dans son morceau : ni :hover, ni transition, ni animation', () => {
	const [chunk] = lunetteOf(readPage(HOME.fr));
	const code = readDist(chunk.slice(1));
	assert.match(code, /\.lunette\b/, 'CSS de la Lunette absente de son morceau');
	assert.doesNotMatch(code, /(?<!\(\s*hover\s*):hover\b/);
	assert.doesNotMatch(code, /\btransition\s*:/);
	assert.doesNotMatch(code, /@keyframes|\banimation(?:-[a-z-]+)?\s*:/);
});
