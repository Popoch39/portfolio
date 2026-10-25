// Section 04 · Stack : technologies par catégorie et outils du quotidien.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readHome, tags, attr, elements, text } from './helpers/dist.mjs';

const html = readHome();
const section = elements(html, 'section').find((s) => attr(tags(s, 'section')[0], 'id') === 'stack') ?? '';

test('la section Stack est la cible de l’ancre #stack et porte son h2', () => {
	assert.ok(section, 'aucune <section id="stack">');
	const h2s = elements(section, 'h2');
	assert.equal(h2s.length, 1);
	assert.equal(text(h2s[0]), 'Stack');
	assert.match(text(section), /^04\s*Stack\s*:set stack\?/);
});

test('sept catégories, dans l’ordre de la maquette', () => {
	const [dl] = elements(section, 'dl');
	assert.ok(dl, 'liste de définitions absente');
	assert.deepEqual(elements(dl, 'dt').map(text), [
		'Langages',
		'Back-end',
		'Front-end',
		'Data',
		'DevOps',
		'Outils',
		'Carto & 3D',
	]);
	assert.equal(elements(dl, 'dd').length, 7);
});

// Ce qu'un lecteur d'écran lit : les éléments `aria-hidden` (sans enfants ici) retirés.
const spoken = (fragment) => text(fragment.replace(/<(\w+)\b[^>]*aria-hidden="true"[^>]*>[^<]*<\/\1>/g, ''));

test('les items sont séparés par « / » à l’écran, ignorés par les lecteurs d’écran', () => {
	const [languages, , , , , , carto] = elements(section, 'dd');
	assert.equal(text(languages).replace(/\s+/g, ' '), 'TypeScript / Rust / PHP / SQL / Go / Lua');
	assert.equal(spoken(languages).replace(/\s+/g, ' '), 'TypeScript Rust PHP SQL Go Lua');
	assert.equal(spoken(carto).replace(/\s+/g, ' '), 'OpenLayers MapLibre GL PostGIS Three.js');
});

test('les outils du quotidien, avec le lien vers la config Neovim', () => {
	const tools = elements(section, 'p').find((p) => /éditeur/.test(text(p)));
	assert.ok(tools, 'ligne des outils absente');
	assert.equal(
		text(tools),
		'éditeur : neovim · multiplexeur : tmux · runtime : bun — la config est sur GitHub',
	);
	const [link] = tags(tools, 'a');
	assert.equal(attr(link, 'href'), 'https://github.com/Popoch39/nvim');
});
