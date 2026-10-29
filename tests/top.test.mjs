// Haut de page : en-tête du site, héros et barre d'état, dans les deux versions de l'accueil.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readHome, tags, attr, elements, text, bufferStart } from './helpers/dist.mjs';

const VERSIONS = [
	{
		locale: 'fr',
		role: 'Concepteur & développeur d’applications',
		anchors: ['#projets', '#parcours', '#activite', '#stack', '#contact'],
		labels: ['Projets', 'Parcours', 'Activité', 'Stack', 'Contact'],
		lede: /Je conçois des applications web de bout en bout/,
		terms: ['Rôle', 'Langages', 'Aujourd’hui'],
		defs: [
			'Concepteur & développeur d’applications, fullstack',
			'TypeScript, PHP, Rust — un peu de Go et de Lua',
			'Da Viking Code, Dijon — depuis 2023',
		],
		write: 'Écrire',
		position: 'Bas',
		contributions: /\d contributions · 12 mois/,
	},
	{
		locale: 'en',
		role: 'Full-stack developer',
		anchors: ['#projects', '#career', '#activity', '#stack', '#contact'],
		labels: ['Projects', 'Career', 'Activity', 'Stack', 'Contact'],
		lede: /I build web applications end to end/,
		terms: ['Role', 'Languages', 'Currently'],
		defs: ['Full-stack developer', 'TypeScript, PHP, Rust — plus some Go and Lua', 'Da Viking Code, Dijon — since 2023'],
		write: 'Email me',
		position: 'Bot',
		contributions: /\d contributions · 12 months/,
	},
];

for (const version of VERSIONS) {
	const { locale } = version;
	const html = readHome(locale);
	const body = elements(html, 'body')[0] ?? '';
	const hrefs = tags(body, 'a').map((a) => attr(a, 'href'));

	test(`${locale} : le h1 se lit « Louis Pocheron », le curseur décoratif est ignoré`, () => {
		const [h1] = elements(body, 'h1');
		assert.equal(text(h1), 'Louis Pocheron');
		assert.match(h1, /aria-hidden="true"/);
	});

	test(`${locale} : l'en-tête nomme Louis, son rôle et sa ville`, () => {
		const [header] = elements(body, 'header');
		assert.ok(header, '<header> absent');
		assert.match(text(header), /Louis Pocheron/);
		assert.ok(text(header).includes(version.role), `rôle « ${version.role} » absent`);
		assert.match(text(header), /Besançon, France/);
	});

	// Le sélecteur de langue, en fin de navigation, est vérifié par i18n.test.mjs.
	test(`${locale} : la navigation mène aux sections, dans l’ordre de la page`, () => {
		const navs = elements(body, 'nav');
		assert.equal(navs.length, 1);
		const sections = elements(navs[0], 'a').filter((a) => attr(a, 'href').startsWith('#'));
		assert.deepEqual(
			sections.map((a) => attr(a, 'href')),
			version.anchors,
		);
		assert.deepEqual(sections.map(text), version.labels);
	});

	test(`${locale} : le héros résume le profil : accroche, rôle, langages, employeur`, () => {
		assert.match(text(body), version.lede);
		const [dl] = elements(body, 'dl');
		assert.ok(dl, 'liste de définitions absente');
		assert.deepEqual(elements(dl, 'dt').map(text), version.terms);
		assert.deepEqual(elements(dl, 'dd').map(text), version.defs);
	});

	// Une ancre sur la première ligne du Buffer, un champ : à l'arrivée, le navigateur y pose le focus de
	// lui-même, sans script (#121).
	test(`${locale} : le héros propose d’écrire, au Buffer de la section Contact, et d’aller sur GitHub`, () => {
		const write = elements(body, 'a').find((a) => text(a).startsWith(version.write));
		assert.ok(write, `bouton « ${version.write} » absent`);
		const first = bufferStart(body);
		assert.ok(first, 'Buffer absent de la section Contact');
		assert.equal(attr(first, 'name'), 'type');
		assert.equal(attr(write, 'href'), `#${attr(first, 'id')}`);
		assert.ok(hrefs.includes('https://github.com/Popoch39'), 'lien GitHub absent');
	});

	test(`${locale} : la barre d'état façon Neovim : mode, branche, fichier, contributions, position`, () => {
		const [footer] = elements(body, 'footer');
		assert.ok(footer, '<footer> absent');
		const content = text(footer);
		for (const part of ['NORMAL', 'main', '~/louis/portfolio.md', version.position, ':wq']) {
			assert.ok(content.includes(part), `« ${part} » absent de la barre d'état`);
		}
		// Le total, dérivé de l'instantané GitHub, est vérifié par activite.test.mjs.
		assert.match(content, version.contributions);
	});
}
