// Règle de temps : sous la figure qui a un temps (la rampe à cadran de claude-status-line), une
// règle graduée, ses événements marqués, et le bouton qui lance le tour. Sans script, rien n'y agit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROJECTS, readFiche, readHome, tags, attr, hasAttr, elements, text } from './helpers/dist.mjs';

const anatomyOf = (html) => elements(html, 'section').find((s) => elements(s, 'h2').map(text).includes('Anatomie')) ?? '';
const cardOf = (html) => elements(anatomyOf(html), 'figure')[0] ?? '';
const rulersOf = (html) => tags(html, 'div').filter((t) => hasAttr(t, 'data-regle'));
const html = readFiche('claude-status-line');
const card = cardOf(html);
/** La règle : de sa balise ouvrante à la fin de son SVG de graduations. */
const ruler = card.slice(card.indexOf(rulersOf(card)[0] ?? '\0')).match(/^[\s\S]*?<\/svg>\s*<\/div>/)?.[0] ?? '';

test('seule la fiche de claude-status-line a une règle de temps, sous sa figure', () => {
	for (const { slug } of PROJECTS) assert.equal(rulersOf(cardOf(readFiche(slug))).length, slug === 'claude-status-line' ? 1 : 0, slug);
	assert.equal(rulersOf(readHome()).length, 0, 'accueil');
	assert.ok(card.indexOf(rulersOf(card)[0]) > card.indexOf('data-motion='), 'règle au-dessus de la figure');
});

test('la règle est graduée de 0 à 2 h 30, toutes les 5 minutes', () => {
	const marks = elements(ruler, 'text').filter((t) => /class="mark\b/.test(t)).map(text);
	assert.deepEqual(marks, ['0', '30 min', '1 h', '1 h 30', '2 h', '2 h 30']);
	const ticks = tags(ruler, 'line').filter((t) => /class="tick\b/.test(t));
	assert.equal(ticks.length, 150 / 5 + 1);
	assert.deepEqual(ticks.slice(0, 2).map((t) => attr(t, 'x1')), ['0%', `${(5 / 150) * 100}%`.replace(/(\.\d{3})\d+/, '$1')]);
});

test('elle marque les huit événements du scénario et pose le curseur sur la minute au repos', () => {
	const events = tags(ruler, 'svg').filter((t) => /class="event\b/.test(t));
	assert.equal(events.length, 8);
	const [thumb] = tags(ruler, 'svg').filter((t) => hasAttr(t, 'data-thumb'));
	assert.ok(thumb, 'curseur absent');
	assert.equal(attr(thumb, 'x'), `${((1 / 150) * 100).toFixed(3)}%`);
	assert.equal(text(elements(ruler, 'text').find((t) => hasAttr(t, 'data-reading')) ?? ''), 'minute 1');
});

test('sans script, ni la règle ni le bouton du tour n’agissent', () => {
	const [rulerTag] = rulersOf(card);
	assert.equal(attr(rulerTag, 'tabindex'), undefined, 'règle focalisable sans script');
	assert.equal(attr(rulerTag, 'role'), undefined, 'règle annoncée comme curseur sans script');
	const tours = elements(card, 'button').filter((b) => hasAttr(tags(b, 'button')[0], 'data-tour'));
	assert.equal(tours.length, 1, 'bouton du tour absent');
	const tour = tags(tours[0], 'button')[0];
	assert.ok(hasAttr(tour, 'disabled'), 'bouton du tour actif sans script');
	assert.equal(attr(tour, 'type'), 'button');
	// Son libellé dit l'action (« Lancer », puis « Arrêter le tour ») : pas d'état pressé en plus.
	assert.equal(attr(tour, 'aria-pressed'), undefined);
	assert.equal(text(tours[0]), 'Lancer le tour');
});

test('la consigne désigne la règle et la figure', () => {
	const consignes = elements(card, 'span').filter((s) => /class="consigne\b/.test(s)).map(text);
	assert.equal(consignes.length, 2);
	for (const consigne of consignes) assert.match(consigne, /règle/);
});
