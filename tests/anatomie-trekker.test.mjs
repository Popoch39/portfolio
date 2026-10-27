// Anatomie de trekker dans les deux versions : la fiche et l'aperçu anglais parlent anglais, la
// version française ne bouge pas, et un seul module de mouvement sert les deux langues.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FIGURE, attr, elements, headOf, moduleGraph, readDist, readFiche, readHome, tags, text } from './helpers/dist.mjs';

const RELEVE = {
	fr: 'GET ?page=1 → 200 · 20 fiches · p. 1/5 · total 100',
	en: 'GET ?page=1 → 200 · 20 cards · p. 1/5 · total 100',
};

/** Des mots qui trahissent du français dans un texte anglais. */
const FRENCH = /\b(?:fiches?|tiroirs?|meuble|gabarit|pièces?|serrure|bac|glissières|une?|les?|des|du|et|ou|au|à|est|sur|dans|avec|chaque)\b/i;

const spanOf = (fragment, cls) => text(elements(fragment, 'span').find((el) => new RegExp(`class="[^"]*\\b${cls}\\b`).test(tags(el, 'span')[0])) ?? '');

/** La carte d'une figure : son titre, ses consignes (pointeur, toucher) et son relevé. */
const cardOf = (figure) => ({
	heading: text(figure.match(/class="fig"[^>]*>[^<]*<\/span>\s*<span[^>]*>([^<]*)</)?.[1] ?? ''),
	consignes: [spanOf(figure, 'pointer'), spanOf(figure, 'touch')],
	releve: text(figure.match(/data-releve[^>]*>([^<]*)</)?.[1] ?? ''),
});

/** La section anatomie d'une fiche, la carte de sa figure et le SVG de la figure. */
function anatomyOf(html) {
	const section = elements(html, 'section').find((s) => tags(s, 'svg').some((t) => attr(t, 'role') === 'img')) ?? '';
	const [figure] = elements(section, 'figure');
	const svg = tags(section, 'svg').find((t) => attr(t, 'role') === 'img') ?? '';
	const items = elements(section, 'li').filter((li) => /^item\b/.test(attr(tags(li, 'li')[0], 'class') ?? ''));
	const [hero] = elements(html, 'section');
	const head = headOf(html);
	return {
		title: text(elements(head, 'title')[0] ?? ''),
		description: attr(tags(head, 'meta').find((t) => attr(t, 'name') === 'description') ?? '', 'content'),
		lede: text(elements(hero ?? '', 'p')[0] ?? ''),
		emphasis: text(elements(hero ?? '', 'em')[0] ?? ''),
		...cardOf(figure ?? ''),
		caption: text(elements(section, 'figcaption')[0] ?? '').replace(/^Fig\. 1 — /, ''),
		label: attr(svg, 'aria-label') ?? '',
		pieces: items.map((li) => [spanOf(li, 'name'), spanOf(li.replace(/<a\b[\s\S]*<\/a>/, ''), 'role')]),
	};
}

test('en : la fiche de trekker montre son anatomie en anglais, sans un mot de français', () => {
	const en = anatomyOf(readFiche('trekker', 'en'));
	assert.equal(en.heading, 'Card cabinet and Zod gauge');
	assert.equal(en.emphasis, 'gauge');
	assert.equal(en.lede, 'A hiking API where every request first goes through the gauge of the shared contract.');
	assert.deepEqual(en.consignes, ['Pull a handle to request its page', 'Drag a drawer towards you to request its page']);
	assert.equal(en.releve, RELEVE.en);
	assert.deepEqual(
		en.pieces.map(([name]) => name),
		['Lock slot', 'Pin gauge', 'Reject tray', 'Rod and follower', 'Totaliser', 'Summary card', 'Ball-bearing runners', 'Cabinet body'],
	);
	// La légende garde les chiffres du code, au format anglais.
	assert.ok(en.caption.includes('(0.9 ms instead of 130 across 2,442 treks)'), en.caption);
	const texts = [en.title, en.description, en.lede, ...en.consignes, en.releve, en.caption, en.label, ...en.pieces.flat()];
	for (const value of texts) {
		assert.ok(value.length > 0, 'texte vide');
		assert.doesNotMatch(value, FRENCH, value);
	}
});

test('en : l’aperçu de l’accueil anglais et la figure autonome anglaise montrent trekker en anglais', () => {
	const home = readHome('en');
	const start = home.indexOf('data-panel="trekker"');
	assert.ok(start > 0, 'panneau trekker absent');
	const panel = home.slice(start, home.indexOf('data-panel=', start + 1) === -1 ? undefined : home.indexOf('data-panel=', start + 1));
	const [figure] = elements(panel, 'figure');
	assert.deepEqual(cardOf(figure ?? ''), {
		heading: 'Card cabinet and Zod gauge',
		consignes: ['Pull a handle to request its page', 'Drag a drawer towards you to request its page'],
		releve: RELEVE.en,
	});
	const alt = attr(tags(panel, 'img')[0] ?? '', 'alt') ?? '';
	const [svg] = tags(readDist(FIGURE.en('trekker').slice(1)), 'svg');
	assert.equal(attr(svg, 'aria-label'), alt);
	assert.match(alt, /^Wooden card cabinet with six drawers/);
	assert.doesNotMatch(alt, FRENCH, alt);
});

// Le mouvement écrit le relevé vivant et annonce la scène (libellé, tiroir choisi) : ses textes
// vivent dans un seul morceau, pour les deux versions, sous le budget de 20 Ko minifié (spec #10).
test('un seul module de mouvement pour les deux versions, qui annonce dans les deux langues, sous 20 Ko', () => {
	const chunkOf = (locale) => {
		const html = readFiche('trekker', locale);
		const [loader] = tags(html, 'script').filter((t) => attr(t, 'type') === 'module');
		const code = moduleGraph(attr(loader, 'src') ?? '').code;
		return code.match(/["']\.\/trekker\/motion\.ts["']\s*:[^}]*?\.\/(motion\.[\w-]+\.js)/)?.[1];
	};
	const chunk = chunkOf('en');
	assert.ok(chunk, 'morceau du mouvement de trekker introuvable');
	assert.equal(chunkOf('fr'), chunk, 'les deux versions chargent le même morceau');
	const code = readDist(`_astro/${chunk}`);
	for (const said of [
		'Card cabinet: the arrow keys choose a drawer, Enter or Space pulls it out and requests its page, Escape pushes it back in.',
		'Meuble à fiches : les flèches choisissent un tiroir, Entrée ou Espace le tire et demande sa page, Échap le repousse.',
		'Drawer ',
		'Tiroir ',
		'lat, lon and radiusKm together',
		'lat, lon et radiusKm ensemble',
	]) {
		assert.ok(code.includes(said), `« ${said} » absent du mouvement`);
	}
	assert.ok(Buffer.byteLength(code) <= 20_000, `mouvement de ${Buffer.byteLength(code)} octets`);
});

test('fr : la fiche de trekker garde son anatomie française', () => {
	const fr = anatomyOf(readFiche('trekker', 'fr'));
	assert.equal(fr.heading, 'Meuble à fiches et gabarit Zod');
	assert.equal(fr.emphasis, 'gabarit');
	assert.equal(fr.releve, RELEVE.fr);
	assert.equal(fr.pieces[0][0], 'Fente à serrure');
	assert.ok(fr.caption.includes('(0,9 ms au lieu de 130 sur 2 442 treks)'), fr.caption);
});
