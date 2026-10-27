// La Plongée (spec #68, ADR 0009) : sur l'accueil, la page s'arrête au défilement, le curseur du nom
// grandit jusqu'à remplir l'écran, puis se range dans le carré de « 01 Projets ». Le mouvement se
// vérifie à la main ; ici, ce que la page livre : la scène, et une CSS qui ne joue qu'en mouvement non
// réduit, dans un navigateur qui sait la jouer, sur le compositeur.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROJECTS, attr, blocks, css, elementAt, elements, readFiche, readHome, tags, text, withoutBlocks } from './helpers/dist.mjs';

const MOTION = /@media \(prefers-reduced-motion:\s*no-preference\)/;
const SUPPORTED = /@supports [^{]*\(animation-timeline:\s*view\(\)\)/;
/** Ce qui appartient à la scène jouée : ses animations, sa ligne de temps, ses propriétés. */
const PLAYED = /@keyframes\s+dive-|\banimation[\w-]*\s*:[^;{}]*\bdive-|\b(?:animation-timeline|animation-range|view-timeline|timeline-scope)\s*:|--dive\b/;
/** Les seules propriétés que le compositeur anime seul. */
const COMPOSITED = new Set(['transform', 'translate', 'scale', 'opacity']);

/** La devise de chaque langue, ligne à ligne (spec #70) : l'accent de l'accroche, coupé à un endroit naturel. */
const MOTTO = { fr: ['de bout', 'en bout'], en: ['end', 'to end'] };

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

	test(`${locale} : la devise sur le bleu est l’accent de l’accroche, en deux lignes, décorative`, () => {
		const scene = sceneOf(html) ?? '';
		const opening = tags(scene, 'div').find((tag) => /\bclass="dive-motto\b/.test(tag));
		assert.ok(opening, 'devise absente de la scène');
		assert.equal(attr(opening, 'aria-hidden'), 'true');
		const motto = elementAt(scene, scene.indexOf(opening));
		const lines = [...motto.matchAll(/<span class="dive-line\b[^>]*>([\s\S]*?)<\/span>/g)].map((m) => text(m[1]));
		assert.deepEqual(lines, ['-- INSERT --', ...MOTTO[locale]]);
		const emphasis = text(elements(html, 'p').find((p) => /\bclass="lede\b/.test(p)).match(/<em\b[^>]*>([\s\S]*?)<\/em>/)[1]);
		assert.equal(MOTTO[locale].join(' '), emphasis, 'devise différente de l’accent de l’accroche');
	});

	test(`${locale} : en mouvement réduit ou sans prise en charge, la devise reste cachée`, () => {
		for (const outside of [withoutBlocks(styles, MOTION), withoutBlocks(styles, SUPPORTED)]) {
			const hidden = [...outside.matchAll(/([^{}]*)\{display:none\}/g)].flatMap(([, selector]) => selector.split(','));
			assert.ok(hidden.some((selector) => /^\.dive-motto\b/.test(selector.trim())), 'devise visible');
		}
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
