// Bandeau des technologies entre Projets et Parcours : décoratif, figé, chaque mot une seule fois.
// Il a quitté le dessous du héros pour que la Plongée relie le héros à Projets (spec #68).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readHome, tags, attr, elements, text } from './helpers/dist.mjs';

for (const { locale, projects, career } of [
	{ locale: 'fr', projects: 'projets', career: 'parcours' },
	{ locale: 'en', projects: 'projects', career: 'career' },
]) {
	const html = readHome(locale);
	const main = elements(html, 'main')[0] ?? '';

	test(`${locale} : le bandeau suit Projets, liste chaque technologie une fois et est ignoré des lecteurs d’écran`, () => {
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
		assert.ok(
			at(`id="${projects}"`) < at(bands[0]) && at(bands[0]) < at(`id="${career}"`),
			'bandeau hors de sa place, entre projets et parcours',
		);
	});
}
