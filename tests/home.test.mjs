import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readHome, tags, attr, elements, text } from './helpers/dist.mjs';

const VERSIONS = [
	{ locale: 'fr', name: 'en français', h2s: ['Projets', 'Parcours', 'Activité', 'Stack'] },
	{ locale: 'en', name: 'en anglais', h2s: ['Projects', 'Career', 'Activity', 'Stack'] },
];

for (const { locale, name, h2s } of VERSIONS) {
	const html = readHome(locale);

	test(`la page est ${name}`, () => {
		const [htmlTag] = tags(html, 'html');
		assert.equal(attr(htmlTag, 'lang'), locale);
	});

	test(`${locale} : un seul h1, qui contient le nom`, () => {
		const h1s = elements(html, 'h1');
		assert.equal(h1s.length, 1);
		assert.match(text(h1s[0]), /Louis\s+Pocheron/i);
	});

	test(`${locale} : un h2 par section, dans l’ordre ${h2s.join(', ')}`, () => {
		assert.deepEqual(elements(html, 'h2').map(text), h2s);
	});
}
