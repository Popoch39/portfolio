// Section 03 · Activité : tout est dérivé de l'instantané des contributions GitHub.
// Valeurs attendues recoupées en exécutant le `renderVals()` de la maquette D1 sur ses
// 365 compteurs (et non recopiées du code du site). Les nombres `Intl` fr-FR contiennent
// une espace fine insécable (U+202F) ; la version anglaise suit `en-GB` (« 2,688 », « 7 October 2026 »).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readHome, tags, attr, elements, text } from './helpers/dist.mjs';

// Agrégats mensuels de la maquette : octobre 2025 (6 jours) → octobre 2026 (25 jours).
const COUNTS = [13, 78, 74, 81, 106, 142, 54, 139, 90, 232, 125, 930, 624];
const zip = (names, shorts) => COUNTS.map((value, i) => [names[i], shorts[i], value]);

const VERSIONS = [
	{
		locale: 'fr',
		id: 'activite',
		title: 'Activité',
		total: /2 688 contributions sur GitHub, ces 12 derniers mois/,
		status: /2 688 contributions · 12 mois/,
		terms: ['jours actifs, sur 365', 'plus longue série', 'record, le 7 octobre 2026'],
		values: ['232', '15 jours', '123'],
		heatCaption: 'Contributions par jour oct. 2025 → oct. 2026 · survolez une case',
		heatLabel:
			'Calendrier des contributions GitHub, d’octobre 2025 à octobre 2026 : 2 688 contributions, record de 123 le 7 octobre 2026.',
		cells: {
			0: '26 octobre 2025 · aucune contribution',
			1: '27 octobre 2025 · 3 contributions',
			49: '14 décembre 2025 · aucune contribution',
			50: '15 décembre 2025 · 11 contributions',
			346: '7 octobre 2026 · 123 contributions',
			364: '25 octobre 2026 · 1 contribution',
		},
		monthLabels: /nov\.déc\.janv\.févr\.marsavr\.maijuinjuil\.aoûtsept\.oct\./,
		legend: /contributions \/ jour\s*0\s*1–4\s*5–14\s*15–49\s*50 et plus$/,
		months: zip(
			['octobre 2025', 'novembre 2025', 'décembre 2025', 'janvier 2026', 'février 2026', 'mars 2026', 'avril 2026', 'mai 2026', 'juin 2026', 'juillet 2026', 'août 2026', 'septembre 2026', 'octobre 2026'],
			['oct.', 'nov.', 'déc.', 'janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.'],
		),
		incomplete: ' (incomplet)',
		barsCaption: 'Contributions par mois * mois incomplets : 6 jours en oct. 2025, 25 en oct. 2026',
		barsLabel: (list) => `Contributions par mois : ${list}.`,
		summary: 'Voir les données par mois',
		headers: ['Mois', 'Contributions'],
	},
	{
		locale: 'en',
		id: 'activity',
		title: 'Activity',
		total: /2,688 contributions on GitHub in the last 12 months/,
		status: /2,688 contributions · 12 months/,
		terms: ['active days, out of 365', 'longest streak', 'best day, 7 October 2026'],
		values: ['232', '15 days', '123'],
		heatCaption: 'Contributions per day Oct 2025 → Oct 2026 · hover over a square',
		heatLabel: 'GitHub contribution calendar, October 2025 to October 2026: 2,688 contributions, best day 123 on 7 October 2026.',
		cells: {
			0: '26 October 2025 · no contributions',
			1: '27 October 2025 · 3 contributions',
			49: '14 December 2025 · no contributions',
			50: '15 December 2025 · 11 contributions',
			346: '7 October 2026 · 123 contributions',
			364: '25 October 2026 · 1 contribution',
		},
		monthLabels: /NovDecJanFebMarAprMayJunJulAugSeptOct/,
		legend: /contributions \/ day\s*0\s*1–4\s*5–14\s*15–49\s*50 and over$/,
		months: zip(
			['October 2025', 'November 2025', 'December 2025', 'January 2026', 'February 2026', 'March 2026', 'April 2026', 'May 2026', 'June 2026', 'July 2026', 'August 2026', 'September 2026', 'October 2026'],
			['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct'],
		),
		incomplete: ' (partial)',
		barsCaption: 'Contributions per month * partial months: 6 days in Oct 2025, 25 in Oct 2026',
		barsLabel: (list) => `Contributions per month: ${list}.`,
		summary: 'Show monthly data',
		headers: ['Month', 'Contributions'],
	},
];

