// Haut de page : en-tête du site, héros et barre d'état.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readHome, tags, attr, elements, text } from './helpers/dist.mjs';

const html = readHome();
const body = elements(html, 'body')[0] ?? '';
const links = tags(body, 'a');
const hrefs = links.map((a) => attr(a, 'href'));

test('le h1 se lit « Louis Pocheron », le curseur décoratif est ignoré', () => {
	const [h1] = elements(body, 'h1');
	assert.equal(text(h1), 'Louis Pocheron');
	assert.match(h1, /aria-hidden="true"/);
});

test("l'en-tête nomme Louis, son rôle et sa ville", () => {
	const [header] = elements(body, 'header');
	assert.ok(header, '<header> absent');
	assert.match(text(header), /Louis Pocheron/);
	assert.match(text(header), /Concepteur & développeur d’applications/);
	assert.match(text(header), /Besançon, France/);
});

test('la navigation mène aux sections, dans l’ordre de la page', () => {
	const navs = elements(body, 'nav');
	assert.equal(navs.length, 1);
	const anchors = tags(navs[0], 'a').map((a) => attr(a, 'href'));
	assert.deepEqual(anchors, ['#projets', '#parcours', '#activite', '#stack', '#contact']);
	assert.deepEqual(
		elements(navs[0], 'a').map(text),
		['Projets', 'Parcours', 'Activité', 'Stack', 'Contact'],
	);
});

test('le héros résume le profil : accroche, rôle, langages, employeur', () => {
	assert.match(text(body), /Je conçois des applications web de bout en bout/);
	const [dl] = elements(body, 'dl');
	assert.ok(dl, 'liste de définitions absente');
	const terms = elements(dl, 'dt').map(text);
	const defs = elements(dl, 'dd').map(text);
	assert.deepEqual(terms, ['Rôle', 'Langages', 'Aujourd’hui']);
	assert.deepEqual(defs, [
		'Concepteur & développeur d’applications, fullstack',
		'TypeScript, PHP, Rust — un peu de Go et de Lua',
		'Da Viking Code, Dijon — depuis 2023',
	]);
});

test('le héros propose d’écrire et d’aller sur GitHub', () => {
	const write = elements(body, 'a').find((a) => /Écrire/.test(text(a)));
	assert.ok(write, 'bouton « Écrire » absent');
	assert.equal(attr(write, 'href'), 'mailto:pocheron.louis@gmail.com');
	assert.ok(hrefs.includes('https://github.com/Popoch39'), 'lien GitHub absent');
});

test("la barre d'état façon Neovim : mode, branche, fichier, contributions, position", () => {
	const [footer] = elements(body, 'footer');
	assert.ok(footer, '<footer> absent');
	const content = text(footer);
	for (const part of ['NORMAL', 'main', '~/louis/portfolio.md', 'Bas', ':wq']) {
		assert.ok(content.includes(part), `« ${part} » absent de la barre d'état`);
	}
	// Espace fine insécable de Intl.NumberFormat('fr-FR').
	assert.match(content, /2 699 contributions · 12 mois/);
});
