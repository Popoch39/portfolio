// La Plongée (spec #68, ADR 0009) : sur l'accueil, la page s'arrête au défilement, le curseur du nom
// grandit jusqu'à remplir l'écran, puis se range dans le carré de « 01 Projets ». Le mouvement se
// vérifie à la main ; ici, ce que la page livre : la scène, et une CSS qui ne joue qu'en mouvement non
// réduit, dans un navigateur qui sait la jouer, sur le compositeur.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROJECTS, attr, blocks, css, elementAt, readFiche, readHome, tags, text, withoutBlocks } from './helpers/dist.mjs';

const MOTION = /@media \(prefers-reduced-motion:\s*no-preference\)/;
const SUPPORTED = /@supports [^{]*\(animation-timeline:\s*view\(\)\)/;
/** Ce qui appartient à la scène jouée : ses animations, sa ligne de temps, ses propriétés. */
const PLAYED = /@keyframes\s+dive-|\banimation[\w-]*\s*:[^;{}]*\bdive-|\b(?:animation-timeline|animation-range|view-timeline|timeline-scope)\s*:|--dive\b/;
/** Les seules propriétés que le compositeur anime seul. */
const COMPOSITED = new Set(['transform', 'translate', 'scale', 'opacity']);

/**
 * Les animations `dive-` de chaque règle, avec leur plage sur la scène en pourcentage `[début, fin]` :
 * la n-ième plage de `animation-range` va à la n-ième animation du raccourci (la liste se répète
 * si elle est plus courte), et le minifieur
 * écrit `contain 0%` sans son pourcentage.
 */
const animations = (styles) =>
	[...styles.matchAll(/([^{}]+)\{([^{}]*\banimation\s*:[^;{}]*\bdive-[^{}]*)\}/g)].map(([, selector, body]) => {
		const names = body.match(/\banimation\s*:([^;}]*)/)[1].split(',').map((one) => one.match(/\bdive-[\w-]+/)?.[0]);
		const ranges = (body.match(/\banimation-range\s*:([^;}]*)/)?.[1] ?? '').split(',').map((one) => {
			const m = one.trim().match(/^contain(?:\s+([\d.]+)%)?\s+contain\s+([\d.]+)%$/);
			return m ? [Number(m[1] ?? 0), Number(m[2])] : [0, 100];
		});
		return { selector, played: names.map((name, i) => ({ name, range: ranges[i % ranges.length] })).filter(({ name }) => name) };
	});

