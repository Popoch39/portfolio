// Données structurées schema.org : ce que Google comprend de Louis.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readHome, tags, attr, elements } from './helpers/dist.mjs';

const html = readHome();
const head = elements(html, 'head')[0] ?? '';
const scripts = elements(html, 'script').filter((s) => attr(tags(s, 'script')[0], 'type') === 'application/ld+json');
const canonical = attr(tags(head, 'link').find((t) => attr(t, 'rel') === 'canonical') ?? '', 'href');
const ogImage = attr(tags(head, 'meta').find((t) => attr(t, 'property') === 'og:image') ?? '', 'content');

test('un seul bloc JSON-LD, dans le <head>, qui parse', () => {
	assert.equal(scripts.length, 1);
	assert.ok(head.includes(scripts[0]), 'JSON-LD hors du <head>');
	assert.doesNotThrow(() => JSON.parse(scripts[0].replace(/^<script\b[^>]*>|<\/script>$/g, '')));
});

const person = JSON.parse((scripts[0] ?? '<script>{}</script>').replace(/^<script\b[^>]*>|<\/script>$/g, ''));

test('une Person schema.org : nom, poste, employeur, ville', () => {
	assert.equal(person['@context'], 'https://schema.org');
	assert.equal(person['@type'], 'Person');
	assert.equal(person.name, 'Louis Pocheron');
	assert.equal(person.givenName, 'Louis');
	assert.equal(person.familyName, 'Pocheron');
	assert.match(person.jobTitle ?? '', /développeur d’applications/);
	assert.deepEqual(person.worksFor, { '@type': 'Organization', name: 'Da Viking Code' });
	assert.match(JSON.stringify(person.homeLocation ?? {}), /Besançon/);
});

test('la Person pointe vers le site, l’image de partage, l’email et GitHub', () => {
	assert.equal(person.url, canonical);
	assert.equal(person.image, ogImage);
	assert.equal(person.email, 'mailto:pocheron.louis@gmail.com');
	assert.ok(person.sameAs?.includes('https://github.com/Popoch39'), 'GitHub absent de sameAs');
});

test('la Person liste des compétences', () => {
	assert.ok(Array.isArray(person.knowsAbout) && person.knowsAbout.length >= 5);
	for (const skill of ['TypeScript', 'PHP', 'Rust']) assert.ok(person.knowsAbout.includes(skill), `${skill} absent`);
});

test('aucune donnée personnelle sensible : ni téléphone, ni adresse, ni date de naissance', () => {
	const json = JSON.stringify(person);
	for (const key of ['telephone', 'address', 'streetAddress', 'postalCode', 'birthDate', 'birthPlace']) {
		assert.ok(!json.includes(`"${key}"`), `clé ${key} présente`);
	}
});
