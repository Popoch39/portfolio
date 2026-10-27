// `pnpm perf` (spec #46, ticket #48) : la mesure Lighthouse elle-même est lente et reste hors de
// `pnpm test`. Seuls sont testés ici ce qu'elle lit dans le build et son verdict.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FICHE, HOME, PROJECTS, readDist } from './helpers/dist.mjs';
import { pagesOf, shortfalls } from '../scripts/perf.mjs';

const perfect = { performance: 100, accessibility: 100, 'best-practices': 100, seo: 100 };

test('les pages mesurées sont celles du sitemap du build : les deux accueils et les six fiches dans chaque langue', () => {
	assert.deepEqual(pagesOf(readDist('sitemap.xml')), [
		HOME.fr,
		HOME.en,
		...PROJECTS.flatMap(({ slug }) => [FICHE.fr(slug), FICHE.en(slug)]),
	]);
});

test('la mesure ne passe que si les quatre catégories sont à 100 sur toutes les pages', () => {
	assert.deepEqual(shortfalls([{ page: '/', scores: perfect }, { page: '/en/', scores: perfect }]), []);
});

test('chaque catégorie sous 100 est signalée avec sa page, une catégorie sans score comprise', () => {
	const results = [
		{ page: '/', scores: { ...perfect, performance: 98 } },
		{ page: '/projets/trekker/', scores: perfect },
		{ page: '/en/projects/trekker/', scores: { ...perfect, accessibility: 96, seo: null } },
	];
	assert.deepEqual(shortfalls(results), [
		{ page: '/', category: 'performance', score: 98 },
		{ page: '/en/projects/trekker/', category: 'accessibilité', score: 96 },
		{ page: '/en/projects/trekker/', category: 'SEO', score: null },
	]);
});
