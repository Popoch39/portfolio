import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readHome, tags, attr, elements, text } from './helpers/dist.mjs';

const html = readHome();
const head = elements(html, 'head')[0] ?? '';

const meta = (name) => tags(head, 'meta').find((t) => attr(t, 'name') === name);

test('le titre nomme Louis, son métier et sa ville', () => {
	const [title] = elements(head, 'title');
	assert.ok(title, 'balise <title> absente');
	assert.match(text(title), /Louis Pocheron/);
	assert.match(text(title), /fullstack/i);
	assert.match(text(title), /Besançon/);
});

test('une meta description non vide', () => {
	const description = attr(meta('description') ?? '', 'content');
	assert.ok(description && description.length > 50, 'meta description absente ou trop courte');
});

test('une URL canonique absolue', () => {
	const canonicals = tags(head, 'link').filter((t) => attr(t, 'rel') === 'canonical');
	assert.equal(canonicals.length, 1);
	const href = attr(canonicals[0], 'href');
	assert.ok(URL.canParse(href), `canonique non absolue : ${href}`);
	assert.equal(new URL(href).pathname, '/');
});

test('une couleur de thème', () => {
	assert.match(attr(meta('theme-color') ?? '', 'content') ?? '', /^#[0-9a-f]{6}$/i);
});
