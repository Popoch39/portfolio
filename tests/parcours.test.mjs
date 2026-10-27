// Section 02 · Parcours : trois étapes professionnelles, puis la formation, dans les deux versions.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readHome, tags, attr, elements, text } from './helpers/dist.mjs';

const VERSIONS = [
	{
		locale: 'fr',
		id: 'parcours',
		title: 'Parcours',
		summary: '~4 ans · santé, énergie, sport',
		current: ['mars 2023 → aujourd’hui · Dijon', 'Concepteur & développeur d’applications'],
		energy: /pour un grand acteur de l’énergie/,
		internship: ['sept. → déc. 2021 · Doucier', 'Stage — développeur web'],
		education: 'Formation',
		degrees: [
			'2022 — 2023 Concepteur & développeur d’applications Access Code School, Besançon',
			'2020 — 2021 Développeur web & développeur mobile Access Code School, Besançon',
			'2018 — 2020 Langues étrangères appliquées (LEA) UFR SLHS, Besançon',
			'2018 Baccalauréat économique et social Lycée Carnot, Dijon',
		],
	},
	{
		locale: 'en',
		id: 'career',
		title: 'Career',
		summary: '~4 years · healthcare, energy, sport',
		current: ['Mar 2023 → present · Dijon', 'Full-stack developer'],
		energy: /for a major energy company/,
		internship: ['Sept → Dec 2021 · Doucier', 'Internship — web developer'],
		education: 'Education',
		// Un équivalent anglais, puis le nom d'origine.
		degrees: [
			'2022 — 2023 Application Designer & Developer, bachelor’s-level vocational qualification — Concepteur & développeur d’applications Access Code School, Besançon',
			'2020 — 2021 Web & Mobile Developer, foundation-degree-level vocational qualification — Développeur web & développeur mobile Access Code School, Besançon',
			'2018 — 2020 Applied Foreign Languages, university studies — Langues étrangères appliquées (LEA) UFR SLHS, Besançon',
			'2018 French baccalaureate, economics & social sciences, A-level equivalent — Baccalauréat économique et social Lycée Carnot, Dijon',
		],
	},
];

/** Texte des éléments masqués aux lecteurs d'écran (non imbriqués, comme `elements`). */
const hiddenTexts = (fragment) =>
	(fragment.match(/<(\w+)\b[^>]*\saria-hidden="true"[^>]*>[\s\S]*?<\/\1>/g) ?? []).map(text);

for (const version of VERSIONS) {
	const { locale, id } = version;
	const html = readHome(locale);
	const section = elements(html, 'section').find((s) => attr(tags(s, 'section')[0], 'id') === id) ?? '';
	const articles = elements(section, 'article');

	test(`${locale} : la section ${version.title} est la cible de l’ancre #${id} et porte son h2`, () => {
		assert.ok(section, `aucune <section id="${id}">`);
		const h2s = elements(section, 'h2');
		assert.equal(h2s.length, 1);
		assert.equal(text(h2s[0]), version.title);
	});

	test(`${locale} : l’en-tête numérote la section et résume le parcours`, () => {
		const content = text(section);
		assert.match(content, new RegExp(`^02\\s*${version.title}`));
		assert.ok(content.includes(version.summary), `« ${version.summary} » absent`);
	});

	test(`${locale} : trois étapes, chacune un <article> titré par l’entreprise en h3`, () => {
		assert.equal(articles.length, 3);
		assert.deepEqual(
			articles.map((a) => {
				const h3s = elements(a, 'h3');
				assert.equal(h3s.length, 1, 'un seul h3 par étape');
				return text(h3s[0]);
			}),
			['Da Viking Code', 'Conseil départemental olympique et sportif', 'Jordel Média'],
		);
	});

	test(`${locale} : chaque étape donne période, ville, rôle et missions en liste`, () => {
		const [current, , internship] = articles;
		for (const part of version.current) assert.ok(text(current).includes(part), `« ${part} » absent`);
		const missions = elements(elements(current, 'ul')[0] ?? '', 'li');
		assert.equal(missions.length, 5);
		// Le client du secteur de l'énergie reste anonyme.
		assert.match(text(missions[2]), version.energy);
		for (const part of version.internship) assert.ok(text(internship).includes(part), `« ${part} » absent`);
	});

	test(`${locale} : les années géantes et les tirets des missions sont ignorés des lecteurs d’écran`, () => {
		assert.deepEqual(hiddenTexts(articles[0]), ['2023', '—', '—', '—', '—', '—']);
		assert.deepEqual(hiddenTexts(articles[1]), ['2022', '—', '—', '—']);
		assert.deepEqual(hiddenTexts(articles[2]), ['2021', '—']);
	});

	test(`${locale} : ${version.education} : un h3 suivi d’une liste ordonnée de quatre lignes (dates, diplôme, établissement)`, () => {
		const after = section.split(new RegExp(`<h3\\b[^>]*>${version.education}</h3>`))[1];
		assert.ok(after, `aucun h3 « ${version.education} »`);
		assert.match(after, /^\s*<ol\b/, 'le h3 doit être suivi de la liste');
		assert.deepEqual(elements(elements(after, 'ol')[0], 'li').map(text), version.degrees);
	});
}

test('en : le nom d’origine des diplômes est marqué en français', () => {
	const section = elements(readHome('en'), 'section').find((s) => attr(tags(s, 'section')[0], 'id') === 'career') ?? '';
	const originals = tags(section, '[a-z]+').filter((t) => attr(t, 'lang') === 'fr');
	assert.equal(originals.length, 4);
});
