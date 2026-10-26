// Section 04 · Stack : technologies par catégorie et outils du quotidien, dans les deux versions.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readHome, tags, attr, elements, text } from './helpers/dist.mjs';

const VERSIONS = [
	{
		locale: 'fr',
		categories: ['Langages', 'Back-end', 'Front-end', 'Data', 'DevOps', 'Outils', 'Carto & 3D'],
		tools: 'éditeur : neovim · multiplexeur : tmux · runtime : bun — la config est sur GitHub',
	},
	{
		locale: 'en',
		categories: ['Languages', 'Back-end', 'Front-end', 'Data', 'DevOps', 'Tooling', 'Mapping & 3D'],
		tools: 'editor: neovim · multiplexer: tmux · runtime: bun — the config is on GitHub',
	},
];

// Ce qu'un lecteur d'écran lit : les éléments `aria-hidden` (sans enfants ici) retirés.
const spoken = (fragment) => text(fragment.replace(/<(\w+)\b[^>]*aria-hidden="true"[^>]*>[^<]*<\/\1>/g, ''));

for (const { locale, categories, tools: toolsLine } of VERSIONS) {
	const html = readHome(locale);
	const section = elements(html, 'section').find((s) => attr(tags(s, 'section')[0], 'id') === 'stack') ?? '';

	test(`${locale} : la section Stack est la cible de l’ancre #stack et porte son h2`, () => {
		assert.ok(section, 'aucune <section id="stack">');
		const h2s = elements(section, 'h2');
		assert.equal(h2s.length, 1);
		assert.equal(text(h2s[0]), 'Stack');
		assert.match(text(section), /^04\s*Stack\s*:set stack\?/);
	});

	test(`${locale} : sept catégories, dans l’ordre de la maquette`, () => {
		const [dl] = elements(section, 'dl');
		assert.ok(dl, 'liste de définitions absente');
		assert.deepEqual(elements(dl, 'dt').map(text), categories);
		assert.equal(elements(dl, 'dd').length, 7);
	});

	test(`${locale} : les items sont séparés par « / » à l’écran, ignorés par les lecteurs d’écran`, () => {
		const [languages, , , , , , carto] = elements(section, 'dd');
		assert.equal(text(languages).replace(/\s+/g, ' '), 'TypeScript / Rust / PHP / SQL / Go / Lua');
		assert.equal(spoken(languages).replace(/\s+/g, ' '), 'TypeScript Rust PHP SQL Go Lua');
		assert.equal(spoken(carto).replace(/\s+/g, ' '), 'OpenLayers MapLibre GL PostGIS Three.js');
	});

	test(`${locale} : les outils du quotidien, avec le lien vers la config Neovim`, () => {
		const tools = elements(section, 'p').find((p) => /neovim/.test(text(p)));
		assert.ok(tools, 'ligne des outils absente');
		assert.equal(text(tools), toolsLine);
		const [link] = tags(tools, 'a');
		assert.equal(attr(link, 'href'), 'https://github.com/Popoch39/nvim');
	});
}
