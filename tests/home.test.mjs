import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readHome, tags, attr, elements, text } from './helpers/dist.mjs';

const VERSIONS = [
	{
		locale: 'fr',
		name: 'en français',
		h2s: ['Projets', 'Parcours', 'Activité', 'Stack'],
		ids: ['projets', 'parcours', 'activite', 'stack'],
	},
	{
		locale: 'en',
		name: 'en anglais',
		h2s: ['Projects', 'Career', 'Activity', 'Stack'],
		ids: ['projects', 'career', 'activity', 'stack'],
	},
];

for (const { locale, name, h2s, ids } of VERSIONS) {
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

	// Le héros arrive juste au-dessus de Projets, là où la Plongée les relie ; le bandeau passe après.
	test(`${locale} : la page enchaîne héros, ${h2s[0]}, bandeau, puis ${h2s.slice(1).join(', ')}`, () => {
		const main = elements(html, 'main')[0] ?? '';
		const [band] = elements(main, 'ul').filter((ul) => attr(tags(ul, 'ul')[0], 'aria-hidden') === 'true');
		assert.ok(band, 'bandeau absent de l’accueil');
		const [projects, ...rest] = ids.map((id) => main.indexOf(`id="${id}"`));
		const order = [main.indexOf('</h1>'), projects, main.indexOf(band), ...rest];
		assert.ok(order.every((at) => at >= 0), 'un repère manque dans <main>');
		assert.deepEqual(order, order.toSorted((a, b) => a - b));
	});
}
