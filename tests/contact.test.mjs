// Section 05 · Contact : écrire à Louis en un clic.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readHome, tags, attr, elements, text } from './helpers/dist.mjs';

const html = readHome();
const section = elements(html, 'section').find((s) => attr(tags(s, 'section')[0], 'id') === 'contact') ?? '';
const hrefs = tags(section, 'a').map((a) => attr(a, 'href'));

test('la section Contact est la cible de l’ancre #contact, numérotée 05, sans h2', () => {
	assert.ok(section, 'aucune <section id="contact">');
	assert.match(text(section), /^05/);
	assert.equal(elements(section, 'h2').length, 0);
});

test('« :wq » géant est décoratif, ignoré par les lecteurs d’écran', () => {
	const wq = tags(section, 'p').find((p) => attr(p, 'aria-hidden') === 'true');
	assert.ok(wq, '« :wq » non masqué');
	assert.equal(text(elements(section, 'p').find((p) => p.startsWith(wq))), ':wq');
});

test('la phrase d’appel puis le grand lien mailto', () => {
	assert.match(text(section), /Une API, une interface, un outil à construire \? Écrivez-moi\./);
	const mail = elements(section, 'a').find((a) => attr(a, 'href')?.startsWith('mailto:'));
	assert.ok(mail, 'lien mailto absent');
	assert.equal(attr(mail, 'href'), 'mailto:pocheron.louis@gmail.com');
	assert.equal(text(mail), 'pocheron.louis@gmail.com');
});

test('liens GitHub et config Neovim, puis la ville', () => {
	assert.deepEqual(hrefs.slice(1), ['https://github.com/Popoch39', 'https://github.com/Popoch39/nvim']);
	assert.match(text(section), /GitHub — Popoch39 ↗ Config Neovim ↗ Besançon, France$/);
});
