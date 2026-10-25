// Favicon : le bloc curseur bleu du héros, en SVG, avec un .ico pour les navigateurs
// et les outils qui ne lisent pas le SVG (ils demandent /favicon.ico d'office).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readDist, readHome, tags, attr, elements } from './helpers/dist.mjs';

const head = elements(readHome(), 'head')[0] ?? '';
const icons = tags(head, 'link').filter((t) => attr(t, 'rel') === 'icon');

test('le <head> déclare le favicon SVG et le .ico de secours', () => {
	const svg = icons.find((t) => attr(t, 'type') === 'image/svg+xml');
	assert.ok(svg, 'favicon SVG non déclaré');
	assert.equal(attr(svg, 'href'), '/favicon.svg');
	const ico = icons.find((t) => attr(t, 'href') === '/favicon.ico');
	assert.ok(ico, 'favicon .ico non déclaré');
	// Sans `sizes`, Chrome préfère le .ico au SVG.
	assert.equal(attr(ico, 'sizes'), '32x32');
});

test('le favicon SVG dessine le bloc curseur bleu', () => {
	const svg = readDist('favicon.svg');
	assert.match(svg, /^<svg\b[^>]*xmlns="http:\/\/www.w3.org\/2000\/svg"/);
	assert.match(svg, /fill="#2433ff"/i);
});

test('favicon.ico est une icône Windows valide en 16, 32 et 48 px', () => {
	const ico = readDist('favicon.ico', null);
	// En-tête ICONDIR : réservé 0, type 1 (icône), nombre d'images.
	assert.deepEqual([ico.readUInt16LE(0), ico.readUInt16LE(2)], [0, 1]);
	const count = ico.readUInt16LE(4);
	const sizes = [];
	for (let i = 0; i < count; i++) {
		const entry = 6 + i * 16;
		const size = ico.readUInt32LE(entry + 8);
		const offset = ico.readUInt32LE(entry + 12);
		assert.ok(offset + size <= ico.length, `image ${i} hors du fichier`);
		sizes.push(ico[entry] || 256);
	}
	assert.deepEqual(sizes.sort((a, b) => a - b), [16, 32, 48]);
});
