import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HOME, readHome, tags, attr, elements, text } from './helpers/dist.mjs';

const VERSIONS = [
	{ locale: 'fr', title: [/Louis Pocheron/, /fullstack/i, /Besançon/], remote: /Ouvert au remote/ },
	{ locale: 'en', title: [/Louis Pocheron/, /Full-stack developer/, /France/], remote: /Open to remote/ },
];

for (const { locale, title: expected, remote } of VERSIONS) {
	const head = elements(readHome(locale), 'head')[0] ?? '';
	const meta = (name) => tags(head, 'meta').find((t) => attr(t, 'name') === name);

	test(`${locale} : le titre nomme Louis, son métier et sa ville`, () => {
		const [title] = elements(head, 'title');
		assert.ok(title, 'balise <title> absente');
		for (const pattern of expected) assert.match(text(title), pattern);
	});

	test(`${locale} : une meta description, qui dit l’ouverture au remote`, () => {
		const description = attr(meta('description') ?? '', 'content');
		assert.ok(description && description.length > 50, 'meta description absente ou trop courte');
		assert.match(description, remote);
	});

	test(`${locale} : une URL canonique absolue`, () => {
		const canonicals = tags(head, 'link').filter((t) => attr(t, 'rel') === 'canonical');
		assert.equal(canonicals.length, 1);
		const href = attr(canonicals[0], 'href');
		assert.ok(URL.canParse(href), `canonique non absolue : ${href}`);
		assert.equal(new URL(href).pathname, HOME[locale]);
	});

	test(`${locale} : une couleur de thème`, () => {
		assert.match(attr(meta('theme-color') ?? '', 'content') ?? '', /^#[0-9a-f]{6}$/i);
	});
}

test('les deux versions ont chacune leur titre et leur description', () => {
	const [fr, en] = ['fr', 'en'].map((locale) => elements(readHome(locale), 'head')[0] ?? '');
	assert.notEqual(text(elements(fr, 'title')[0]), text(elements(en, 'title')[0]));
	const description = (head) => attr(tags(head, 'meta').find((t) => attr(t, 'name') === 'description') ?? '', 'content');
	assert.notEqual(description(fr), description(en));
});
