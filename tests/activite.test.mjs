// Section 03 · Activité, le Tri (spec #107, ticket #108) : son état final, statique, tel que le voient le
// mouvement réduit et les navigateurs sans scène. Tout est dérivé de l'instantané des contributions GitHub.
// Valeurs attendues recoupées à la main sur les 365 compteurs de l'instantané (colonnes de 7 jours depuis
// le dimanche 26 octobre 2025), et non recopiées du code du site. Les nombres `Intl` fr-FR contiennent
// une espace fine insécable (U+202F) ; la version anglaise suit `en-GB` (« 2,688 », « 6 Sept »).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readHome, tags, attr, hasAttr, elementAt, elements, text } from './helpers/dist.mjs';

/** Jours actifs et contributions de chaque semaine de l'instantané, de la semaine du 26 octobre 2025 à celle du 25 octobre 2026. */
const WEEKS = `5/14 6/18 6/19 7/16 6/24 4/14 5/24 5/30 3/6 0/0 5/33 5/26 4/12 5/10 6/29 4/16 6/25 5/36 4/11 6/55 6/35 5/29 4/21 3/12
3/10 3/17 1/6 4/19 3/38 5/44 6/37 6/28 4/17 4/20 3/8 3/25 5/30 3/12 4/73 6/110 0/0 1/17 2/14 6/74 5/74 5/66 5/99 6/388 7/418 5/273 6/199 5/56 1/1`
	.split(/\s+/)
	.map((week) => week.split('/').map(Number));
/** Les deux semaines sans Jour actif. */
const PAUSES = [9, 40];

const VERSIONS = [
	{
		locale: 'fr',
		id: 'activite',
		title: 'Activité',
		status: /2 688 contributions · 12 mois/,
		count: '51 semaines actives sur 53',
		command: '$ git log --date-order --format=%ad | group-by semaine | uniq',
		conclusion: 'Le nombre de commits importe peu. Ce qui compte : 51 semaines actives sur 53, et jamais plus de 12 jours sans y revenir.',
		figureLabel:
			'Activité GitHub semaine par semaine, du 26 octobre 2025 au 25 octobre 2026 : 232 jours actifs sur 365, 51 semaines actives sur 53, 4,5 jours actifs par semaine active en moyenne. Pauses : semaines du 28 décembre 2025 et du 2 août 2026.',
		titles: {
			0: 'sem. du 26 oct. : 5 jours actifs, 14 contributions',
			9: 'sem. du 28 déc. : aucun jour actif, aucune contribution',
			45: 'sem. du 6 sept. : 5 jours actifs, 66 contributions',
			48: 'sem. du 27 sept. : 7 jours actifs, 418 contributions',
			52: 'sem. du 25 oct. : 1 jour actif, 1 contribution',
		},
		pauses: ['pause, sem. du 28 déc.', 'pause, sem. du 2 août'],
		table: {
			caption: 'Jours actifs et contributions, semaine par semaine',
			headers: ['Semaine du', 'Jours actifs', 'Contributions'],
			rows: { 0: ['26 octobre 2025', '5', '14'], 9: ['28 décembre 2025', '0', '0'], 48: ['27 septembre 2026', '7', '418'] },
		},
	},
	{
		locale: 'en',
		id: 'activity',
		title: 'Activity',
		status: /2,688 contributions · 12 months/,
		count: '51 active weeks out of 53',
		command: '$ git log --date-order --format=%ad | group-by week | uniq',
		conclusion: 'The number of commits hardly matters. What counts: 51 active weeks out of 53, and never more than 12 days without coming back.',
		figureLabel:
			'GitHub activity week by week, from 26 October 2025 to 25 October 2026: 232 active days out of 365, 51 active weeks out of 53, 4.5 active days per active week on average. Pauses: weeks of 28 December 2025 and 2 August 2026.',
		titles: {
			0: 'week of 26 Oct: 5 active days, 14 contributions',
			9: 'week of 28 Dec: no active days, no contributions',
			45: 'week of 6 Sept: 5 active days, 66 contributions',
			48: 'week of 27 Sept: 7 active days, 418 contributions',
			52: 'week of 25 Oct: 1 active day, 1 contribution',
		},
		pauses: ['pause, week of 28 Dec', 'pause, week of 2 Aug'],
		table: {
			caption: 'Active days and contributions, week by week',
			headers: ['Week of', 'Active days', 'Contributions'],
			rows: { 0: ['26 October 2025', '5', '14'], 9: ['28 December 2025', '0', '0'], 48: ['27 September 2026', '7', '418'] },
		},
	},
];

/** Les éléments complets dont la balise ouvrante porte la classe `name`. */
const withClass = (html, name) =>
	[...html.matchAll(new RegExp(`<[a-z]+\\b[^>]*\\sclass="(?:[^"]*\\s)?${name}(?:\\s[^"]*)?"[^>]*>`, 'g'))].map((m) => elementAt(html, m.index));
