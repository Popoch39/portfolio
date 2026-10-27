// `pnpm perf` (spec #46, ticket #48) : la mesure Lighthouse elle-même est lente et reste hors de
// `pnpm test`. Seuls sont testés ici ce qu'elle lit dans le build et son verdict.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FICHE, HOME, PROJECTS, readDist } from './helpers/dist.mjs';
import { pagesOf, shortfalls } from '../scripts/perf.mjs';

// Seuils (décision de Louis, spec #46) : 100 partout, sauf la performance des fiches, acceptée à 99.
const perfect ={ performance: 100, accessibility: 100, 'best-practices': 100, seo: 100 };

test('les pages mesurées sont celles du sitemap du build : les deux accueils et les six fiches dans chaque langue', () => {
	assert.deepEqual(pagesOf(readDist('sitemap.xml')), [
		HOME.fr,
		HOME.en,
		...PROJECTS.flatMap(({ slug }) => [FICHE.fr(slug), FICHE.en(slug)]),
	]);
});

test('la mesure passe avec les quatre catégories à 100 sur les accueils, et la performance à 99 sur les fiches', () => {
	const fiche = { ...perfect, performance: 99 };
	assert.deepEqual(
		shortfalls([
			{ page: '/', scores: perfect },
			{ page: '/en/', scores: perfect },
			{ page: '/projets/trekker/', scores: fiche },
			{ page: '/en/projects/une-fiche-ajoutee/', scores: fiche },
		]),
		[],
	);
});

test('chaque catégorie sous son seuil est signalée avec sa page et le seuil, une catégorie sans score comprise', () => {
	const results = [
		{ page: '/', scores: { ...perfect, performance: 99 } },
		{ page: '/en/', scores: perfect },
		{ page: '/projets/trekker/', scores: { ...perfect, performance: 98 } },
		{ page: '/en/projects/trekker/', scores: { ...perfect, performance: 99, accessibility: 99, seo: null } },
	];
	assert.deepEqual(shortfalls(results), [
		{ page: '/', category: 'performance', score: 99, floor: 100 },
		{ page: '/projets/trekker/', category: 'performance', score: 98, floor: 99 },
		{ page: '/en/projects/trekker/', category: 'accessibilité', score: 99, floor: 100 },
		{ page: '/en/projects/trekker/', category: 'SEO', score: null, floor: 100 },
	]);
});