for (const version of VERSIONS) {
	const { locale, id, title, months } = version;
	const html = readHome(locale);
	const section = elements(html, 'section').find((s) => attr(tags(s, 'section')[0], 'id') === id) ?? '';
	const partial = (i) => i === 0 || i === months.length - 1;

	test(`${locale} : la section ${title} est la cible de l’ancre #${id} et porte son h2`, () => {
		assert.ok(section, `aucune <section id="${id}">`);
		const h2s = elements(section, 'h2');
		assert.equal(h2s.length, 1);
		assert.equal(text(h2s[0]), title);
		assert.match(text(section), new RegExp(`^03\\s*${title}`));
	});

	test(`${locale} : l’en-tête renvoie au profil GitHub`, () => {
		const link = tags(section, 'a').find((a) => attr(a, 'href') === 'https://github.com/Popoch39');
		assert.ok(link, 'lien github.com/Popoch39 absent');
		assert.match(text(section), /github\.com\/Popoch39 ↗/);
	});

	// Somme des 365 compteurs de la maquette : 2 688. La maquette affiche « 2 699 », saisi à la
	// main et non calculé (le calendrier GitHub couvre 53 semaines, une de plus que l'instantané).
	test(`${locale} : le total des contributions est la somme de l’instantané`, () => {
		assert.match(text(section), version.total);
	});

	test(`${locale} : la barre d’état reprend le même total`, () => {
		const [footer = ''] = elements(html, 'footer');
		assert.match(text(footer), version.status);
	});

	test(`${locale} : jours actifs, plus longue série et record en liste de définitions`, () => {
		const lists = elements(section, 'dl');
		assert.equal(lists.length, 1);
		assert.deepEqual(elements(lists[0], 'dt').map(text), version.terms);
		assert.deepEqual(elements(lists[0], 'dd').map(text), version.values);
	});

	const [heatmap = '', bars = ''] = elements(section, 'figure');

	test(`${locale} : la heatmap est une figure légendée, décrite par un libellé qui résume les données`, () => {
		assert.equal(text(elements(heatmap, 'figcaption')[0] ?? ''), version.heatCaption);
		const images = tags(heatmap, '[a-z]+').filter((t) => attr(t, 'role') === 'img');
		assert.equal(images.length, 1);
		assert.equal(attr(images[0], 'aria-label'), version.heatLabel);
	});

	test(`${locale} : 365 cases, une par jour, chacune avec son infobulle native`, () => {
		const titles = tags(heatmap, 'span')
			.map((t) => attr(t, 'title'))
			.filter((t) => t !== undefined);
		assert.equal(titles.length, 365);
		for (const [day, title] of Object.entries(version.cells)) assert.equal(titles[day], title);
	});

	test(`${locale} : les mois sont étiquetés au-dessus de la heatmap, et la légende donne les 5 paliers`, () => {
		const content = text(heatmap);
		assert.match(content, version.monthLabels);
		assert.match(content, version.legend);
	});

	test(`${locale} : l’histogramme est une figure légendée, qui signale les mois incomplets`, () => {
		assert.equal(elements(section, 'figure').length, 2);
		assert.equal(text(elements(bars, 'figcaption')[0] ?? ''), version.barsCaption);
		const images = tags(bars, '[a-z]+').filter((t) => attr(t, 'role') === 'img');
		assert.equal(images.length, 1);
		assert.equal(
			attr(images[0], 'aria-label'),
			version.barsLabel(months.map(([name, , v], i) => `${name}${partial(i) ? version.incomplete : ''} ${v}`).join(', ')),
		);
	});

	test(`${locale} : 13 barres, de hauteur proportionnelle au mois record (190 px), avec infobulle et étiquette`, () => {
		const barTitles = tags(bars, 'span')
			.map((t) => attr(t, 'title'))
			.filter((t) => t !== undefined);
		assert.deepEqual(
			barTitles,
			months.map(([name, , v]) => `${name} · ${v} contributions`),
		);
		const heights = tags(bars, 'svg').map((t) => attr(t, 'height'));
		assert.deepEqual(heights, ['3', '16', '15', '17', '22', '29', '11', '28', '18', '47', '26', '190', '127']);
		assert.match(text(bars), new RegExp(months.map(([, short], i) => `${short.replace('.', '\\.')}${partial(i) ? '\\*' : ''}`).join('')));
	});

	test(`${locale} : seuls le mois record et le dernier mois affichent leur valeur sur la barre`, () => {
		const imageTag = tags(bars, '[a-z]+').find((t) => attr(t, 'role') === 'img') ?? '';
		const start = bars.indexOf(imageTag);
		const image = bars.slice(start, bars.indexOf('</div>', start));
		assert.equal(text(image), '930624');
	});

	test(`${locale} : le tableau dépliable donne les 13 mois en clair`, () => {
		const details = elements(bars, 'details');
		assert.equal(details.length, 1);
		assert.equal(text(elements(details[0], 'summary')[0] ?? ''), version.summary);
		assert.deepEqual(elements(details[0], 'th').map(text), version.headers);
		const rows = elements(elements(details[0], 'tbody')[0] ?? '', 'tr').map((tr) => elements(tr, 'td').map(text));
		assert.deepEqual(
			rows,
			months.map(([name, , v], i) => [`${name}${partial(i) ? version.incomplete : ''}`, String(v)]),
		);
	});
}