/** La balise ouvrante d'un élément complet. */
const openingTag = (element) => element.match(/^<[^>]*>/)[0];

for (const version of VERSIONS) {
	const { locale, id, title } = version;
	const html = readHome(locale);
	const section = elementAt(html, html.indexOf(`<section id="${id}"`)) ?? '';

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

	test(`${locale} : la barre d’état garde le total des contributions`, () => {
		const [footer = ''] = elements(html, 'footer');
		assert.match(text(footer), version.status);
	});

	test(`${locale} : le compteur donne les Semaines actives sur toutes les semaines`, () => {
		const counters = withClass(section, 'tri-count');
		assert.equal(counters.length, 1, 'un seul compteur');
		assert.equal(text(counters[0]), version.count);
	});

	test(`${locale} : la ligne de commande est complète`, () => {
		const commands = withClass(section, 'tri-command');
		assert.equal(commands.length, 1);
		assert.equal(text(commands[0]), version.command);
	});

	test(`${locale} : la phrase de conclusion donne les Semaines actives et le plus long trou`, () => {
		const conclusions = withClass(section, 'tri-conclusion');
		assert.equal(conclusions.length, 1);
		assert.equal(text(conclusions[0]), version.conclusion);
	});

	const [main = ''] = withClass(section, 'tri-main');
	const weeks = withClass(main, 'tri-week');

	// La figure est une image pour les lecteurs d'écran : sa description dit ce que montrent les nœuds.
	test(`${locale} : main est une figure décrite, exclue des extraits`, () => {
		assert.ok(main, 'main absente');
		const tag = openingTag(main);
		assert.equal(attr(tag, 'role'), 'img');
		assert.equal(attr(tag, 'aria-label'), version.figureLabel);
		assert.ok(hasAttr(tag, 'data-nosnippet'), 'main reprise dans les extraits');
	});

	test(`${locale} : main compte 53 nœuds, de la taille de leurs Jours actifs, chacun avec son infobulle`, () => {
		assert.equal(weeks.length, 53);
		assert.deepEqual(
			weeks.map((week) => Number(attr(openingTag(week), 'data-days'))),
			WEEKS.map(([days]) => days),
		);
		const titles = weeks.map((week) => attr(openingTag(week), 'title'));
		assert.ok(titles.every((title) => title), 'nœud sans infobulle');
		for (const [week, title] of Object.entries(version.titles)) assert.equal(titles[week], title);
	});

	test(`${locale} : chaque semaine sans Jour actif est une pause étiquetée de sa date`, () => {
		const paused = weeks.flatMap((week, i) => (withClass(week, 'tri-pause').length > 0 ? [i] : []));
		assert.deepEqual(paused, PAUSES);
		assert.deepEqual(
			paused.map((i) => text(withClass(weeks[i], 'tri-pause')[0])),
			version.pauses,
		);
	});

	// Le trait d'une semaine la relie à la précédente : pointillé s'il touche une pause.
	test(`${locale} : un trait plein relie les Semaines actives consécutives, un pointillé entoure chaque pause`, () => {
		const links = weeks.map((week) => attr(openingTag(week), 'data-link'));
		const expected = WEEKS.map((_, i) => {
			if (i === 0) return undefined;
			return PAUSES.includes(i) || PAUSES.includes(i - 1) ? 'dotted' : 'solid';
		});
		assert.deepEqual(links, expected);
	});

	test(`${locale} : le tableau des semaines, masqué à l’écran, donne le détail aux lecteurs d’écran`, () => {
		const tables = elements(section, 'table');
		assert.equal(tables.length, 1);
		const [table] = tables;
		assert.equal(attr(openingTag(table), 'aria-hidden'), undefined);
		assert.ok(/\bclass="[^"]*\bsr-only\b/.test(openingTag(table)), 'tableau affiché à l’écran');
		assert.equal(text(elements(table, 'caption')[0] ?? ''), version.table.caption);
		assert.deepEqual(elements(elements(table, 'thead')[0] ?? '', 'th').map(text), version.table.headers);
		const rows = elements(elements(table, 'tbody')[0] ?? '', 'tr').map((tr) => [...elements(tr, 'th'), ...elements(tr, 'td')].map(text));
		assert.equal(rows.length, 53);
		for (const [week, row] of Object.entries(version.table.rows)) assert.deepEqual(rows[week], row);
		assert.deepEqual(
			rows.map(([, days, contributions]) => [Number(days), Number(contributions.replace(/\D/g, ''))]),
			WEEKS,
		);
	});

	// Le Tri remplace le total, les trois statistiques, la heatmap à niveaux et les barres par mois.
	test(`${locale} : l’ancien contenu de l’Activité n’est plus dans la section`, () => {
		assert.doesNotMatch(text(section), /2[  ,]?688/);
		assert.equal(elements(section, 'dl').length, 0);
		assert.equal(elements(section, 'details').length, 0);
		assert.equal(tags(section, 'svg').length, 0);
		assert.doesNotMatch(section, /\blevel-\d\b/);
	});
}
