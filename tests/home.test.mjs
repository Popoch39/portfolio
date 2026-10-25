import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readHome, tags, attr, elements, text } from './helpers/dist.mjs';

const html = readHome();

test('la page est en français', () => {
	const [htmlTag] = tags(html, 'html');
	assert.equal(attr(htmlTag, 'lang'), 'fr');
});

test('un seul h1, qui contient le nom', () => {
	const h1s = elements(html, 'h1');
	assert.equal(h1s.length, 1);
	assert.match(text(h1s[0]), /Louis\s+Pocheron/i);
});

test('un h2 par section, dans l’ordre Projets, Parcours, Activité, Stack', () => {
	assert.deepEqual(elements(html, 'h2').map(text), ['Projets', 'Parcours', 'Activité', 'Stack']);
});
