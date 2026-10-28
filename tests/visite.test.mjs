// La Visite (spec #80, ticket #83, ADR 0011) : en défilant jusqu'à la section Stack, la scène s'épingle et
// l'Atome se monte puis se visite famille par famille. Le mouvement se vérifie à la main ; ici, ce que la
// page livre : une CSS qui ne joue qu'en mouvement non réduit, sur un écran assez haut, dans un navigateur
// qui sait la jouer, et sur le compositeur.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROJECTS, attr, blocks, css, elementAt, readFiche, readHome, tags, withoutBlocks } from './helpers/dist.mjs';

/** Le seul bloc où la Visite a le droit de jouer : mouvement non réduit, au moins 500 px de haut. */
// Le minifieur récrit `(min-height: 500px)` en `(height>=500px)`.
const MOTION = /@media \(prefers-reduced-motion:\s*no-preference\)\s*and\s*\((?:min-height:\s*|height\s*>=\s*)500px\)/;
const SUPPORTED = /@supports [^{]*\(animation-timeline:\s*view\(\)\)[^{]*\(timeline-scope:\s*--visit\)/;
/** Ce qui appartient à la Visite jouée : ses animations, sa ligne de temps, ses éléments propres. */
const PLAYED = /@keyframes\s+visit-|\banimation[\w-]*\s*:[^;{}]*\bvisit-|--visit\b/;
const COMPOSITED = new Set(['transform', 'translate', 'rotate', 'scale', 'opacity']);

const keyframesOf = (styles) => new Map(blocks(styles, /@keyframes\s+visit-[\w-]+/).map((block) => [block.match(/@keyframes\s+([\w-]+)/)[1], block]));

for (const locale of ['fr', 'en']) {
	const html = readHome(locale);
	const styles = css(html);
	const section = elementAt(html, html.search(/<section\b[^>]*\sid="stack"/)) ?? '';

	test(`${locale} : la Visite ne joue qu’en mouvement non réduit, sur un écran d’au moins 500 px de haut, dans un navigateur qui sait la jouer`, () => {
		assert.match(styles, PLAYED, 'CSS de la Visite absente');
		// Sur un téléphone de moins de 640 px de haut, l'Atome au-dessus de la légende n'aurait pas le tiers
		// de sa taille : la section y reste posée, comme sous 500 px de haut.
		const headers = [...styles.matchAll(new RegExp(`${MOTION.source}[^{]*`, 'g'))].map((m) => m[0].replace(/\s+/g, ''));
		assert.ok(headers.length > 0, 'bloc de la Visite absent');
		for (const header of headers) assert.match(header, /\((?:min-width:|width>=)900px\)or\((?:min-height:|height>=)640px\)/, header);
		for (const [condition, outside] of [
			['mouvement non réduit et 500 px de haut', withoutBlocks(styles, MOTION)],
			['@supports sur --visit', withoutBlocks(styles, SUPPORTED)],
		]) {
			assert.doesNotMatch(outside, PLAYED, `Visite hors de ${condition}`);
			// Sans Visite, la piste et le dessin gris de la Bague bleue sont cachés : la section est l'Atome posé.
			const own = [...outside.matchAll(/([^{}@]+)\{([^{}]*)\}/g)].filter(([, selector]) =>
				selector.split(',').some((one) => /\.(?:visit-track|plain)(?:\[[^\]]*\])?\s*$/.test(one)),
			);
			for (const name of ['visit-track', 'plain']) {
				assert.ok(own.some(([selector, , body]) => selector.includes(name) && /\bdisplay:none\b/.test(body)), `${name} visible hors de ${condition}`);
			}
			for (const [, selector, body] of own) assert.doesNotMatch(body, /\bdisplay:(?!none\b)/, `${selector.trim()} affiché hors de ${condition}`);
		}
	});

	test(`${locale} : la piste de la Visite est dans la section Stack, qui la voit, longue d’environ quatre écrans`, () => {
		const track = tags(section, 'span').find((t) => /\bclass="[^"]*\bvisit-track\b/.test(t));
		assert.ok(track, 'piste absente');
		assert.equal(attr(track, 'aria-hidden'), 'true');
		// La piste est l'enfant direct de la scène (#81) : la section, première balise après elle.
		assert.ok(section.indexOf(track) < section.search(/<div\b/), 'piste hors de la section ou après la scène collante');
		const rule = [...styles.matchAll(/([^{}]+)\{([^{}]*\bview-timeline\s*:\s*--visit\b[^{}]*)\}/g)];
		assert.equal(rule.length, 1, 'ligne de temps de la Visite');
		assert.match(rule[0][1], /\.visit-track\b/);
		assert.match(styles, /\.stack\b[^{}]*\{[^{}]*\btimeline-scope\s*:\s*--visit\b/, 'la section ne voit pas la ligne de temps');
		assert.match(styles, /--visit-length\s*:\s*400svh\b/, 'course de la Visite');
	});

	// Sans exception : le rayon des Bagues, animé sur le thread principal dans la planche, passe par l'échelle
	// des calques et un déplacement des Pastilles (ADR 0011). Une propriété personnalisée animée y serait prise.
	test(`${locale} : les @keyframes de la Visite n’animent que des propriétés composées`, () => {
		const keyframes = keyframesOf(styles);
		assert.ok(keyframes.size > 0, 'aucune @keyframes visit-');
		for (const [name, block] of keyframes) {
			const properties = new Set([...block.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]).filter((p) => p !== 'animation-timing-function'));
			assert.deepEqual([...properties].filter((p) => !COMPOSITED.has(p)), [], name);
		}
	});

	// Le minifieur sait replier la ligne de temps dans le raccourci, ou écrire une durée nulle : Chrome
	// refuse le premier en entier, et la seconde jouerait l'animation d'un coup.
	test(`${locale} : chaque animation de la Visite suit sa ligne de temps, sous une forme que Chrome accepte`, () => {
		const rules = [...styles.matchAll(/([^{}]+)\{([^{}]*\banimation(?:-name)?\s*:[^;{}]*\bvisit-[^{}]*)\}/g)];
		assert.ok(rules.length > 0, 'aucune animation de la Visite');
		for (const [, selector, body] of rules) {
			const shorthand = body.match(/\banimation\s*:([^;}]*)/)?.[1];
			if (shorthand) {
				assert.match(body, /\banimation-timeline\s*:\s*--visit\b/, selector.trim());
				for (const one of shorthand.split(/,(?![^(]*\))/)) assert.match(one, /\bauto\b/, `${selector.trim()} : ${one.trim()} sans durée auto`);
				assert.doesNotMatch(shorthand, /--visit\b/, `${selector.trim()} : ligne de temps dans le raccourci`);
			}
			assert.doesNotMatch(body, /\banimation-duration\s*:[^;]*\b0m?s\b/, `${selector.trim()} : durée nulle`);
		}
		// Toute animation nommée en `animation-name` seul reprend la ligne de temps d'une règle complète.
		const named = new Set(rules.flatMap(([, , body]) => (body.match(/\banimation(?:-name)?\s*:([^;}]*)/)?.[1].match(/\bvisit-[\w-]+/g) ?? [])));
		for (const name of named) assert.ok(keyframesOf(styles).has(name), `${name} sans @keyframes`);
		for (const name of keyframesOf(styles).keys()) assert.ok(named.has(name), `@keyframes ${name} jamais jouée`);
	});
}

test('les fiches restent sans Visite', () => {
	for (const locale of ['fr', 'en']) {
		for (const { slug } of PROJECTS) {
			const page = readFiche(slug, locale);
			assert.doesNotMatch(css(page), PLAYED, `${locale} ${slug} : CSS de la Visite`);
			assert.doesNotMatch(page, /\bvisit-track\b/, `${locale} ${slug} : piste de la Visite`);
		}
	}
});

test('l’accueil n’a toujours qu’un module', () => {
	for (const locale of ['fr', 'en']) assert.equal(tags(readHome(locale), 'script').filter((t) => attr(t, 'type') === 'module').length, 1, locale);
});
