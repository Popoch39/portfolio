// La view transition entre l'accueil et une fiche (maquette 5 · Lettre à lettre, ADR 0004) : chaque
// lettre du nom du projet passe de la ligne de l'accueil au titre de la fiche, et retour.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FICHE, HOME, PROJECTS, attr, css, elements, hasAttr, headOf, readFiche, readHome, tags, text, withoutBlocks } from './helpers/dist.mjs';

const LOCALES = ['fr', 'en'];
const longest = Math.max(...PROJECTS.map(({ repo }) => repo.length));

/** Les éléments qui portent `data-word`, avec leur cible et leur texte. */
const words = (html) =>
	[...html.matchAll(/<(\w+)\b[^>]*\sdata-word="([^"]*)"[^>]*>([\s\S]*?)<\/\1>/g)].map(([, , target, inner]) => ({ target, text: text(inner) }));

const pages = LOCALES.flatMap((locale) => [
	{ name: `accueil ${locale}`, html: readHome(locale) },
	...PROJECTS.map(({ slug }) => ({ name: `fiche ${locale} ${slug}`, html: readFiche(slug, locale) })),
]);

test('chaque page s’inscrit aux view transitions entre documents, sauf mouvement réduit', () => {
	for (const { name, html } of pages) {
		assert.match(css(html), /@media \(prefers-reduced-motion:\s*no-preference\)\s*\{\s*@view-transition\s*\{\s*navigation:\s*auto;?\s*\}/, name);
	}
});

test('en mouvement réduit, rien de la transition ne s’anime : ses animations vivent sous la requête', () => {
	for (const { name, html } of pages) {
		const outside = withoutBlocks(css(html), /@media \(prefers-reduced-motion:\s*no-preference\)/);
		assert.doesNotMatch(outside, /@keyframes\s+vt-/, `${name} : @keyframes vt- hors de la requête`);
		// Seuls les délais par rang restent dehors : sans transition, ils ne s'appliquent à rien.
		const animated = [...outside.matchAll(/(::view-transition-[^{}]+)\{([^{}]*)\}/g)].filter(([, , body]) => /\banimation(?!-delay)/.test(body));
		assert.deepEqual(
			animated.map(([, selector]) => selector),
			[],
			`${name} : animation de la transition hors de la requête`,
		);
	}
});

test('un délai par rang de lettre, du premier au curseur qui suit le nom le plus long', () => {
	for (const { name, html } of pages) {
		const styles = css(html);
		for (let i = 0; i <= longest; i++) {
			assert.match(styles, new RegExp(`::view-transition-group\\(letter-${i}\\)\\s*\\{\\s*animation-delay:\\s*${i * 28}ms`), `${name} : lettre ${i}`);
		}
	}
});

test('le script de la transition : en ligne dans le <head>, classique, à l’écoute de pageswap et pagereveal', () => {
	for (const { name, html } of pages) {
		const inline = elements(headOf(html), 'script').filter((s) => !attr(tags(s, 'script')[0], 'type') && !attr(tags(s, 'script')[0], 'src'));
		assert.equal(inline.length, 1, name);
		assert.match(inline[0], /pageswap/, name);
		assert.match(inline[0], /pagereveal/, name);
		assert.ok(inline[0].length < 1500, `${name} : ${inline[0].length} o`);
	}
});

for (const locale of LOCALES) {
	const home = readHome(locale);

	test(`${locale} : sur l'accueil, le nom de chaque ligne mène à sa fiche, lettre à lettre`, () => {
		assert.deepEqual(
			words(home),
			PROJECTS.map(({ slug, repo }) => ({ target: FICHE[locale](slug), text: repo })),
		);
	});

	test(`${locale} : l'accueil attend la liste des projets avant son premier rendu`, () => {
		const expects = tags(headOf(home), 'link').filter((t) => attr(t, 'rel') === 'expect');
		assert.equal(expects.length, 1);
		assert.equal(attr(expects[0], 'blocking'), 'render');
		const id = attr(expects[0], 'href')?.slice(1);
		const at = home.search(new RegExp(`\\sid="${id}"`));
		assert.ok(at > 0, `#${id} absent`);
		// La cible suit la dernière ligne : à son analyse, toutes les lignes existent.
		assert.ok(at > home.lastIndexOf('data-word='), `#${id} précède une ligne`);
	});

	test(`${locale} : sur chaque fiche, le titre mène à l'accueil, lettre à lettre, et son curseur suit`, () => {
		for (const { slug, repo } of PROJECTS) {
			const [h1] = elements(readFiche(slug, locale), 'h1');
			assert.deepEqual(words(h1), [{ target: HOME[locale], text: repo }], slug);
			assert.ok(tags(h1, 'span').some((t) => hasAttr(t, 'data-word-cursor')), `${slug} : curseur`);
		}
	});
}
