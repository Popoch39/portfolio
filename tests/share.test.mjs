// Aperçu du lien partagé (LinkedIn, Slack, X…) : Open Graph et carte Twitter.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readDist, readHome, tags, attr, elements, text } from './helpers/dist.mjs';

const head = elements(readHome(), 'head')[0] ?? '';
const metas = tags(head, 'meta');
const og = (property) => attr(metas.find((t) => attr(t, 'property') === property) ?? '', 'content');
const named = (name) => attr(metas.find((t) => attr(t, 'name') === name) ?? '', 'content');
const canonical = attr(tags(head, 'link').find((t) => attr(t, 'rel') === 'canonical') ?? '', 'href');

test('Open Graph décrit un profil francophone, à l’URL canonique', () => {
	assert.equal(og('og:type'), 'profile');
	assert.equal(og('og:locale'), 'fr_FR');
	assert.equal(og('og:url'), canonical);
	assert.equal(text(og('og:title') ?? ''), text(elements(head, 'title')[0] ?? ''));
	assert.equal(og('og:description'), named('description'));
	assert.equal(og('profile:first_name'), 'Louis');
	assert.equal(og('profile:last_name'), 'Pocheron');
});

test('Open Graph référence une image 1200×630 absolue, avec texte alternatif', () => {
	const image = og('og:image');
	assert.ok(image && URL.canParse(image), `og:image absente ou non absolue : ${image}`);
	assert.equal(new URL(image).origin, new URL(canonical).origin);
	assert.equal(og('og:image:width'), '1200');
	assert.equal(og('og:image:height'), '630');
	assert.equal(og('og:image:type'), 'image/png');
	assert.match(og('og:image:alt') ?? '', /Louis Pocheron/);
});

test('l’image de partage est livrée par le site : un PNG de 1200×630', () => {
	const png = readDist(new URL(og('og:image')).pathname.slice(1), null);
	assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 'signature PNG absente');
	// Premier bloc IHDR : largeur puis hauteur, entiers 32 bits gros-boutistes.
	assert.equal(png.toString('latin1', 12, 16), 'IHDR');
	assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [1200, 630]);
});

test('carte Twitter en grand format', () => {
	assert.equal(named('twitter:card'), 'summary_large_image');
});
