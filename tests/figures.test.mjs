// SVG au repos : un fichier autonome par projet (styles embarqués), qui servira l'aperçu sans
// JavaScript, la base de l'aperçu vivant et la capture de l'image de partage.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROJECTS, readDist, readFiche, readHome, tags, attr, hasAttr, css } from './helpers/dist.mjs';

const figures = PROJECTS.map((project) => ({ ...project, svg: readDist(`figures/${project.slug}.svg`) }));
const hooks = (markup) => new Set(tags(markup, 'g').filter((g) => hasAttr(g, 'data-piece')).map((g) => attr(g, 'data-piece')));

test('un SVG par projet, en racine, avec role="img" et un libellé', () => {
	for (const { slug, svg } of figures) {
		const [root] = tags(svg, 'svg');
		assert.ok(svg.trimStart().startsWith('<svg'), `${slug} : le fichier commence par <svg>`);
		assert.equal(attr(root, 'xmlns'), 'http://www.w3.org/2000/svg', slug);
		assert.match(attr(root, 'viewBox') ?? '', /^0 0 \d+(\.\d+)? \d+(\.\d+)?$/, slug);
		assert.equal(attr(root, 'role'), 'img', slug);
		assert.ok((attr(root, 'aria-label') ?? '').length > 30, `${slug} : libellé absent`);
	}
});

test('chaque SVG est autonome : ses styles embarqués, palette comprise, et aucune ressource externe', () => {
	for (const { slug, svg } of figures) {
		const styles = css(svg);
		assert.match(styles, /\.iso-fill\s*{/, `${slug} : CSS du kit absente`);
		assert.match(styles, /#2433ff/i, `${slug} : palette des figures absente`);
		assert.doesNotMatch(svg, /\s(?:xlink:)?href="(?!#)/, `${slug} : ressource externe`);
		assert.doesNotMatch(svg, /@import|url\((?!#)/, `${slug} : ressource externe dans la CSS`);
	}
});

test('chaque SVG est du XML bien formé : aucun `<` dans ses styles hors d’une section CDATA', () => {
	// Un `<` dans la CSS (`syntax: '<number>'`) ouvrirait une balise : l'image ne s'afficherait plus.
	for (const { slug, svg } of figures) {
		const outsideCdata = css(svg).replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '');
		assert.doesNotMatch(outsideCdata, /</, `${slug} : « < » hors CDATA dans un <style>`);
	}
});

test('les trames du grain : dans chaque SVG autonome, et une seule fois par page qui montre une figure', () => {
	const ids = ['top', '3', '2', '1', '0'].map((shade) => `anatomy-grain-${shade}`);
	for (const { slug, svg } of figures) {
		for (const id of ids) assert.match(svg, new RegExp(`<pattern id="${id}"`), `${slug} : trame ${id} absente`);
	}
	const pages = [{ name: 'accueil', html: readHome() }, ...PROJECTS.map(({ slug }) => ({ name: `fiche ${slug}`, html: readFiche(slug) }))];
	for (const { name, html } of pages) {
		for (const id of ids) assert.equal(html.match(new RegExp(`\\sid="${id}"`, 'g'))?.length ?? 0, 1, `${name} : trame ${id}`);
	}
});

test('le SVG autonome montre les mêmes pièces que la figure de la fiche', () => {
	for (const { slug, svg } of figures) {
		const fiche = readFiche(slug);
		assert.ok(hooks(svg).size > 0, `${slug} : aucun crochet de pièce`);
		assert.deepEqual([...hooks(svg)].sort(), [...hooks(fiche)].sort(), slug);
	}
});
