// Repère : au-dessus de la figure de chaque fiche, l'étiquette de la pièce visée, la pièce maîtresse
// au repos : numéro, nom, rôle, signature du code et lien vers lui, reliée à la pièce par un trait.
// C'est un doublon visuel de la nomenclature : les technologies d'assistance l'ignorent.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROJECTS, readFiche, readHome, tags, attr, hasAttr, elements, text } from './helpers/dist.mjs';

const fiches = PROJECTS.map((project) => ({ ...project, html: readFiche(project.slug) }));

const anatomyOf = (html) => elements(html, 'section').find((s) => elements(s, 'h2').map(text).includes('Anatomie')) ?? '';
const cardOf = (html) => elements(anatomyOf(html), 'figure')[0] ?? '';
/** Les panneaux du repère : un `<article>` par pièce, qui porte son crochet. */
const panelsOf = (html) => elements(cardOf(html), 'article').filter((a) => attr(tags(a, 'article')[0], 'data-piece') !== undefined);
const rowsOf = (html) => elements(anatomyOf(html), 'li').filter((li) => attr(tags(li, 'li')[0], 'data-piece') !== undefined);
const open = (fragment, name) => tags(fragment, name)[0] ?? '';

test('chaque fiche porte un repère dans la carte de sa figure, tu aux technologies d’assistance', () => {
	for (const { repo, html } of fiches) {
		const reperes = tags(cardOf(html), 'div').filter((t) => hasAttr(t, 'data-repere'));
		assert.equal(reperes.length, 1, `${repo} : un repère`);
		assert.equal(attr(reperes[0], 'aria-hidden'), 'true', `${repo} : repère exposé aux technologies d’assistance`);
		// Le repère précède la scène : l'étiquette est au-dessus de la figure.
		const card = cardOf(html);
		assert.ok(card.indexOf(reperes[0]) < card.indexOf('data-motion='), `${repo} : repère sous la figure`);
	}
});

test('un panneau par pièce, dans l’ordre de la nomenclature, la pièce maîtresse marquée', () => {
	for (const { repo, html } of fiches) {
		const ids = rowsOf(html).map((li) => attr(open(li, 'li'), 'data-piece'));
		const panels = panelsOf(html);
		assert.deepEqual(panels.map((a) => attr(open(a, 'article'), 'data-piece')), ids, repo);
		const masters = rowsOf(html).filter((li) => hasAttr(open(li, 'li'), 'data-master')).map((li) => attr(open(li, 'li'), 'data-piece'));
		const panelMasters = panels.filter((a) => hasAttr(open(a, 'article'), 'data-master')).map((a) => attr(open(a, 'article'), 'data-piece'));
		assert.deepEqual(panelMasters, masters, `${repo} : pièce maîtresse du repère`);
		const [master] = panels.filter((a) => hasAttr(open(a, 'article'), 'data-master'));
		assert.ok(text(master).includes('pièce maîtresse'), `${repo} : la pièce maîtresse n’est pas nommée telle`);
	}
});

test('chaque panneau reprend le numéro, le nom et le rôle de sa ligne de nomenclature', () => {
	for (const { repo, html } of fiches) {
		const rows = rowsOf(html);
		panelsOf(html).forEach((panel, i) => {
			const row = text(rows[i]);
			const name = text(elements(rows[i], 'span').find((s) => /class="name\b/.test(s)) ?? '');
			assert.ok(name, `${repo} : nom absent de la ligne ${i + 1}`);
			assert.match(text(panel), new RegExp(`^0${i + 1}\\s*${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), `${repo} : panneau ${i + 1}`);
			const role = text(elements(panel, 'p').find((p) => /class="role\b/.test(p)) ?? '');
			assert.ok(role.length > 20 && row.includes(role), `${repo} : rôle du panneau ${i + 1} « ${role} »`);
		});
	}
});

test('chaque panneau montre la signature du code : 1 à 4 lignes numérotées, dans la plage de la pièce', () => {
	for (const { repo, html } of fiches) {
		for (const panel of panelsOf(html)) {
			const [link] = tags(panel, 'a');
			const [, first, last] = (attr(link ?? '', 'href') ?? '').match(/#L(\d+)-L(\d+)$/) ?? [];
			const numbers = [...panel.matchAll(/class="ln\b[^"]*"[^>]*>(\d+)</g)].map((m) => Number(m[1]));
			assert.ok(numbers.length >= 1 && numbers.length <= 4, `${repo} : ${numbers.length} lignes de signature`);
			assert.equal(elements(panel, 'code').length, numbers.length, `${repo} : une ligne de code par numéro`);
			numbers.forEach((n, i) => {
				assert.ok(n >= Number(first) && n <= Number(last), `${repo} : ligne ${n} hors de ${first}–${last}`);
				if (i) assert.ok(n > numbers[i - 1], `${repo} : lignes dans le désordre`);
			});
			for (const code of elements(panel, 'code')) assert.ok(text(code).length > 0, `${repo} : ligne de code vide`);
		}
	}
});

test('le lien du panneau est le permalien de sa ligne, hors de l’ordre de tabulation', () => {
	for (const { repo, html } of fiches) {
		const rows = rowsOf(html);
		panelsOf(html).forEach((panel, i) => {
			const links = tags(panel, 'a');
			assert.equal(links.length, 1, `${repo} : un lien par panneau`);
			assert.equal(attr(links[0], 'href'), attr(tags(rows[i], 'a')[0], 'href'), `${repo} : permalien du panneau ${i + 1}`);
			assert.equal(attr(links[0], 'tabindex'), '-1', `${repo} : lien du repère dans l’ordre de tabulation`);
			const [, path, first, last] = attr(links[0], 'href').match(/\/blob\/[0-9a-f]{40}\/([^#]+)#L(\d+)-L(\d+)$/);
			const file = path.split('/').pop();
			assert.ok(text(elements(panel, 'a')[0]).startsWith(`${file}, lignes ${first}–${last}`), `${repo} : « ${text(elements(panel, 'a')[0])} »`);
		});
	}
});

test('l’aperçu de l’accueil n’a pas de repère', () => {
	const home = readHome();
	assert.equal(tags(home, 'div').filter((t) => hasAttr(t, 'data-repere')).length, 0);
});
