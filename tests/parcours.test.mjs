// Section 02 · Parcours : la Frise, ses 13 Commits en git log vertical, dans les deux versions (#99).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readHome, tags, attr, elements, elementAt, text } from './helpers/dist.mjs';

/** Branche, genre et position de chaque Commit, communs aux deux versions (planche D). */
const SHAPE = [
	['main', 'init', '2018.45'],
	['lea', 'branch', '2018.75'],
	['main', 'merge', '2020.55'],
	['access-code', 'branch', '2020.8'],
	['access-code', 'commit', '2021.68'],
	['main', 'merge', '2022.1'],
	['cda', 'branch', '2022.35'],
	['main', 'merge', '2023.2'],
	['main', 'commit', '2023.85'],
	['main', 'commit', '2024.5'],
	['main', 'commit', '2025.15'],
	['main', 'commit', '2025.8'],
	['main', 'head', '2026.45'],
];

const VERSIONS = [
	{
		locale: 'fr',
		id: 'parcours',
		title: 'Parcours',
		summary: '~4 ans · santé, énergie, sport',
		// [date, titre, lieu, nombre de missions]
		commits: [
			['2018', 'Baccalauréat ES', 'Lycée Carnot, Dijon', 0],
			['2018 → 2020', 'Langues étrangères appliquées', 'UFR SLHS, Besançon', 0],
			['2020', 'Cap sur le code', 'Besançon', 0],
			['2020 → 2021', 'Développeur web & mobile', 'Access Code School, Besançon', 0],
			['sept. → déc. 2021', 'Stage — Jordel Média', 'Doucier · CMS interne', 1],
			['fév. 2022', 'CDOS', 'Dijon · Symfony, React Native, Express', 3],
			['2022 → 2023', 'Concepteur & développeur d’applications', 'Access Code School, Besançon', 0],
			['mars 2023', 'Da Viking Code', 'Dijon', 1],
			['Da Viking Code', 'Back-office santé', 'NestJS, Prisma, PostgreSQL, GraphQL, React 19', 1],
			['Da Viking Code', 'Micro-services Rust', 'Axum — tuiles, CAD, nuages de points', 1],
			['Da Viking Code', 'Cartographie énergie', 'Laravel 12, React 19', 1],
			['Da Viking Code', 'Terrain hors-ligne', 'React Native', 1],
			['aujourd’hui', 'La suite', 'Dijon', 0],
		],
		missions: {
			4: ['Nouvelles fonctionnalités sur le CMS interne de l’entreprise'],
			5: ['Application web sous Symfony', 'Application mobile React Native', 'API back-end en Node.js / TypeScript (Express)'],
			7: ['Monorepos, Docker, CI/CD, Cloudflare Workers, authentification'],
			10: ['Applications cartographiques pour un grand acteur de l’énergie — Laravel 12, React 19'],
		},
	},
	{
		locale: 'en',
		id: 'career',
		title: 'Career',
		summary: '~4 years · healthcare, energy, sport',
		commits: [
			['2018', 'French baccalaureate (ES)', 'Lycée Carnot, Dijon', 0],
			['2018 → 2020', 'Applied Foreign Languages', 'UFR SLHS, Besançon', 0],
			['2020', 'Turning to code', 'Besançon', 0],
			['2020 → 2021', 'Web & mobile developer', 'Access Code School, Besançon', 0],
			['Sept → Dec 2021', 'Internship — Jordel Média', 'Doucier · in-house CMS', 1],
			['Feb 2022', 'CDOS', 'Dijon · Symfony, React Native, Express', 3],
			['2022 → 2023', 'Application designer & developer', 'Access Code School, Besançon', 0],
			['Mar 2023', 'Da Viking Code', 'Dijon', 1],
			['Da Viking Code', 'Healthcare back office', 'NestJS, Prisma, PostgreSQL, GraphQL, React 19', 1],
			['Da Viking Code', 'Rust microservices', 'Axum — tiles, CAD, point clouds', 1],
			['Da Viking Code', 'Energy mapping', 'Laravel 12, React 19', 1],
			['Da Viking Code', 'Offline in the field', 'React Native', 1],
			['today', 'What’s next', 'Dijon', 0],
		],
		missions: {
			4: ['New features for the company’s in-house CMS'],
			5: ['Web application built with Symfony', 'React Native mobile app', 'Back-end API in Node.js / TypeScript (Express)'],
			7: ['Monorepos, Docker, CI/CD, Cloudflare Workers, authentication'],
			10: ['Mapping applications for a major energy company — Laravel 12, React 19'],
		},
	},
];

for (const version of VERSIONS) {
	const { locale, id } = version;
	const html = readHome(locale);
	const section = elementAt(html, html.indexOf(`<section id="${id}"`)) ?? '';
	const lists = elements(section, 'ol');
	// Les missions sont des <ul> imbriquées : on découpe la liste ordonnée à ses <li> de premier niveau.
	const commits = (lists[0] ?? '').split(/(?=<li\b[^>]*\sdata-kind=)/).slice(1);

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

	test(`${locale} : une seule liste ordonnée porte les 13 Commits, dans l’ordre de la Frise`, () => {
		assert.equal(lists.length, 1);
		assert.equal(commits.length, 13);
		assert.deepEqual(
			commits.map((c) => text(elements(c, 'h3')[0] ?? '')),
			version.commits.map(([, title]) => title),
		);
	});

	test(`${locale} : chaque Commit porte sa Branche, son genre et sa position`, () => {
		assert.deepEqual(
			commits.map((c) => {
				const tag = tags(c, 'li')[0];
				return [attr(tag, 'data-branch'), attr(tag, 'data-kind'), attr(tag, 'data-at')];
			}),
			SHAPE,
		);
	});

	test(`${locale} : chaque Commit donne sa date, son titre, son lieu et ses missions`, () => {
		commits.forEach((c, i) => {
			const [date, , place, missionCount] = version.commits[i];
			const content = text(c);
			assert.ok(content.includes(date), `Commit ${i + 1} : date « ${date} » absente`);
			assert.ok(content.includes(place), `Commit ${i + 1} : lieu « ${place} » absent`);
			const missions = elements(elements(c, 'ul')[0] ?? '', 'li').map(text);
			assert.equal(missions.length, missionCount, `Commit ${i + 1} : missions`);
			for (const mission of version.missions[i] ?? []) assert.ok(missions.includes(mission), `« ${mission} » absente`);
		});
	});

	test(`${locale} : le git log vertical est en HTML et CSS seuls`, () => {
		assert.equal(tags(section, 'script').length, 0);
	});
}