/** L'élément de la scène : celui qui s'épingle, l'en-tête et le héros dedans. */
const sceneOf = (html) => elementAt(html, html.search(/<div class="dive-scene\b/));

for (const { locale, projects } of [
	{ locale: 'fr', projects: 'projets' },
	{ locale: 'en', projects: 'projects' },
]) {
	const html = readHome(locale);
	const styles = css(html);

	test(`${locale} : la scène contient l’en-tête du site et le héros, et Projets la suit dans le flux`, () => {
		const scene = sceneOf(html);
		assert.ok(scene, 'scène absente');
		assert.match(scene, /<header\b/, 'en-tête hors de la scène');
		assert.match(scene, /<h1\b/, 'héros hors de la scène');
		assert.doesNotMatch(scene, new RegExp(`id="${projects}"`), 'Projets dans la scène');
		assert.ok(html.indexOf(scene) + scene.length < html.indexOf(`id="${projects}"`), 'Projets avant la scène');
	});

	test(`${locale} : le bleu qui couvre l’écran est décoratif`, () => {
		const scene = sceneOf(html) ?? '';
		const blue = tags(scene, 'div').find((tag) => /\bclass="dive-blue\b/.test(tag));
		assert.ok(blue, 'bleu absent de la scène');
		assert.equal(attr(blue, 'aria-hidden'), 'true');
		assert.equal(text(elementAt(scene, scene.indexOf(blue))), '');
	});

	test(`${locale} : la Plongée ne joue qu’en mouvement non réduit, dans un navigateur qui sait la jouer`, () => {
		assert.match(styles, PLAYED, 'CSS de la Plongée absente');
		for (const [condition, outside] of [
			['mouvement non réduit', withoutBlocks(styles, MOTION)],
			['@supports (animation-timeline: view())', withoutBlocks(styles, SUPPORTED)],
		]) {
			assert.doesNotMatch(outside, PLAYED, `Plongée hors de ${condition}`);
			// Sans la scène, ses éléments propres ne font que se cacher : ni épinglage, ni place réservée.
			const rules = [...outside.matchAll(/([^{}]*\.dive[\w-]*[^{}]*)\{([^{}]*)\}/g)];
			for (const [, selector, body] of rules) assert.equal(body, 'display:none', `${selector.trim()} hors de ${condition}`);
		}
	});

	test(`${locale} : les @keyframes de la Plongée n’animent que des propriétés composées, sauf une bascule de visibility à part`, () => {
		const keyframes = blocks(styles, /@keyframes\s+dive-[\w-]+/);
		assert.ok(keyframes.length > 0, 'aucune @keyframes dive-');
		for (const block of keyframes) {
			const name = block.match(/@keyframes\s+([\w-]+)/)[1];
			const properties = new Set([...block.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]).filter((p) => p !== 'animation-timing-function'));
			// Mêlée à une propriété composée, `visibility` ferait jouer toute l'animation par le thread principal.
			if (properties.has('visibility')) assert.deepEqual([...properties], ['visibility'], name);
			else assert.deepEqual([...properties].filter((p) => !COMPOSITED.has(p)), [], name);
		}
	});

	test(`${locale} : le héros couvert par le bleu passe en visibility: hidden, hors de la tabulation`, () => {
		const hiding = blocks(styles, /@keyframes\s+dive-[\w-]+/)
			.filter((block) => /visibility:\s*hidden/.test(block))
			.map((block) => block.match(/@keyframes\s+([\w-]+)/)[1]);
		assert.ok(hiding.length > 0, 'aucune @keyframes ne cache le héros');
		const users = [...styles.matchAll(/([^{}]+)\{[^{}]*\banimation(?:-name)?\s*:([^;{}]*)/g)].filter(([, , list]) => hiding.some((name) => list.includes(name)));
		assert.ok(users.some(([, selector]) => /\.dive-hero\b/.test(selector)), 'le héros n’est jamais caché');
	});

	// Plus haut que l'écran (téléphone, portable de moins de ~1 000 px de haut), le héros remonte d'abord
	// jusqu'à montrer son bas : d'après sa propre hauteur et le plus petit écran, sans script, et jamais
	// vers le bas, si bien qu'un héros qui tient ne bouge pas.
	test(`${locale} : le héros plus haut que l’écran remonte jusqu’à son bas avant que le texte ne s’efface`, () => {
		const keyframes = new Map(blocks(styles, /@keyframes\s+dive-[\w-]+/).map((block) => [block.match(/@keyframes\s+([\w-]+)/)[1], block]));
		const rising = [...keyframes].filter(([, block]) => /\btranslate:\s*0(?:px)?\s+min\(0(?:px)?,[^;}]*\b100svh\b[^;}]*\b100%/.test(block)).map(([name]) => name);
		assert.ok(rising.length > 0, 'aucune @keyframes ne remonte le héros d’après sa hauteur');
		const rules = animations(styles).filter(({ selector }) => /\.dive-hero\b/.test(selector));
		const rise = rules.flatMap((rule) => rule.played.filter(({ name }) => rising.includes(name)).map((played) => ({ ...played, selector: rule.selector })));
		assert.ok(rise.length > 0, 'le héros ne remonte pas');
		const end = Math.max(...rise.map(({ range }) => range[1]));
		const fades = rules.flatMap(({ selector, played }) => played.filter(({ name }) => /\bopacity:/.test(keyframes.get(name) ?? '')).map((p) => ({ ...p, selector })));
		assert.ok(fades.length > 0, 'aucun effacement du héros');
		for (const { selector, name, range } of fades) assert.ok(range[0] >= end, `${selector.trim()} : ${name} commence à ${range[0]} %, avant la fin de la remontée (${end} %)`);
	});

	// Le minifieur sait replier la ligne de temps dans le raccourci, ou écrire une durée nulle : Chrome
	// refuse le premier en entier, et la seconde jouerait l'animation d'un coup.
	test(`${locale} : chaque animation de la Plongée suit la scène, sous une forme que Chrome accepte`, () => {
		const rules = [...styles.matchAll(/([^{}]+)\{([^{}]*\banimation(?:-name)?\s*:[^;{}]*\bdive-[^{}]*)\}/g)];
		assert.ok(rules.length > 0, 'aucune animation de la Plongée');
		for (const [, selector, body] of rules) {
			assert.match(body, /\banimation-timeline\s*:\s*--dive\b/, selector.trim());
			assert.doesNotMatch(body, /\banimation\s*:[^;]*--dive\b/, `${selector.trim()} : ligne de temps dans le raccourci`);
			assert.doesNotMatch(body, /\banimation-duration\s*:[^;]*\b0m?s\b/, `${selector.trim()} : durée nulle`);
		}
	});
}

test('les fiches restent sans Plongée', () => {
	for (const locale of ['fr', 'en']) {
		for (const { slug } of PROJECTS) {
			const html = readFiche(slug, locale);
			assert.equal(sceneOf(html), undefined, `${locale} ${slug} : scène`);
			assert.doesNotMatch(css(html), PLAYED, `${locale} ${slug} : CSS de la Plongée`);
		}
	}
});
