// Section 03 · Activité : tout est dérivé de l'instantané des contributions GitHub.
// Valeurs attendues recoupées en exécutant le `renderVals()` de la maquette D1 sur ses
// 365 compteurs (et non recopiées du code du site). Les nombres `Intl` fr-FR contiennent
// une espace fine insécable (U+202F).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readHome, tags, attr, elements, text } from './helpers/dist.mjs';

const html = readHome();
const section = elements(html, 'section').find((s) => attr(tags(s, 'section')[0], 'id') === 'activite') ?? '';

test('la section Activité est la cible de l’ancre #activite et porte son h2', () => {
	assert.ok(section, 'aucune <section id="activite">');
	const h2s = elements(section, 'h2');
	assert.equal(h2s.length, 1);
	assert.equal(text(h2s[0]), 'Activité');
	assert.match(text(section), /^03\s*Activité/);
});

test('l’en-tête renvoie au profil GitHub', () => {
	const link = tags(section, 'a').find((a) => attr(a, 'href') === 'https://github.com/Popoch39');
	assert.ok(link, 'lien github.com/Popoch39 absent');
	assert.match(text(section), /github\.com\/Popoch39 ↗/);
});

// Somme des 365 compteurs de la maquette : 2 688. La maquette affiche « 2 699 », saisi à la
// main et non calculé (le calendrier GitHub couvre 53 semaines, une de plus que l'instantané).
test('le total des contributions est la somme de l’instantané', () => {
	assert.match(text(section), /2 688 contributions sur GitHub, ces 12 derniers mois/);
});

test('la barre d’état reprend le même total', () => {
	const [footer = ''] = elements(html, 'footer');
	assert.match(text(footer), /2 688 contributions · 12 mois/);
});

test('jours actifs, plus longue série et record en liste de définitions', () => {
	const lists = elements(section, 'dl');
	assert.equal(lists.length, 1);
	const terms = elements(lists[0], 'dt').map(text);
	const values = elements(lists[0], 'dd').map(text);
	assert.deepEqual(terms, ['jours actifs, sur 365', 'plus longue série', 'record, le 7 octobre 2026']);
	assert.deepEqual(values, ['232', '15 jours', '123']);
});

const [heatmap = '', bars = ''] = elements(section, 'figure');

test('la heatmap est une figure légendée, décrite par un libellé qui résume les données', () => {
	assert.equal(text(elements(heatmap, 'figcaption')[0] ?? ''), 'Contributions par jour oct. 2025 → oct. 2026 · survolez une case');
	const images = tags(heatmap, '[a-z]+').filter((t) => attr(t, 'role') === 'img');
	assert.equal(images.length, 1);
	assert.equal(
		attr(images[0], 'aria-label'),
		'Calendrier des contributions GitHub, d’octobre 2025 à octobre 2026 : 2 688 contributions, record de 123 le 7 octobre 2026.',
	);
});

test('365 cases, une par jour, chacune avec son infobulle native', () => {
	const titles = tags(heatmap, 'span')
		.map((t) => attr(t, 'title'))
		.filter((t) => t !== undefined);
	assert.equal(titles.length, 365);
	assert.equal(titles[0], '26 octobre 2025 · aucune contribution');
	assert.equal(titles[1], '27 octobre 2025 · 3 contributions');
	assert.equal(titles[49], '14 décembre 2025 · aucune contribution');
	assert.equal(titles[50], '15 décembre 2025 · 11 contributions');
	assert.equal(titles[346], '7 octobre 2026 · 123 contributions');
	assert.equal(titles[364], '25 octobre 2026 · 1 contribution');
});

test('les mois sont étiquetés au-dessus de la heatmap, et la légende donne les 5 paliers', () => {
	const content = text(heatmap);
	assert.match(content, /nov\.déc\.janv\.févr\.marsavr\.maijuinjuil\.aoûtsept\.oct\./);
	assert.match(content, /contributions \/ jour\s*0\s*1–4\s*5–14\s*15–49\s*50 et plus$/);
});

// Agrégats mensuels de la maquette : octobre 2025 (6 jours) → octobre 2026 (25 jours).
const MONTHS = [
	['octobre 2025', 'oct.', 13],
	['novembre 2025', 'nov.', 78],
	['décembre 2025', 'déc.', 74],
	['janvier 2026', 'janv.', 81],
	['février 2026', 'févr.', 106],
	['mars 2026', 'mars', 142],
	['avril 2026', 'avr.', 54],
	['mai 2026', 'mai', 139],
	['juin 2026', 'juin', 90],
	['juillet 2026', 'juil.', 232],
	['août 2026', 'août', 125],
	['septembre 2026', 'sept.', 930],
	['octobre 2026', 'oct.', 624],
];
const partial = (i) => i === 0 || i === MONTHS.length - 1;

test('l’histogramme est une figure légendée, qui signale les mois incomplets', () => {
	assert.equal(elements(section, 'figure').length, 2);
	assert.equal(
		text(elements(bars, 'figcaption')[0] ?? ''),
		'Contributions par mois * mois incomplets : 6 jours en oct. 2025, 25 en oct. 2026',
	);
	const images = tags(bars, '[a-z]+').filter((t) => attr(t, 'role') === 'img');
	assert.equal(images.length, 1);
	assert.equal(
		attr(images[0], 'aria-label'),
		`Contributions par mois : ${MONTHS.map(([name, , v], i) => `${name}${partial(i) ? ' (incomplet)' : ''} ${v}`).join(', ')}.`,
	);
});

test('13 barres, de hauteur proportionnelle au mois record (190 px), avec infobulle et étiquette', () => {
	const barTitles = tags(bars, 'span')
		.map((t) => attr(t, 'title'))
		.filter((t) => t !== undefined);
	assert.deepEqual(
		barTitles,
		MONTHS.map(([name, , v]) => `${name} · ${v} contributions`),
	);
	const heights = tags(bars, 'svg').map((t) => attr(t, 'height'));
	assert.deepEqual(heights, ['3', '16', '15', '17', '22', '29', '11', '28', '18', '47', '26', '190', '127']);
	assert.match(text(bars), new RegExp(MONTHS.map(([, short], i) => `${short}${partial(i) ? '\\*' : ''}`).join('')));
});

test('seuls le mois record et le dernier mois affichent leur valeur sur la barre', () => {
	const imageTag = tags(bars, '[a-z]+').find((t) => attr(t, 'role') === 'img') ?? '';
	const start = bars.indexOf(imageTag);
	const image = bars.slice(start, bars.indexOf('</div>', start));
	assert.equal(text(image), '930624');
});

test('le tableau dépliable donne les 13 mois en clair', () => {
	const details = elements(bars, 'details');
	assert.equal(details.length, 1);
	assert.equal(text(elements(details[0], 'summary')[0] ?? ''), 'Voir les données par mois');
	assert.deepEqual(elements(details[0], 'th').map(text), ['Mois', 'Contributions']);
	const rows = elements(elements(details[0], 'tbody')[0] ?? '', 'tr').map((tr) => elements(tr, 'td').map(text));
	assert.deepEqual(
		rows,
		MONTHS.map(([name, , v], i) => [`${name}${partial(i) ? ' (incomplet)' : ''}`, String(v)]),
	);
});
