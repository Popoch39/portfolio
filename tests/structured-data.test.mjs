// Données structurées schema.org : ce que Google comprend de Louis, dans chaque version.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readHome, tags, attr, elements } from './helpers/dist.mjs';

const VERSIONS = [
	{ locale: 'fr', jobTitle: /développeur d’applications/, skill: 'Conception d’API' },
	{ locale: 'en', jobTitle: /^Full-stack developer$/, skill: 'API design' },
];

const ldOf = (html) => elements(html, 'script').filter((s) => attr(tags(s, 'script')[0], 'type') === 'application/ld+json');
const personOf = (html) => JSON.parse((ldOf(html)[0] ?? '<script>{}</script>').replace(/^<script\b[^>]*>|<\/script>$/g, ''));

for (const { locale, jobTitle, skill } of VERSIONS) {
	const html = readHome(locale);
	const head = elements(html, 'head')[0] ?? '';
	const scripts = ldOf(html);
	const canonical = attr(tags(head, 'link').find((t) => attr(t, 'rel') === 'canonical') ?? '', 'href');
	const ogImage = attr(tags(head, 'meta').find((t) => attr(t, 'property') === 'og:image') ?? '', 'content');

	test(`${locale} : un seul bloc JSON-LD, dans le <head>, qui parse`, () => {
		assert.equal(scripts.length, 1);
		assert.ok(head.includes(scripts[0]), 'JSON-LD hors du <head>');
		assert.doesNotThrow(() => JSON.parse(scripts[0].replace(/^<script\b[^>]*>|<\/script>$/g, '')));
	});

	const person = personOf(html);

	test(`${locale} : une Person schema.org : nom, poste, employeur, ville`, () => {
		assert.equal(person['@context'], 'https://schema.org');
		assert.equal(person['@type'], 'Person');
		assert.equal(person.name, 'Louis Pocheron');
		assert.equal(person.givenName, 'Louis');
		assert.equal(person.familyName, 'Pocheron');
		assert.match(person.jobTitle ?? '', jobTitle);
		assert.deepEqual(person.worksFor, { '@type': 'Organization', name: 'Da Viking Code' });
		assert.match(JSON.stringify(person.homeLocation ?? {}), /Besançon/);
	});

	test(`${locale} : la Person pointe vers le site, l’image de partage, l’email et GitHub`, () => {
		assert.equal(person.url, canonical);
		assert.equal(person.image, ogImage);
		assert.equal(person.email, 'mailto:pocheron.louis@gmail.com');
		assert.ok(person.sameAs?.includes('https://github.com/Popoch39'), 'GitHub absent de sameAs');
	});

	test(`${locale} : la Person liste des compétences, dans la langue de la page`, () => {
		assert.ok(Array.isArray(person.knowsAbout) && person.knowsAbout.length >= 5);
		for (const known of ['TypeScript', 'PHP', 'Rust', skill]) assert.ok(person.knowsAbout.includes(known), `${known} absent`);
	});

	test(`${locale} : les compétences de la stack suivent l’ordre de la section Stack (planche 34)`, () => {
		assert.deepEqual(person.knowsAbout.slice(person.knowsAbout.indexOf('TypeScript')), [
			...['TypeScript', 'Rust', 'PHP', 'SQL', 'Go', 'Lua'],
			...['PostgreSQL', 'Redis', 'Prisma', 'Drizzle'],
			...['NestJS', 'Laravel', 'Axum', 'Elysia', 'Node', 'GraphQL', 'REST'],
			...['React', 'Next.js', 'Vue', 'Vite', 'Tailwind'],
			...['OpenLayers', 'MapLibre GL', 'PostGIS', 'Three.js'],
			...['Docker', 'CI/CD', 'Cloudflare', 'AWS', 'Sentry'],
			...['Bun', 'Monorepo', 'Git', 'Neovim', 'tmux', 'Agile/Scrum'],
		]);
	});

	test(`${locale} : aucune donnée personnelle sensible : ni téléphone, ni adresse, ni date de naissance`, () => {
		const json = JSON.stringify(person);
		for (const key of ['telephone', 'address', 'streetAddress', 'postalCode', 'birthDate', 'birthPlace']) {
			assert.ok(!json.includes(`"${key}"`), `clé ${key} présente`);
		}
	});
}

test('les deux versions décrivent la même Person : un @id absolu commun', () => {
	const [fr, en] = ['fr', 'en'].map((locale) => personOf(readHome(locale)));
	assert.ok(URL.canParse(fr['@id'] ?? ''), `@id absent ou non absolu : ${fr['@id']}`);
	assert.equal(en['@id'], fr['@id']);
});
