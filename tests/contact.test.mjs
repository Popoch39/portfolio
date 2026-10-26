// Section 05 · Contact : écrire à Louis en un clic, dans les deux versions.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readHome, tags, attr, elements, text } from './helpers/dist.mjs';

const VERSIONS = [
	{
		locale: 'fr',
		pitch: /Une API, une interface, un outil à construire \? Écrivez-moi\. Ouvert au remote\./,
		links: /GitHub — Popoch39 ↗ Config Neovim ↗ Besançon, France$/,
	},
	{
		locale: 'en',
		pitch: /An API, an interface, a tool that needs building\? Drop me a line\. Open to remote\./,
		links: /GitHub — Popoch39 ↗ Neovim config ↗ Besançon, France$/,
	},
];

for (const { locale, pitch, links } of VERSIONS) {
	const html = readHome(locale);
	const section = elements(html, 'section').find((s) => attr(tags(s, 'section')[0], 'id') === 'contact') ?? '';
	const hrefs = tags(section, 'a').map((a) => attr(a, 'href'));

	test(`${locale} : la section Contact est la cible de l’ancre #contact, numérotée 05, sans h2`, () => {
		assert.ok(section, 'aucune <section id="contact">');
		assert.match(text(section), /^05/);
		assert.equal(elements(section, 'h2').length, 0);
	});

	test(`${locale} : « :wq » géant est décoratif, ignoré par les lecteurs d’écran`, () => {
		const wq = tags(section, 'p').find((p) => attr(p, 'aria-hidden') === 'true');
		assert.ok(wq, '« :wq » non masqué');
		assert.equal(text(elements(section, 'p').find((p) => p.startsWith(wq))), ':wq');
	});

	test(`${locale} : la phrase d’appel, ouverte au remote, puis le grand lien mailto`, () => {
		assert.match(text(section), pitch);
		const mail = elements(section, 'a').find((a) => attr(a, 'href')?.startsWith('mailto:'));
		assert.ok(mail, 'lien mailto absent');
		assert.equal(attr(mail, 'href'), 'mailto:pocheron.louis@gmail.com');
		assert.equal(text(mail), 'pocheron.louis@gmail.com');
	});

	test(`${locale} : liens GitHub et config Neovim, puis la ville`, () => {
		assert.deepEqual(hrefs.slice(1), ['https://github.com/Popoch39', 'https://github.com/Popoch39/nvim']);
		assert.match(text(section), links);
	});
}
