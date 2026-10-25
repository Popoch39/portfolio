// Bandeau des technologies sous le héros : décoratif, figé, chaque mot une seule fois.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readHome, tags, attr, elements, text } from './helpers/dist.mjs';

const html = readHome();
const main = elements(html, 'main')[0] ?? '';

test('le bandeau suit le héros, liste chaque technologie une fois et est ignoré des lecteurs d’écran', () => {
	const bands = elements(main, 'ul').filter((ul) => attr(tags(ul, 'ul')[0], 'aria-hidden') === 'true');
	assert.equal(bands.length, 1, 'un seul bandeau masqué aux lecteurs d’écran');
	assert.deepEqual(elements(bands[0], 'li').map(text), [
		'TypeScript',
		'React',
		'Node',
		'Rust',
		'Neovim',
		'NestJS',
		'Laravel',
		'Bun',
		'Axum',
		'Elysia',
		'Next.js',
		'PostgreSQL',
		'Lua',
		'Go',
	]);
	const at = (fragment) => main.indexOf(fragment);
	assert.ok(at('</h1>') < at(bands[0]) && at(bands[0]) < at('id="projets"'), 'bandeau hors de sa place, entre héros et projets');
});
